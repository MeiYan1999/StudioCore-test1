"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { RAW_EXT, extOf, stem, resolveInside } = require("./scanner");

const MARKUP_COLORS = new Map([
  ["#ef4444", "đỏ"],
  ["#f97316", "cam"],
  ["#eab308", "vàng"],
  ["#22c55e", "xanh lá"],
  ["#3b82f6", "xanh dương"],
  ["#a855f7", "tím"],
]);

function validatedMarkup(input) {
  let markup = input;
  if (typeof markup === "string") {
    try {
      markup = JSON.parse(markup);
    } catch {
      throw new Error("Nét vẽ không hợp lệ.");
    }
  }
  if (!markup || markup.v !== 1 || !Array.isArray(markup.strokes) || markup.strokes.length > 200) {
    throw new Error("Nét vẽ không hợp lệ.");
  }
  let pointCount = 0;
  const strokes = markup.strokes.map((stroke) => {
    if (
      !stroke ||
      !MARKUP_COLORS.has(stroke.c) ||
      !Number.isFinite(stroke.w) ||
      stroke.w < 0.002 ||
      stroke.w > 0.08 ||
      !Array.isArray(stroke.p) ||
      stroke.p.length === 0
    ) {
      throw new Error("Nét vẽ không hợp lệ.");
    }
    pointCount += stroke.p.length;
    if (pointCount > 6000) throw new Error("Nét vẽ không hợp lệ.");
    const points = stroke.p.map((point) => {
      if (
        !Array.isArray(point) ||
        point.length !== 2 ||
        point.some((n) => !Number.isFinite(n) || n < 0 || n > 1)
      ) {
        throw new Error("Nét vẽ không hợp lệ.");
      }
      return point;
    });
    return { c: stroke.c, w: stroke.w, p: points };
  });
  if (!strokes.length) throw new Error("Nét vẽ không hợp lệ.");
  const used = new Set(strokes.map((stroke) => stroke.c));
  const notes = {};
  for (const [color, text] of Object.entries(markup.notes || {})) {
    if (!MARKUP_COLORS.has(color) || !used.has(color) || typeof text !== "string" || text.length > 200) {
      throw new Error("Nét vẽ không hợp lệ.");
    }
    if (text) notes[color] = text;
  }
  return { strokes, notes };
}

function markupSvg(markup, width, height) {
  const paths = markup.strokes
    .map((stroke) => {
      const strokeWidth = (stroke.w * Math.max(width, height)).toFixed(2);
      if (stroke.p.length === 1) {
        const [x, y] = stroke.p[0];
        return `<circle cx="${(x * width).toFixed(2)}" cy="${(y * height).toFixed(2)}" r="${(Number(strokeWidth) / 2).toFixed(2)}" fill="${stroke.c}"/>`;
      }
      const points = stroke.p.map(([x, y]) => `${(x * width).toFixed(2)},${(y * height).toFixed(2)}`).join(" ");
      return `<polyline points="${points}" fill="none" stroke="${stroke.c}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${paths}</svg>`;
}

async function writeMarkupComposite(source, target, markup, images) {
  const sharp = images?.sharp || require("sharp");
  let rendered;
  try {
    rendered = await sharp(source, { failOn: "none" })
      .rotate()
      .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    if (!images?.get) throw new Error("Không thể tạo ảnh ghi chú.");
    const preview = await images.get(source, "preview");
    rendered = await sharp(preview, { failOn: "none" })
      .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer({ resolveWithObject: true });
  }
  const { width, height } = rendered.info;
  if (!width || !height) throw new Error("Không xác định được kích thước ảnh.");
  const output = await sharp(rendered.data)
    .composite([{ input: Buffer.from(markupSvg(markup, width, height)) }])
    .jpeg({ quality: 90 })
    .toBuffer();
  const temp = path.join(path.dirname(target), `.scd-${crypto.randomUUID()}.tmp`);
  let ownsTemp = false;
  try {
    const handle = await fs.open(temp, "wx");
    ownsTemp = true;
    try {
      await handle.writeFile(output);
    } finally {
      await handle.close();
    }
    await fs.rename(temp, target);
    ownsTemp = false;
  } catch (error) {
    if (ownsTemp) await fs.rm(temp, { force: true }).catch(() => {});
    throw error;
  }
}

function markupCompositeName(source) {
  return `${path.basename(source)}_note.jpg`;
}

function safeFolderName(name) {
  const cleaned = String(name || "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 60);
  return cleaned || "Khach-chon";
}

/**
 * Chép các ảnh khách đã chọn, kèm file RAW cùng tên trong cùng thư mục, sang `<thư mục>/<Khach-chon>`.
 * Không ghi đè tệp đã có. Trả về số tệp đã chép và danh sách mã ảnh.
 */
async function copyPicks(share, picks, folderName, images = null) {
  const dest = path.join(share.folder, safeFolderName(folderName));
  await fs.mkdir(dest, { recursive: true });
  const realDest = await fs.realpath(dest);
  let copied = 0;
  let missing = 0;
  let markupFailed = 0;
  const codes = [];
  for (const pick of picks) {
    const rel = share.files[pick.key];
    const source = rel ? await resolveInside(share.folder, rel) : null;
    if (!source) {
      missing += 1;
      continue;
    }
    codes.push(path.basename(source).replace(/\.[^.]+$/, ""));
    const relativeDir = path.dirname(rel);
    const targetDir = path.resolve(dest, relativeDir === "." ? "" : relativeDir);
    const targetDirRelative = path.relative(dest, targetDir);
    if (
      targetDirRelative === ".." ||
      targetDirRelative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(targetDirRelative)
    ) {
      missing += 1;
      continue;
    }
    let targetDirPath = dest;
    let realTargetDir = realDest;
    let targetDirIsInside = true;
    for (const part of targetDirRelative ? targetDirRelative.split(path.sep) : []) {
      targetDirPath = path.join(targetDirPath, part);
      try {
        await fs.mkdir(targetDirPath);
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
      }
      realTargetDir = await fs.realpath(targetDirPath);
      const realTargetRelative = path.relative(realDest, realTargetDir);
      const targetStat = await fs.stat(targetDirPath).catch(() => null);
      if (
        realTargetRelative === ".." ||
        realTargetRelative.startsWith(`..${path.sep}`) ||
        path.isAbsolute(realTargetRelative) ||
        !targetStat?.isDirectory()
      ) {
        targetDirIsInside = false;
        break;
      }
    }
    if (!targetDirIsInside) {
      missing += 1;
      continue;
    }
    const targets = [source];
    const dir = path.dirname(source);
    const base = stem(path.basename(source));
    for (const sibling of await fs.readdir(dir).catch(() => [])) {
      if (stem(sibling) === base && RAW_EXT.has(extOf(sibling))) targets.push(path.join(dir, sibling));
    }
    for (const file of targets) {
      try {
        await fs.copyFile(file, path.join(realTargetDir, path.basename(file)), fs.constants.COPYFILE_EXCL);
        copied += 1;
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
      }
    }
    if (pick.markup) {
      try {
        const markup = validatedMarkup(pick.markup);
        const markupDir = path.join(dest, "Khách note màu", targetDirRelative);
        await fs.mkdir(markupDir, { recursive: true });
        const realMarkupDir = await fs.realpath(markupDir);
        const markupRelative = path.relative(realDest, realMarkupDir);
        if (markupRelative === ".." || markupRelative.startsWith(`..${path.sep}`) || path.isAbsolute(markupRelative)) {
          markupFailed += 1;
          continue;
        }
        const annotated = path.join(realMarkupDir, markupCompositeName(source));
        await writeMarkupComposite(source, annotated, markup, images);
        copied += 1;
      } catch (error) {
        if (error.code !== "EEXIST") markupFailed += 1;
      }
    }
  }
  const notes = picks.filter((p) => p.note).map((p) => `${p.name}: ${p.note}`);
  const markupNotes = picks.flatMap((pick) => {
    if (!pick.markup) return [];
    try {
      const markup = validatedMarkup(pick.markup);
      return Object.entries(markup.notes).map(([color, note]) => `${pick.name}: ${MARKUP_COLORS.get(color)}: ${note}`);
    } catch {
      return [];
    }
  });
  if (codes.length === 0 && notes.length === 0 && markupNotes.length === 0) {
    return { dest, copied, missing, codes, markupFailed };
  }
  await fs.writeFile(
    path.join(dest, "danh-sach-chon.txt"),
    [
      "Mã ảnh (dán vào bộ lọc Lightroom):",
      codes.join(", "),
      "",
      ...(notes.length ? ["Ghi chú của khách:", ...notes] : []),
      ...(markupNotes.length ? ["", "Ghi chú vẽ của khách:", ...markupNotes] : []),
    ].join("\r\n"),
    "utf8",
  );
  return { dest, copied, missing, codes, markupFailed };
}

module.exports = { copyPicks, safeFolderName, validatedMarkup, markupSvg };
