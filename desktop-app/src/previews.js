const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash, randomBytes } = require("node:crypto");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { classify } = require("./scanner");
const run = promisify(execFile);

function validJpeg(buffer) {
  if (buffer.length < 8 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return false;
  let offset = 2;
  let frame = false;
  let scan = false;
  while (offset < buffer.length) {
    if (buffer[offset++] !== 0xff) {
      if (scan) continue;
      return false;
    }
    while (buffer[offset] === 0xff) offset++;
    const marker = buffer[offset++];
    if (marker === 0xd9) return frame && scan;
    if (scan && (marker === 0 || (marker >= 0xd0 && marker <= 0xd7))) continue;
    if (marker === 0xd8 || marker === undefined) return false;
    if (offset + 2 > buffer.length) return false;
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) return false;
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      if (length < 8 || !buffer.readUInt16BE(offset + 3) || !buffer.readUInt16BE(offset + 5))
        return false;
      frame = true;
    }
    if (marker === 0xda) scan = true;
    offset += length;
  }
  return false;
}

function extractJpeg(buffer) {
  let largest = null;
  for (
    let start = buffer.indexOf(Buffer.from([0xff, 0xd8, 0xff]));
    start !== -1;
    start = buffer.indexOf(Buffer.from([0xff, 0xd8, 0xff]), start + 3)
  ) {
    let end = buffer.indexOf(Buffer.from([0xff, 0xd9]), start + 3);
    while (end !== -1) {
      const candidate = buffer.subarray(start, end + 2);
      if (validJpeg(candidate)) {
        if (!largest || candidate.length > largest.length) largest = candidate;
        break;
      }
      end = buffer.indexOf(Buffer.from([0xff, 0xd9]), end + 2);
    }
  }
  return largest;
}

async function embeddedJpeg(file) {
  const handle = await fs.open(file, "r");
  try {
    let best = null;
    let tail = Buffer.alloc(0);
    let offset = 0;
    let starts = [];
    for await (const data of handle.createReadStream({
      start: 0,
      autoClose: false,
      highWaterMark: 1024 * 1024,
    })) {
      const chunk = Buffer.concat([tail, data]);
      const base = offset - tail.length;
      for (let index = 0; index < chunk.length - 1; index++) {
        if (chunk[index] !== 0xff) continue;
        const position = base + index;
        if (chunk[index + 1] === 0xd8 && chunk[index + 2] === 0xff) starts.push(position);
        if (chunk[index + 1] !== 0xd9 || position + 1 < offset) continue;
        starts = starts.filter((start) => position - start < 128 * 1024 * 1024).slice(-1024);
        let completedStart = null;
        for (const start of starts) {
          const size = position + 2 - start;
          if (best && size <= best.length) continue;
          const candidate = Buffer.alloc(size);
          let read = 0;
          while (read < size) {
            const result = await handle.read(candidate, read, size - read, start + read);
            if (!result.bytesRead) break;
            read += result.bytesRead;
          }
          if (read === size && validJpeg(candidate)) {
            best = candidate;
            completedStart = start;
          }
        }
        if (completedStart !== null)
          starts = starts.filter((start) => start < completedStart || start > position);
      }
      tail = chunk.subarray(-2);
      offset += data.length;
    }
    return best;
  } finally {
    await handle.close();
  }
}

class PreviewCache {
  constructor(directory, settings) {
    this.directory = path.join(directory, "cache");
    this.settings = settings;
    this.running = 0;
    this.waiting = [];
    this.pending = new Map();
  }
  async limited(work) {
    await new Promise((resolve) => {
      if (this.running < 2) {
        this.running++;
        resolve();
      } else this.waiting.push(resolve);
    });
    try {
      return await work();
    } finally {
      const next = this.waiting.shift();
      if (next) next();
      else this.running--;
    }
  }
  async get(file, fileKey, variant) {
    await fs.mkdir(this.directory, { recursive: true, mode: 0o700 });
    const stat = await fs.stat(file);
    const hash = createHash("sha256")
      .update(`safe-preview-v2\0${file}\0${fileKey}\0${stat.mtimeMs}\0${stat.size}\0${variant}`)
      .digest("hex");
    const cached = path.join(this.directory, hash + ".jpg");
    try {
      await fs.access(cached);
      return cached;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (this.pending.has(hash)) return this.pending.get(hash);
    const promise = this.limited(async () => {
      const temporary = `${cached}.${randomBytes(6).toString("hex")}.jpg`;
      const extracted = `${temporary}.source.jpg`;
      let source = file;
      try {
        const jpeg =
          classify(file) === "raw" || variant === "embedded" ? await embeddedJpeg(file) : null;
        if (jpeg) {
          await fs.writeFile(extracted, jpeg, { mode: 0o600 });
          source = extracted;
        } else if (classify(file) === "raw")
          throw new Error("Không tìm thấy ảnh JPEG nhúng trong RAW.");
        if (variant === "embedded") {
          await fs.copyFile(source, temporary);
        } else {
          const pixels = variant === "thumb" ? 400 : 1600;
          try {
            if (process.platform === "darwin")
              await run(
                "sips",
                ["-Z", String(pixels), "-s", "format", "jpeg", source, "--out", temporary],
                { timeout: 60000 },
              );
            else if (process.platform === "win32")
              await run(
                "powershell.exe",
                [
                  "-NoProfile",
                  "-NonInteractive",
                  "-ExecutionPolicy",
                  "Bypass",
                  "-File",
                  path.join(__dirname, "resize.ps1"),
                  "-InputPath",
                  source,
                  "-OutputPath",
                  temporary,
                  "-MaxSize",
                  String(pixels),
                ],
                { timeout: 60000, windowsHide: true },
              );
            else
              await run(
                "convert",
                [
                  source,
                  "-auto-orient",
                  "-thumbnail",
                  `${pixels}x${pixels}>`,
                  "-background",
                  "white",
                  "-alpha",
                  "remove",
                  "-quality",
                  "85",
                  temporary,
                ],
                { timeout: 60000 },
              );
          } catch {
            if (source !== extracted) return file;
            await fs.copyFile(source, temporary);
          }
        }
        await fs.chmod(temporary, 0o600);
        await fs.rename(temporary, cached);
        return cached;
      } finally {
        for (const item of [temporary, extracted])
          await fs.unlink(item).catch((error) => {
            if (error.code !== "ENOENT") throw error;
          });
      }
    });
    this.pending.set(hash, promise);
    try {
      return await promise;
    } finally {
      this.pending.delete(hash);
    }
  }
  async cleanup(clear = false) {
    await fs.mkdir(this.directory, { recursive: true, mode: 0o700 });
    const files = [];
    for (const name of await fs.readdir(this.directory)) {
      if (!/^[a-f0-9]{64}\.jpg$/.test(name)) continue;
      const file = path.join(this.directory, name);
      try {
        files.push({ file, ...(await fs.stat(file)) });
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    files.sort((a, b) => a.mtimeMs - b.mtimeMs);
    let total = files.reduce((sum, file) => sum + file.size, 0);
    for (const file of files) {
      if (
        clear ||
        Date.now() - file.mtimeMs > this.settings.maxAgeDays * 86400000 ||
        total > this.settings.maxGB * 1024 ** 3
      ) {
        await fs.unlink(file.file).catch((error) => {
          if (error.code !== "ENOENT") throw error;
        });
        total -= file.size;
      }
    }
  }
  async clearCache() {
    await Promise.allSettled(this.pending.values());
    return this.cleanup(true);
  }
}

module.exports = { extractJpeg, embeddedJpeg, validJpeg, PreviewCache };
