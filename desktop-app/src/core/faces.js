"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { Worker } = require("node:worker_threads");
const { EventEmitter } = require("node:events");

function defaultModelDir() {
  const packaged = process.resourcesPath && path.join(process.resourcesPath, "drive-face-models");
  if (packaged && fs.existsSync(packaged)) return packaged;
  return path.resolve(__dirname, "../../../public/drive-face-models");
}

class FaceEngine {
  constructor({ modelDir = defaultModelDir(), workerPath = path.join(__dirname, "face-worker.js") } = {}) {
    this.modelDir = modelDir;
    this.workerPath = workerPath;
    this.worker = null;
    this.ready = null;
    this.resolveReady = null;
    this.rejectReady = null;
    this.pending = new Map();
    this.nextId = 0;
  }

  start() {
    if (this.ready) return this.ready;

    let resolveReady;
    let rejectReady;
    this.ready = new Promise((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });
    const readyPromise = this.ready;
    this.resolveReady = resolveReady;
    this.rejectReady = rejectReady;
    let worker;
    try {
      worker = new Worker(this.workerPath, { workerData: { modelDir: this.modelDir } });
    } catch (error) {
      this.fail(error);
      return readyPromise;
    }
    this.worker = worker;
    worker.on("message", (message) => {
      if (message.type === "ready") {
        this.resolveReady?.();
        this.resolveReady = null;
        this.rejectReady = null;
      } else if (message.type === "init-error") {
        this.fail(new Error(message.error));
      } else if (message.type === "result") {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error));
        else pending.resolve(message.faces);
      }
    });
    worker.on("error", (error) => this.fail(error));
    worker.on("exit", (code) => {
      if (this.worker === worker) this.fail(new Error(`Face worker exited (${code}).`));
    });
    return readyPromise;
  }

  fail(error) {
    const worker = this.worker;
    this.rejectReady?.(error);
    this.worker = null;
    this.ready = null;
    this.resolveReady = null;
    this.rejectReady = null;
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
    if (worker) void worker.terminate();
  }

  async describe(jpegBuffer) {
    await this.start();
    const id = ++this.nextId;
    const buffer = Uint8Array.from(jpegBuffer).buffer;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ type: "describe", id, buffer }, [buffer]);
    });
  }

  async close() {
    const worker = this.worker;
    const error = new Error("Face worker stopped.");
    this.rejectReady?.(error);
    this.worker = null;
    this.ready = null;
    this.resolveReady = null;
    this.rejectReady = null;
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
    if (worker) await worker.terminate();
  }
}

function validFaces(value) {
  return (
    Array.isArray(value) &&
    value.every(
      (face) =>
        Array.isArray(face) &&
        face.length === 128 &&
        face.every((number) => typeof number === "number" && Number.isFinite(number) && Math.abs(number) <= 2),
    )
  );
}

class FaceIndexer extends EventEmitter {
  constructor({ engine = new FaceEngine(), images, cacheDir }) {
    super();
    if (!images || !cacheDir) throw new TypeError("FaceIndexer needs images and cacheDir.");
    this.engine = engine;
    this.images = images;
    this.cacheDir = cacheDir;
    this.queue = Promise.resolve();
    this.controllers = new Map();
    this.generation = 0;
  }

  indexShare(shareId, files, upload, signal) {
    const eligible = files.filter(
      (file) => (file.kind === "image" || file.kind === "raw") && typeof file.path === "string" && file.key,
    );
    const generation = this.generation;
    const controller = new AbortController();
    let controllers = this.controllers.get(shareId);
    if (!controllers) {
      controllers = new Set();
      this.controllers.set(shareId, controllers);
    }
    controllers.add(controller);

    const task = this.queue
      .catch(() => undefined)
      .then(() => this.runShare(shareId, eligible, upload, controller, signal, generation));
    this.queue = task.catch(() => undefined);
    return task.finally(() => {
      controllers.delete(controller);
      if (controllers.size === 0) this.controllers.delete(shareId);
    });
  }

  async cachedFaces(file, stat) {
    const key = crypto
      .createHash("sha256")
      .update(`${file.path}\n${stat.mtimeMs}\n${stat.size}`)
      .digest("hex");
    const cacheFile = path.join(this.cacheDir, `${key}.json`);
    try {
      const cached = JSON.parse(await fsp.readFile(cacheFile, "utf8"));
      if (validFaces(cached)) return { cacheFile, faces: cached };
    } catch {
      // Missing or invalid cache entries are recomputed.
    }
    return { cacheFile, faces: null };
  }

  async runShare(shareId, files, upload, controller, signal, generation) {
    const total = files.length;
    let done = 0;
    let batch = [];
    const stopped = () =>
      controller.signal.aborted || signal?.aborted || generation !== this.generation;
    this.emit("progress", { shareId, done, total });
    try {
      for (const file of files) {
        if (stopped()) break;
        let faces;
        try {
          const stat = await fsp.stat(file.path);
          const cached = await this.cachedFaces(file, stat);
          faces = cached.faces;
          if (faces === null) {
            const preview = await this.images.get(file.path, "preview");
            if (!preview) throw new Error("Không tạo được ảnh xem trước.");
            faces = await this.engine.describe(preview);
            if (!validFaces(faces)) throw new Error("Face engine returned invalid descriptors.");
            await fsp.mkdir(this.cacheDir, { recursive: true });
            const temporary = `${cached.cacheFile}.${process.pid}.${crypto.randomUUID()}.tmp`;
            try {
              await fsp.writeFile(temporary, JSON.stringify(faces));
              await fsp.rename(temporary, cached.cacheFile);
            } catch (error) {
              await fsp.rm(temporary, { force: true }).catch(() => undefined);
              throw error;
            }
          }
        } catch {
          if (stopped()) break;
          done += 1;
          this.emit("progress", { shareId, done, total });
          continue;
        }
        if (stopped()) break;
        batch.push({ key: file.key, faces });
        done += 1;
        this.emit("progress", { shareId, done, total });
        if (batch.length === 25) {
          await upload(shareId, batch);
          batch = [];
        }
      }
      if (!stopped() && batch.length > 0) await upload(shareId, batch);
    } finally {
      this.emit("progress", { shareId, done: total, total });
    }
  }

  cancelShare(shareId) {
    for (const controller of this.controllers.get(shareId) || []) controller.abort();
  }

  stop() {
    this.generation += 1;
    for (const controllers of this.controllers.values()) {
      for (const controller of controllers) controller.abort();
    }
    this.controllers.clear();
    return this.engine.close();
  }
}

module.exports = { FaceEngine, FaceIndexer, defaultModelDir };
