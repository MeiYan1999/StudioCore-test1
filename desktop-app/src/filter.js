const fs = require("node:fs/promises");
const path = require("node:path");
const { constants } = require("node:fs");
const { classify } = require("./scanner");

function parseCodes(value) {
  const seen = new Set();
  return (Array.isArray(value) ? value.map(String) : String(value || "").split(/[\s,;|]+/))
    .map((code) => {
      const name = path.posix.basename(code.replace(/\\/g, "/")).trim();
      return classify(name) === "other" ? name : name.slice(0, -path.extname(name).length);
    })
    .filter((code) => {
      if (!code || seen.has(code.toLocaleLowerCase())) return false;
      seen.add(code.toLocaleLowerCase());
      return true;
    });
}
function inside(root, target) {
  const rel = path.relative(root, target);
  return !path.isAbsolute(rel) && rel !== ".." && !rel.startsWith(".." + path.sep);
}
async function planFilter(input) {
  if (!["raw", "jpg", "both"].includes(input.mode)) throw new Error("Chế độ lọc không hợp lệ.");
  const source = await fs.realpath(path.resolve(input.source || ""));
  if (!(await fs.stat(source)).isDirectory()) throw new Error("Nguồn phải là thư mục.");
  const outputName = input.outputName || "Anh_Chon_Goc";
  if (
    !input.outputPath &&
    (!outputName || /[\\/:\x00]/.test(outputName) || [".", ".."].includes(outputName))
  )
    throw new Error("Tên thư mục kết quả không hợp lệ.");
  const output = path.resolve(input.outputPath || path.join(source, outputName));
  if (inside(output, source))
    throw new Error("Thư mục kết quả không được là thư mục nguồn hoặc thư mục cha của nguồn.");
  const codes = parseCodes(input.codes);
  if (!codes.length || codes.length > 20000) throw new Error("Cần từ 1 đến 20.000 mã ảnh.");
  const found = new Map(codes.map((code) => [code.toLocaleLowerCase(), []]));
  async function walk(folder) {
    for (const item of await fs.readdir(folder, { withFileTypes: true })) {
      const full = path.join(folder, item.name);
      if (
        item.name.startsWith(".") ||
        item.isSymbolicLink() ||
        full === output ||
        item.name.toLowerCase() === outputName.toLowerCase()
      )
        continue;
      if (item.isDirectory()) await walk(full);
      else if (item.isFile()) {
        const kind = classify(item.name);
        if (
          !(input.mode === "raw"
            ? kind === "raw"
            : input.mode === "jpg"
              ? /\.jpe?g$/i.test(item.name)
              : kind === "raw" || /\.jpe?g$/i.test(item.name))
        )
          continue;
        const key = item.name.replace(/\.[^.]+$/, "").toLocaleLowerCase();
        if (found.has(key))
          found.get(key).push({ name: item.name, relative: path.relative(source, full), kind });
      }
    }
  }
  await walk(source);
  const matches = codes.map((code) => ({
    code,
    files: found.get(code.toLocaleLowerCase()).sort((a, b) => a.relative.localeCompare(b.relative)),
  }));
  return {
    source,
    output,
    codes,
    matches,
    matched: matches.filter((item) => item.files.length).length,
    missing: matches.filter((item) => !item.files.length).map((item) => item.code),
    ambiguous: matches.filter((item) => item.files.length > 1).map((item) => item.code),
    fileCount: matches.reduce((count, item) => count + item.files.length, 0),
  };
}
async function uniqueCopy(source, output, name) {
  const ext = path.extname(name);
  const stem = path.basename(name, ext);
  for (let suffix = 0; ; suffix++) {
    const target = path.join(output, `${stem}${suffix ? `_${suffix}` : ""}${ext}`);
    try {
      await fs.copyFile(source, target, constants.COPYFILE_EXCL);
      return target;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
}
async function copyFilter(input) {
  const plan = await planFilter(input);
  await fs.mkdir(plan.output, { recursive: true });
  const realOutput = await fs.realpath(plan.output);
  if (inside(realOutput, plan.source))
    throw new Error("Thư mục kết quả trỏ về nguồn hoặc thư mục cha.");
  const copied = [];
  for (const match of plan.matches)
    for (const file of match.files) {
      const original = await fs.realpath(path.join(plan.source, file.relative));
      if (!inside(plan.source, original) || inside(realOutput, original))
        throw new Error("Đường dẫn tệp không an toàn.");
      copied.push(await uniqueCopy(original, realOutput, file.name));
    }
  const notes = Object.entries(input.notes || {})
    .map(([code, note]) => `${code}: ${String(note).replace(/\r/g, "")}`)
    .join("\n");
  const text = [
    `Khách hàng: ${input.customer || ""}`,
    `Album: ${input.title || ""}`,
    `Ngày: ${new Date().toISOString()}`,
    "",
    "Bộ lọc Lightroom:",
    plan.codes.join(", "),
    "",
    "Ghi chú theo mã:",
    notes || "Không có",
    "",
    "Không tìm thấy:",
    plan.missing.join(", ") || "Không có",
    "",
  ].join("\n");
  for (let index = 0; ; index++) {
    const file = path.join(realOutput, `GHI_CHU_KHACH${index ? `_${index}` : ""}.txt`);
    try {
      await fs.writeFile(file, text, { flag: "wx", mode: 0o600 });
      return { ...plan, copied, notesFile: file, text };
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
}
module.exports = { parseCodes, planFilter, copyFilter, inside };
