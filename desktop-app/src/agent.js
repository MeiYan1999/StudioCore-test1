const os = require("node:os");
const path = require("node:path");
const { EventEmitter } = require("node:events");
const { Store } = require("./store");
const { scan } = require("./scanner");
const { AgentApi } = require("./api");
const { PreviewCache } = require("./previews");
const { createMediaServer } = require("./media");
const { TunnelManager } = require("./tunnel");

class Agent extends EventEmitter {
  constructor(store = new Store(), options = {}) {
    super();
    this.store = store;
    this.config = store.loadConfig();
    this.api = options.api || new AgentApi(this.config);
    this.cache = options.cache || new PreviewCache(store.directory, this.config.cache);
    this.stopped = true;
    this.origin = null;
  }
  async createShare(target, kind, options = {}) {
    const scanned = await scan(target, kind, this.config.filter.outputName);
    const settings = this.config.defaults;
    const { share } = await this.api.createShare({
      kind,
      title: options.title || path.basename(path.resolve(target)),
      customerName: options.customer || undefined,
      folderName: scanned.folderName,
      pin: (options.pin ?? settings.pin) || undefined,
      allowOriginals: options.allowOriginals ?? settings.allowOriginals,
      maxSelect: kind === "album" ? (options.maxSelect ?? settings.maxSelect) : undefined,
      expiresInDays: options.expiresDays ?? settings.expiresDays,
      files: scanned.files,
    });
    this.store.updateShares((shares) => [
      ...shares,
      {
        id: share.id,
        kind,
        title: share.title,
        rootPath: scanned.rootPath,
        mediaSecret: share.mediaSecret,
        allowOriginals: share.allowOriginals,
        rawDownload: options.rawDownload || settings.rawDownload,
        status: share.status,
        expiresAt: share.expiresAt,
        selectionStatus: share.selectionStatus,
        url: share.url,
        pin: (options.pin ?? settings.pin) || "",
        customerName: share.customerName || options.customer || "",
        createdAt: new Date().toISOString(),
        maxSelect: share.maxSelect,
        fileCount: scanned.files.length,
        files: scanned.mapping,
        previews: scanned.previews,
      },
    ]);
    return { id: share.id, url: share.url, title: share.title, fileCount: scanned.files.length };
  }
  async heartbeat() {
    if (this.heartbeatTask) return this.heartbeatTask;
    this.heartbeatTask = this.api.heartbeat({
      name: this.config.deviceName,
      os: `${process.platform} ${os.release()}`,
      appVersion: "2.0.0",
      tunnelOrigin: this.origin,
    });
    try {
      const result = await this.heartbeatTask;
      this.emit("connection", { status: "connected", ...result });
      return result;
    } catch (error) {
      this.emit("connection", { status: "error", message: error.message });
      throw error;
    } finally {
      this.heartbeatTask = null;
    }
  }
  async poll() {
    if (this.pollTask) return this.pollTask;
    this.pollTask = this.syncShares();
    try {
      await this.pollTask;
    } finally {
      this.pollTask = null;
    }
  }
  async syncShares() {
    const before = this.store.loadShares();
    const known = new Set(before.map((share) => share.id));
    const { shares } = await this.api.listShares();
    const remote = new Map(shares.map((share) => [share.id, share]));
    const finalized = new Map();
    for (const local of before) {
      const current = remote.get(local.id);
      if (
        current?.selectionStatus === "finalized" &&
        (local.selectionStatus !== "finalized" || local.lastFinalizedAt !== current.finalizedAt)
      ) {
        try {
          finalized.set(local.id, await this.api.selection(local.id));
        } catch (error) {
          this.emit("warning", error.message);
        }
      }
    }
    this.store.updateShares((local) =>
      local.map((share) => {
        const current = remote.get(share.id);
        if (!current) return known.has(share.id) ? { ...share, status: "revoked" } : share;
        return {
          ...share,
          status: current.status,
          expiresAt: current.expiresAt,
          allowOriginals: current.allowOriginals,
          selectionStatus: current.selectionStatus,
          finalizedAt: current.finalizedAt,
          lastFinalizedAt: finalized.has(share.id) ? current.finalizedAt : share.lastFinalizedAt,
          title: current.title,
          customerName: current.customerName,
          url: current.url,
          maxSelect: current.maxSelect,
          likedCount: current.likedCount,
          pinProtected: current.pinProtected,
          createdAt: current.createdAt,
        };
      }),
    );
    for (const [shareId, selection] of finalized) this.emit("finalized", { shareId, selection });
  }
  async start({ noTunnel = false } = {}) {
    if (!this.stopped) return;
    if (!this.config.connectKey)
      throw new Error("Vui lòng thiết lập connectKey trong config.json.");
    if (
      noTunnel &&
      (process.env.NODE_ENV === "production" ||
        !["localhost", "127.0.0.1", "[::1]"].includes(new URL(this.config.serverUrl).hostname))
    )
      throw new Error("--no-tunnel chỉ dành cho máy chủ localhost khi phát triển.");
    this.stopped = false;
    try {
      await this.cache.cleanup();
      if (this.stopped) return;
      this.media = createMediaServer({
        store: this.store,
        cache: this.cache,
        port: this.config.mediaPort,
      });
      this.port = await this.media.start();
      this.emit("media", { port: this.port });
      if (noTunnel) this.origin = `http://127.0.0.1:${this.port}`;
      await this.heartbeat();
      if (this.stopped) return;
      await this.poll();
      if (this.stopped) return;
      const safely = (work) => work().catch((error) => this.emit("warning", error.message));
      this.heartbeatTimer = setInterval(() => safely(() => this.heartbeat()), 30000);
      this.pollTimer = setInterval(() => safely(() => this.poll()), 60000);
      this.cleanupTimer = setInterval(
        () => safely(() => this.cache.cleanup()),
        12 * 60 * 60 * 1000,
      );
      if (!noTunnel) {
        this.tunnel = new TunnelManager(this.config, this.store.directory, this.port);
        this.tunnel.on("status", (state) => {
          this.origin = state.origin;
          this.emit("tunnel", state);
          if (!this.stopped) safely(() => this.heartbeat());
        });
        await this.tunnel.start();
      }
    } catch (error) {
      await this.stop();
      throw error;
    }
  }
  async stop() {
    if (this.stopped) return;
    this.stopped = true;
    clearInterval(this.heartbeatTimer);
    clearInterval(this.pollTimer);
    clearInterval(this.cleanupTimer);
    await this.tunnel?.stop();
    await Promise.allSettled([this.heartbeatTask, this.pollTask]);
    this.origin = null;
    await this.heartbeat().catch((error) => this.emit("warning", error.message));
    if (this.media?.server.listening) await this.media.stop();
  }
}

module.exports = { Agent };
