"use strict";

const crypto = require("node:crypto");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { Readable } = require("node:stream");
const { ApiClient, ApiError, wwwVariant } = require("./api");
const { copyPicks } = require("./picks");
const { scanFolder, resolveInside, extOf } = require("./scanner");

const MIME = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
  heic: "image/heic", heif: "image/heic", avif: "image/avif",
  mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", webm: "video/webm", mkv: "video/x-matroska",
};

function sameServerOrigin(left, right) {
  try {
    return new URL(left).origin === new URL(right).origin;
  } catch {
    return false;
  }
}

function parseRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header || "");
  if (!match || (match[1] === "" && match[2] === "")) return null;
  let start;
  let end;
  if (match[1] === "") {
    start = Math.max(0, size - Number(match[2]));
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) return "invalid";
  return { start, end };
}

/**
 * Lõi của ứng dụng: ghép nối với studio, tạo link từ thư mục, phục vụ tệp cho khách
 * qua máy chủ StudioCore và xử lý lựa chọn của khách. Không phụ thuộc Electron.
 */
class DriveAgent extends EventEmitter {
  constructor({ store, images, appVersion, faceIndexer }) {
    super();
    this.store = store;
    this.images = images;
    this.faceIndexer = faceIndexer || null;
    this.appVersion = appVersion || "";
    this.status = "idle";
    this.abort = null;
    this.fastActive = 0;
    this.fastQueue = [];
    this.bulkActive = 0;
    this.bulkQueue = [];
    this.lastPendingExportRetryAt = 0;
    this.exportingShares = new Set();
    this.remoteShares = [];
    this.faceIndexTasks = new Map();
    if (this.faceIndexer) {
      this.faceIndexer.on("progress", (progress) => this.emit("faceIndex", progress));
    }
  }

  get paired() {
    return !!this.store.get("deviceToken");
  }

  client() {
    return new ApiClient({
      serverUrl: this.store.get("serverUrl"),
      token: this.store.get("deviceToken"),
      appVersion: this.appVersion,
    });
  }

  setStatus(status, detail) {
    if (this.status === status && !detail) return;
    this.status = status;
    this.emit("status", { status, detail: detail || null });
  }

  async pair(code, serverUrl) {
    const client = new ApiClient({ serverUrl: serverUrl || this.store.get("serverUrl"), appVersion: this.appVersion });
    const previousServerUrl = this.store.get("previousServerUrl");
    const previousToken = (
      sameServerOrigin(client.serverUrl, previousServerUrl) ||
      sameServerOrigin(wwwVariant(client.serverUrl), previousServerUrl)
    )
      ? this.store.get("previousDeviceToken") || undefined
      : undefined;
    let previousOrigin = null;
    try {
      previousOrigin = new URL(previousServerUrl).origin;
    } catch {
      previousOrigin = null;
    }
    const result = await client.pair({
      code: String(code || "").trim(),
      name: os.hostname().slice(0, 80),
      platform: process.platform,
      appVersion: this.appVersion,
    }, { previousToken, previousOrigin });
    this.store.set({
      serverUrl: client.serverUrl,
      deviceToken: result.deviceToken,
      previousDeviceToken: null,
      previousServerUrl: null,
      deviceId: result.deviceId,
      deviceName: result.deviceName,
      studioName: result.studioName,
    });
    this.start();
    return { deviceName: result.deviceName, studioName: result.studioName };
  }

  unpair() {
    this.stop();
    this.store.set({
      previousDeviceToken: this.store.get("deviceToken"),
      previousServerUrl: this.store.get("serverUrl"),
      deviceToken: null,
      deviceId: null,
      deviceName: null,
      studioName: null,
    });
    this.remoteShares = [];
    this.setStatus("idle");
  }

  start() {
    if (this.abort || !this.paired) return;
    this.abort = new AbortController();
    void this.loop(this.abort.signal);
    void this.indexExistingFaceShares(this.abort.signal);
  }

  stop() {
    this.abort?.abort();
    this.abort = null;
    const stopping = this.faceIndexer?.stop();
    if (stopping?.catch) void stopping.catch(() => undefined);
  }

  async indexExistingFaceShares(signal) {
    try {
      const { shares } = await this.client().listShares();
      this.remoteShares = shares || [];
      for (const remote of this.remoteShares) {
        if (signal.aborted) return;
        try {
          const local = this.store.getShare(remote.id);
          if (!local) continue;
          const faceSearch = remote.faceSearch === true;
          if (local.faceSearch !== faceSearch) this.store.setShare(remote.id, { ...local, faceSearch });
          if (faceSearch) await this.indexLocalFaceShare(remote.id, signal);
        } catch {
          continue;
        }
      }
    } catch {
      // Indexing is retried the next time the agent starts or the share is refreshed.
    }
  }

  async indexFaceFiles(shareId, files, signal) {
    if (!this.faceIndexer) return;
    const previous = this.faceIndexTasks.get(shareId);
    if (previous) {
      this.faceIndexer.cancelShare(shareId);
      await previous.catch(() => undefined);
    }
    const share = this.store.getShare(shareId);
    if (!share?.folder) return;
    const indexedFiles = files.map((file) => ({
      ...file,
      path: path.join(share.folder, file.rel),
    }));
    const task = this.faceIndexer.indexShare(
      shareId,
      indexedFiles,
      (id, batch) => this.client().setFaces(id, batch),
      signal,
    );
    this.faceIndexTasks.set(shareId, task);
    try {
      await task;
    } finally {
      if (this.faceIndexTasks.get(shareId) === task) this.faceIndexTasks.delete(shareId);
    }
  }

  async indexLocalFaceShare(shareId, signal) {
    const share = this.store.getShare(shareId);
    if (!share || !share.faceSearch) return;
    const files = await scanFolder(share.folder, share.salt, {
      skipDirs: [this.store.get("picksFolderName")],
      includeAllFiles: share.includeAllFiles === true,
    });
    if (signal?.aborted) return;
    await this.indexFaceFiles(shareId, files, signal);
  }

  async loop(signal) {
    let delay = 1000;
    let first = true;
    while (!signal.aborted) {
      try {
        const storedSince = this.store.get("lastSubmissionCheck");
        const since = typeof storedSince === "number" && storedSince > 0 ? storedSince : 0;
        const result = await this.client().poll(since, first ? 0 : 25000, signal);
        first = false;
        delay = 1000;
        this.setStatus("online");
        if (result.studioName && result.studioName !== this.store.get("studioName")) {
          this.store.set({ studioName: result.studioName });
        }
        for (const job of result.jobs || []) this.enqueue(job);
        const latestSubmittedAt = Math.max(0, ...(result.submissions || []).map((s) => s.submittedAt || 0));
        this.store.set({
          lastSubmissionCheck: since > 0 ? Math.max(since, latestSubmittedAt) : Math.max(result.now || 0, latestSubmittedAt),
        });
        if (
          (this.store.get("pendingExports") || []).length > 0 &&
          Date.now() - this.lastPendingExportRetryAt >= 60_000
        ) {
          this.lastPendingExportRetryAt = Date.now();
          void this.retryPendingExports();
        }
        if (Array.isArray(result.submissions) && result.submissions.length > 0) {
          for (const share of result.submissions) void this.onSubmission(share);
        }
      } catch (error) {
        if (signal.aborted) return;
        if (error instanceof ApiError && error.status === 401) {
          this.abort = null;
          this.store.set({ deviceToken: null });
          this.setStatus("revoked", error.message);
          return;
        }
        first = true;
        const suspended = error instanceof ApiError && error.status === 403;
        this.setStatus(suspended ? "suspended" : "offline", error.message);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay = Math.min(delay * 2, suspended ? 60000 : 30000);
      }
    }
  }

  enqueue(job) {
    const lane = this.isFastJob(job) ? "fast" : "bulk";
    this[`${lane}Queue`].push(job);
    this.drain(lane);
  }

  isFastJob(job) {
    if (job.variant !== "thumb" && job.variant !== "preview") return false;
    const share = this.store.getShare(job.shareId);
    const rel = share && Object.prototype.hasOwnProperty.call(share.files, job.fileKey)
      ? share.files[job.fileKey]
      : null;
    return !!rel && (MIME[extOf(rel)] || "").startsWith("image/");
  }

  drain(lane) {
    const queue = this[`${lane}Queue`];
    const maxActive = lane === "fast" ? 4 : 2;
    while (this[`${lane}Active`] < maxActive && queue.length > 0) {
      const job = queue.shift();
      this[`${lane}Active`] += 1;
      this.serve(job)
        .catch(() => undefined)
        .finally(() => {
          this[`${lane}Active`] -= 1;
          this.drain(lane);
        });
    }
  }

  async serve(job) {
    const client = this.client();
    const notFound = () => client.respond(job.id, { status: 404 });
    const share = this.store.getShare(job.shareId);
    const rel = share && Object.prototype.hasOwnProperty.call(share.files, job.fileKey) ? share.files[job.fileKey] : null;
    const file = rel ? await resolveInside(share.folder, rel) : null;
    if (!file) return notFound();
    const ext = extOf(file);
    const isVideo = (MIME[ext] || "").startsWith("video/");

    if (job.variant === "thumb" || (job.variant === "preview" && !isVideo)) {
      const buffer = await this.images.get(file, job.variant).catch(() => null);
      if (!buffer) return notFound();
      return client.respond(job.id, { status: 200, contentType: "image/jpeg", length: buffer.length, body: buffer });
    }

    const stat = await fsp.stat(file);
    const range = parseRange(job.range, stat.size);
    if (range === "invalid") return client.respond(job.id, { status: 416 });
    const start = range ? range.start : 0;
    const end = range ? range.end : stat.size - 1;
    if (stat.size === 0) return notFound();
    return client.respond(job.id, {
      status: range ? 206 : 200,
      contentType: MIME[ext] || "application/octet-stream",
      length: end - start + 1,
      range: range ? `bytes ${start}-${end}/${stat.size}` : null,
      body: Readable.toWeb(fs.createReadStream(file, { start, end, highWaterMark: 256 * 1024 })),
    });
  }

  async onSubmission(remote) {
    let copied = null;
    if (this.store.get("autoCopyPicks") && this.store.getShare(remote.id)) {
      const pending = this.store.get("pendingExports") || [];
      if (!pending.includes(remote.id)) this.store.set({ pendingExports: [...pending, remote.id] });
      try {
        copied = await this.copyPendingExport(remote.id);
        this.removePendingExport(remote.id);
      } catch (error) {
        copied = { error: error instanceof Error ? error.message : String(error) };
      }
    } else {
      this.removePendingExport(remote.id);
    }
    this.emit("submission", { share: remote, copied });
  }

  async retryPendingExports() {
    for (const shareId of [...(this.store.get("pendingExports") || [])]) {
      if (!this.store.get("autoCopyPicks") || !this.store.getShare(shareId)) {
        this.removePendingExport(shareId);
        continue;
      }
      try {
        await this.copyPendingExport(shareId);
        this.removePendingExport(shareId);
      } catch {
        // Keep failed exports queued for a later retry.
      }
    }
  }

  async copyPendingExport(shareId) {
    if (this.exportingShares.has(shareId)) throw new Error("Lần xuất này đang được xử lý.");
    this.exportingShares.add(shareId);
    try {
      return await this.copyPicks(shareId);
    } finally {
      this.exportingShares.delete(shareId);
    }
  }

  removePendingExport(shareId) {
    const pending = this.store.get("pendingExports") || [];
    if (pending.includes(shareId)) {
      this.store.set({ pendingExports: pending.filter((id) => id !== shareId) });
    }
  }

  async copyPicks(shareId) {
    const share = this.store.getShare(shareId);
    if (!share) throw new Error("Link này không được tạo từ máy tính này.");
    const { picks } = await this.client().picks(shareId);
    if (!picks || picks.length === 0) throw new Error("Khách chưa chọn ảnh nào.");
    return copyPicks(share, picks, this.store.get("picksFolderName"), this.images);
  }

  async previewFolder(folder, options = {}) {
    const stat = await fsp.stat(folder).catch(() => null);
    if (!stat || !stat.isDirectory()) throw new Error("Không mở được thư mục này.");
    const includeAllFiles = options.includeAllFiles === true;
    const files = await scanFolder(folder, "preview", {
      skipDirs: [this.store.get("picksFolderName")],
      includeAllFiles,
    });
    return {
      folder,
      name: path.basename(folder),
      count: files.length,
      bytes: files.reduce((sum, f) => sum + f.size, 0),
      images: files.filter((f) => f.kind === "image").length,
      raws: files.filter((f) => f.kind === "raw").length,
      videos: files.filter((f) => f.kind === "video").length,
      others: files.filter((f) => f.kind === "other").length,
    };
  }

  async createShare(folder, options) {
    if (!this.paired) throw new Error("Chưa kết nối với studio.");
    const real = await fsp.realpath(folder);
    const salt = crypto.randomBytes(16).toString("hex");
    const kind = options.kind === "deliver" ? "deliver" : "select";
    const includeAllFiles = kind === "deliver" && options.includeAllFiles === true;
    const files = await scanFolder(real, salt, {
      skipDirs: [this.store.get("picksFolderName")],
      includeAllFiles,
    });
    if (files.length === 0) {
      throw new Error(includeAllFiles ? "Thư mục không có tệp nào." : "Thư mục không có ảnh hoặc video nào.");
    }
    const result = await this.client().createShare({
      title: options.title || path.basename(real),
      clientName: options.clientName || null,
      message: typeof options.message === "string" ? options.message.slice(0, 1000) : "",
      kind,
      pin: options.pin || null,
      maxSelect: Number(options.maxSelect) || 0,
      allowOriginal: !!options.allowOriginal,
      faceSearch: options.faceSearch === true,
      expiresInDays: Number(options.expiresInDays) || null,
      files: files.map(({ key, name, kind, size }) => ({ key, name, kind, size })),
    });
    this.store.setShare(result.id, {
      folder: real,
      salt,
      files: Object.fromEntries(files.map((f) => [f.key, f.rel])),
      includeAllFiles,
      faceSearch: options.faceSearch === true,
    });
    if (options.faceSearch === true) {
      void this.indexFaceFiles(result.id, files).catch(() => undefined);
    }
    return { id: result.id, url: result.url, count: files.length };
  }

  async rescanShare(shareId) {
    const share = this.store.getShare(shareId);
    if (!share) throw new Error("Link này không được tạo từ máy tính này.");
    const includeAllFiles = share.includeAllFiles === true;
    const files = await scanFolder(share.folder, share.salt, {
      skipDirs: [this.store.get("picksFolderName")],
      includeAllFiles,
    });
    if (files.length === 0) {
      throw new Error(includeAllFiles ? "Thư mục không còn tệp nào." : "Thư mục không còn ảnh hoặc video nào.");
    }
    await this.client().replaceFiles(shareId, files.map(({ key, name, kind, size }) => ({ key, name, kind, size })));
    this.store.setShare(shareId, { ...share, files: Object.fromEntries(files.map((f) => [f.key, f.rel])) });
    if (share.faceSearch) void this.indexFaceFiles(shareId, files).catch(() => undefined);
    return { count: files.length };
  }

  async listShares() {
    const { shares } = await this.client().listShares();
    this.remoteShares = shares || [];
    for (const remote of this.remoteShares) {
      const local = this.store.getShare(remote.id);
      if (!local) continue;
      const faceSearch = remote.faceSearch === true;
      if (local.faceSearch === faceSearch) continue;
      this.store.setShare(remote.id, { ...local, faceSearch });
      if (faceSearch) void this.indexLocalFaceShare(remote.id).catch(() => undefined);
      else this.faceIndexer?.cancelShare(remote.id);
    }
    return this.remoteShares.map((s) => {
      const local = this.store.getShare(s.id);
      return { ...s, folder: local ? local.folder : null, folderName: local ? path.basename(local.folder) : null };
    });
  }

  async updateShare(shareId, patch) {
    const result = await this.client().updateShare(shareId, patch);
    const local = this.store.getShare(shareId);
    if (local && typeof patch.faceSearch === "boolean" && local.faceSearch !== patch.faceSearch) {
      const updated = { ...local, faceSearch: patch.faceSearch };
      this.store.setShare(shareId, updated);
      if (patch.faceSearch) void this.indexLocalFaceShare(shareId).catch(() => undefined);
      else this.faceIndexer?.cancelShare(shareId);
    }
    return result;
  }

  async deleteShare(shareId) {
    await this.client().deleteShare(shareId);
    this.store.deleteShare(shareId);
  }
}

module.exports = { DriveAgent, parseRange };
