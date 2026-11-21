"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const SIZES = { thumb: { edge: 480, quality: 72 }, preview: { edge: 2048, quality: 84 } };

/**
 * Tạo ảnh xem trước JPEG (đã xoay theo EXIF, bỏ metadata) và lưu đệm trên đĩa.
 * `fallback(file, edge)` (tuỳ chọn) dùng bộ tạo ảnh thu nhỏ của hệ điều hành cho RAW/HEIC.
 */
class ImageCache {
  constructor(dir, { sharp, fallback } = {}) {
    this.dir = dir;
    this.sharp = sharp || require("sharp");
    this.fallback = fallback || null;
    this.inflight = new Map();
  }

  async get(file, variant) {
    const spec = SIZES[variant];
    if (!spec) return null;
    const stat = await fs.stat(file);
    const name = crypto
      .createHash("sha256")
      .update(`${file}\n${stat.mtimeMs}\n${stat.size}\n${variant}`)
      .digest("hex")
      .slice(0, 40);
    const cached = path.join(this.dir, name.slice(0, 2), `${name}.jpg`);
    try {
      return await fs.readFile(cached);
    } catch {
      // chưa có trong bộ đệm
    }
    if (this.inflight.has(cached)) return this.inflight.get(cached);
    const task = this.render(file, spec)
      .then(async (buffer) => {
        if (buffer) {
          await fs.mkdir(path.dirname(cached), { recursive: true });
          const tmp = `${cached}.${process.pid}.tmp`;
          await fs.writeFile(tmp, buffer);
          await fs.rename(tmp, cached);
        }
        return buffer;
      })
      .finally(() => this.inflight.delete(cached));
    this.inflight.set(cached, task);
    return task;
  }

  async render(file, spec) {
    try {
      return await this.sharp(file, { failOn: "none", limitInputPixels: 500_000_000 })
        .rotate()
        .resize({ width: spec.edge, height: spec.edge, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: spec.quality, mozjpeg: false })
        .toBuffer();
    } catch {
      if (!this.fallback) return null;
      try {
        return await this.fallback(file, spec.edge);
      } catch {
        return null;
      }
    }
  }
}

module.exports = { ImageCache };
