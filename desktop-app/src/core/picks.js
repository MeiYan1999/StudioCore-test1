"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { RAW_EXT, extOf, stem, resolveInside } = require("./scanner");

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
async function copyPicks(share, picks, folderName) {
  const dest = path.join(share.folder, safeFolderName(folderName));
  await fs.mkdir(dest, { recursive: true });
  const realDest = await fs.realpath(dest);
  let copied = 0;
  let missing = 0;
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
  }
  const notes = picks.filter((p) => p.note).map((p) => `${p.name}: ${p.note}`);
  await fs.writeFile(
    path.join(dest, "danh-sach-chon.txt"),
    [`Mã ảnh (dán vào bộ lọc Lightroom):`, codes.join(", "), "", ...(notes.length ? ["Ghi chú của khách:", ...notes] : [])].join("\r\n"),
    "utf8",
  );
  return { dest, copied, missing, codes };
}

module.exports = { copyPicks, safeFolderName };
