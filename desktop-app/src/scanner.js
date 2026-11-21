const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const IMAGE = new Set("jpg jpeg png webp heic".split(" "));
const RAW = new Set("cr2 cr3 nef nrw arw srf sr2 raf orf rw2 pef dng srw 3fr iiq x3f".split(" "));
const VIDEO = new Set("mp4 mov m4v webm mkv".split(" "));
const extension = (name) => path.extname(name).slice(1).toLowerCase();
const classify = (name) =>
  IMAGE.has(extension(name))
    ? "image"
    : RAW.has(extension(name))
      ? "raw"
      : VIDEO.has(extension(name))
        ? "video"
        : "other";
const fileKey = (relative) =>
  createHash("sha256").update(relative.split(path.sep).join("/")).digest("base64url").slice(0, 24);
const code = (name) => name.replace(/\.[^.]+$/, "");

async function scan(target, kind, outputName = "Anh_Chon_Goc") {
  if (!["album", "view", "video", "folder"].includes(kind))
    throw new Error("Loại chia sẻ không hợp lệ.");
  const absolute = await fs.realpath(path.resolve(target));
  const stat = await fs.stat(absolute);
  if (!stat.isDirectory() && !(stat.isFile() && kind === "video"))
    throw new Error("Vui lòng chọn thư mục (hoặc một tệp video).");
  const rootPath = stat.isDirectory() ? absolute : path.dirname(absolute);
  const hidden = new Set(
    process.platform === "win32"
      ? JSON.parse(
          (
            await promisify(execFile)(
              "powershell.exe",
              [
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                path.join(__dirname, "hidden.ps1"),
                "-RootPath",
                rootPath,
              ],
              { timeout: 120000, maxBuffer: 16 * 1024 * 1024, windowsHide: true },
            )
          ).stdout
            .trim()
            .replace(/^\uFEFF/, "") || "[]",
        ).map((file) => file.toLowerCase())
      : [],
  );
  const candidates = [];
  async function visit(relative) {
    const entries = await fs.readdir(path.join(rootPath, relative), { withFileTypes: true });
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      if (
        entry.name.startsWith(".") ||
        /^(thumbs\.db|desktop\.ini|\$recycle\.bin|system volume information)$/i.test(entry.name) ||
        entry.name.toLowerCase() === outputName.toLowerCase() ||
        entry.isSymbolicLink()
      )
        continue;
      const child = relative ? `${relative}/${entry.name}` : entry.name;
      if (hidden.has(path.join(rootPath, child).toLowerCase())) continue;
      if (entry.isDirectory()) await visit(child);
      else if (entry.isFile()) candidates.push(child);
    }
  }
  if (stat.isDirectory()) await visit("");
  else if (!path.basename(absolute).startsWith(".") && !hidden.has(absolute.toLowerCase()))
    candidates.push(path.basename(absolute));
  const accepted = candidates.filter(
    (name) =>
      kind === "folder" ||
      (kind === "video" ? classify(name) === "video" : ["raw", "image"].includes(classify(name))),
  );
  const groups = new Map();
  for (const relative of accepted) {
    const group = ["album", "view"].includes(kind) ? code(relative).toLowerCase() : relative;
    const existing = groups.get(group) || [];
    existing.push(relative);
    groups.set(group, existing);
  }
  if (groups.size > 20000) throw new Error("Mỗi link chỉ được chia sẻ tối đa 20.000 tệp.");
  const files = [];
  const mapping = {};
  const previews = {};
  for (const relatives of groups.values()) {
    const preview =
      relatives.find((name) => ["jpg", "jpeg"].includes(extension(name))) ||
      relatives.find((name) => classify(name) === "image") ||
      relatives[0];
    const original = relatives.find((name) => classify(name) === "raw") || preview;
    const key = fileKey(preview);
    const info = await fs.stat(path.join(rootPath, original));
    mapping[key] = original;
    previews[key] = preview;
    files.push({
      fileKey: key,
      name: path.posix.basename(preview),
      relPath: preview,
      kind: classify(preview),
      sizeBytes: info.size,
    });
  }
  return { rootPath, folderName: path.basename(rootPath) || "Thư mục", files, mapping, previews };
}

module.exports = { scan, classify, fileKey, RAW };
