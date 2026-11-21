const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { constants } = require("node:fs");
const { timingSafeEqual } = require("node:crypto");
const { pipeline } = require("node:stream/promises");
const { classify } = require("./scanner");
const { safeRelative } = require("./store");
const { writeZip } = require("./zip");

const MIME = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
};
const contentType = (file) => MIME[path.extname(file).toLowerCase()] || "application/octet-stream";
function httpError(status) {
  return Object.assign(new Error(`HTTP ${status}`), { status });
}
function validSecret(expected, actual) {
  const a = Buffer.from(expected || "");
  const b = Buffer.from(actual || "");
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}
function disposition(name, attachment) {
  const fallback = name.replace(/[^\x20-\x7e]|["\\;]/g, "_");
  const encoded = encodeURIComponent(name).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${attachment ? "attachment" : "inline"}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
function contained(root, file) {
  const relative = path.relative(root, file);
  return (
    relative !== "" &&
    relative !== ".." &&
    !relative.startsWith(".." + path.sep) &&
    !path.isAbsolute(relative)
  );
}
async function resolveFile(share, key, preview = false) {
  if (!Object.hasOwn(share.files, key)) throw httpError(404);
  const relative = preview ? share.previews?.[key] || share.files[key] : share.files[key];
  if (!safeRelative(relative)) throw httpError(404);
  const root = await fs.realpath(share.rootPath);
  const file = await fs.realpath(path.join(root, ...relative.split("/")));
  if (!contained(root, file)) throw httpError(404);
  return file;
}
async function openFile(file) {
  const handle = await fs.open(file, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  if (!(await handle.stat()).isFile()) {
    await handle.close();
    throw httpError(404);
  }
  return handle;
}
function rangeFor(value, size) {
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2]) || size === 0) throw httpError(416);
  let start;
  let end;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) throw httpError(416);
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
  }
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    start >= size ||
    end < start
  )
    throw httpError(416);
  return { start, end };
}

class AccessLog {
  constructor(directory, maxBytes = 5 * 1024 * 1024) {
    this.file = path.join(directory, "access.jsonl");
    this.maxBytes = maxBytes;
    this.queue = Promise.resolve();
  }
  append(entry) {
    this.queue = this.queue
      .then(async () => {
        let size = 0;
        try {
          size = (await fs.stat(this.file)).size;
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
        if (size >= this.maxBytes) {
          await fs.unlink(this.file + ".1").catch((error) => {
            if (error.code !== "ENOENT") throw error;
          });
          await fs.rename(this.file, this.file + ".1");
        }
        await fs.appendFile(this.file, JSON.stringify(entry) + "\n", { mode: 0o600 });
      })
      .catch(() => {
        process.stderr.write("Không ghi được nhật ký truy cập.\n");
      });
    return this.queue;
  }
}

function createMediaServer({ store, cache, port = 0, log = new AccessLog(store.directory) }) {
  const server = http.createServer(async (request, response) => {
    const controller = new AbortController();
    response.on("close", () => {
      if (!response.writableEnded) controller.abort();
    });
    const entry = {
      time: new Date().toISOString(),
      ip: String(request.headers["cf-connecting-ip"] || request.socket.remoteAddress || "").slice(
        0,
        128,
      ),
      shareId: null,
      file: null,
      variant: null,
      status: 500,
    };
    response.on("finish", () => {
      entry.status = response.statusCode;
      log.append(entry);
    });
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader(
      "Access-Control-Expose-Headers",
      "Content-Length, Content-Range, Content-Disposition",
    );
    let handle;
    try {
      if (!["GET", "HEAD"].includes(request.method)) throw httpError(405);
      const route = new URL(request.url, "http://localhost").pathname
        .split("/")
        .filter(Boolean)
        .map(decodeURIComponent);
      const [prefix, id, secret, key, variant] = route;
      if (!((prefix === "m" && route.length === 5) || (prefix === "z" && route.length === 3)))
        throw httpError(404);
      entry.shareId = id;
      entry.variant = prefix === "z" ? "zip" : variant;
      const share = store.loadShares().find((item) => item.id === id);
      if (
        !share ||
        share.status !== "active" ||
        (share.expiresAt && Date.parse(share.expiresAt) <= Date.now()) ||
        !validSecret(share.mediaSecret, secret)
      )
        throw httpError(404);
      if (prefix === "z") {
        if (!share.allowOriginals) throw httpError(403);
        const entries = [];
        const names = new Set();
        for (const fileKey of Object.keys(share.files)) {
          let file = await resolveFile(share, fileKey);
          let name = share.files[fileKey];
          if (classify(file) === "raw" && share.rawDownload === "jpg") {
            file = await cache.get(file, fileKey, "embedded");
            name = name.replace(/\.[^.]+$/, ".jpg");
          }
          if (names.has(name)) name = `${fileKey}-${path.posix.basename(name)}`;
          names.add(name);
          entries.push({
            name,
            open: async () => {
              await resolveFile(share, fileKey);
              return openFile(file);
            },
          });
        }
        response.setHeader("Content-Type", "application/zip");
        response.setHeader(
          "Content-Disposition",
          disposition((share.title || "StudioCore") + ".zip", true),
        );
        if (request.method === "HEAD") {
          response.end();
          return;
        }
        await writeZip(entries, response, { signal: controller.signal });
        response.end();
        return;
      }
      if (!["thumb", "preview", "original", "stream"].includes(variant)) throw httpError(404);
      if (variant === "original" && !share.allowOriginals) throw httpError(403);
      let file = await resolveFile(share, key, variant === "thumb" || variant === "preview");
      entry.file = share.files[key];
      let name = path.basename(share.files[key]);
      if (variant === "stream" && classify(file) !== "video") throw httpError(404);
      if (variant === "thumb" || variant === "preview") {
        if (!["image", "raw"].includes(classify(file))) throw httpError(404);
        file = await cache.get(file, key, variant);
        response.setHeader("Cache-Control", "private, max-age=86400");
      } else if (
        variant === "original" &&
        classify(file) === "raw" &&
        share.rawDownload === "jpg"
      ) {
        file = await cache.get(file, key, "embedded");
        name = name.replace(/\.[^.]+$/, ".jpg");
      }
      handle = await openFile(file);
      const stat = await handle.stat();
      let range;
      try {
        range = variant === "stream" ? rangeFor(request.headers.range, stat.size) : null;
      } catch (error) {
        response.setHeader("Content-Range", `bytes */${stat.size}`);
        throw error;
      }
      response.setHeader("Content-Type", contentType(file));
      response.setHeader("Content-Disposition", disposition(name, variant === "original"));
      if (variant === "stream") response.setHeader("Accept-Ranges", "bytes");
      if (range) {
        response.statusCode = 206;
        response.setHeader("Content-Range", `bytes ${range.start}-${range.end}/${stat.size}`);
      }
      response.setHeader("Content-Length", range ? range.end - range.start + 1 : stat.size);
      if (request.method === "HEAD" || stat.size === 0) response.end();
      else
        await pipeline(
          handle.createReadStream({
            autoClose: false,
            start: range?.start || 0,
            end: range?.end ?? stat.size - 1,
          }),
          response,
          { signal: controller.signal },
        );
    } catch (error) {
      const status =
        error.status ||
        (["ENOENT", "ENOTDIR", "ELOOP", "EACCES"].includes(error.code) || error instanceof URIError
          ? 404
          : 500);
      if (response.headersSent || response.destroyed) response.destroy();
      else {
        response.statusCode = status;
        response.removeHeader("Content-Length");
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("Content-Type", "text/plain; charset=utf-8");
        response.end(
          status === 500 ? "Không đọc được tệp. Vui lòng thử lại sau." : `HTTP ${status}`,
        );
      }
    } finally {
      if (handle) await handle.close().catch(() => {});
    }
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  return {
    server,
    start: () =>
      new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, "127.0.0.1", () => {
          server.removeListener("error", reject);
          resolve(server.address().port);
        });
      }),
    stop: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : log.queue.then(resolve)));
        server.closeAllConnections?.();
      }),
  };
}

module.exports = {
  createMediaServer,
  resolveFile,
  contained,
  validSecret,
  rangeFor,
  disposition,
  AccessLog,
};
