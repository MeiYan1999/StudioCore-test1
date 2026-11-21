const fs = require("node:fs/promises");
const path = require("node:path");
const http = require("node:http");
const { randomBytes } = require("node:crypto");
const { Agent } = require("./agent");
const { AgentApi } = require("./api");
const { atomicWrite, validateConfig } = require("./store");
const { validSecret } = require("./media");
const { downloadCloudflared, locateCloudflared } = require("./tunnel");
const { planFilter, copyFilter } = require("./filter");
const integration = require("./os-integration");

function failure(status, message) {
  return Object.assign(new Error(message), { status });
}
async function readBody(request) {
  if (request.headers["content-type"]?.split(";")[0].trim().toLowerCase() !== "application/json")
    throw failure(415, "Chỉ chấp nhận JSON.");
  const chunks = await new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    const cleanup = () => {
      request.removeListener("data", data);
      request.removeListener("end", end);
      request.removeListener("error", error);
      request.removeListener("aborted", aborted);
    };
    const error = (error) => {
      cleanup();
      reject(error);
    };
    const aborted = () => error(failure(400, "Yêu cầu đã đóng."));
    const data = (chunk) => {
      size += chunk.length;
      if (size > 256 * 1024) {
        cleanup();
        request.resume();
        reject(failure(413, "Dữ liệu quá lớn."));
      } else chunks.push(chunk);
    };
    const end = () => {
      cleanup();
      resolve(chunks);
    };
    request.on("data", data);
    request.once("end", end);
    request.once("error", error);
    request.once("aborted", aborted);
  });
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body;
  } catch {
    throw failure(400, "JSON không hợp lệ.");
  }
}
async function installToken(store) {
  const file = path.join(store.directory, "gui-token");
  try {
    await fs.writeFile(file, randomBytes(32).toString("hex"), { flag: "wx", mode: 0o600 });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  await fs.chmod(file, 0o600);
  const token = (await fs.readFile(file, "utf8")).trim();
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error("Token GUI bị hỏng.");
  return token;
}
class DesktopApp {
  constructor(store, { noTunnel = false } = {}) {
    this.store = store;
    this.noTunnel = noTunnel;
    this.connection = { status: "unconfigured" };
    this.tunnel = { status: "stopped", origin: null };
    this.notifications = store.read("notifications.json", []);
    if (!Array.isArray(this.notifications)) this.notifications = [];
    this.serial = Promise.resolve();
  }
  async startAgent() {
    if (this.agent) await this.agent.stop();
    const agent = new Agent(this.store);
    this.agent = agent;
    agent.on("connection", (state) => {
      if (this.agent === agent) this.connection = state;
    });
    agent.on("tunnel", (state) => {
      if (this.agent === agent) this.tunnel = state;
    });
    agent.on("warning", (message) => {
      this.warning = message;
    });
    agent.on("finalized", (event) =>
      this.onFinalize(event).catch((error) => {
        this.warning = error.message;
      }),
    );
    this.connection = { status: agent.config.connectKey ? "connecting" : "unconfigured" };
    this.tunnel = { status: this.noTunnel ? "development" : "stopped", origin: null };
    if (!agent.config.connectKey) return;
    try {
      await agent.start({ noTunnel: this.noTunnel });
      if (this.noTunnel) this.tunnel.origin = agent.origin;
    } catch (error) {
      this.connection = { status: "error", message: error.message };
    }
  }
  async onFinalize({ shareId, selection }) {
    const share = this.store.loadShares().find((item) => item.id === shareId);
    const item = {
      id: randomBytes(12).toString("hex"),
      shareId,
      title: share?.title || shareId,
      time: new Date().toISOString(),
      read: false,
    };
    this.notifications.unshift(item);
    this.notifications = this.notifications.slice(0, 100);
    this.saveNotifications();
    const config = this.store.loadConfig();
    if (config.filter.notifyOnFinalize) void integration.notify("Khách đã chốt ảnh", item.title);
    if (config.filter.autoCopyOnFinalize && share)
      await copyFilter(
        await this.filterInput(
          {
            shareId,
            source: share.rootPath,
            mode: config.filter.mode,
            outputName: config.filter.outputName,
          },
          selection,
        ),
      );
  }
  saveNotifications() {
    atomicWrite(path.join(this.store.directory, "notifications.json"), this.notifications);
  }
  async filterInput(input, selection) {
    const config = this.store.loadConfig();
    if (!input.shareId)
      return { ...input, outputName: input.outputName || config.filter.outputName };
    const share = this.store.loadShares().find((item) => item.id === input.shareId);
    if (!share) throw failure(404, "Không tìm thấy album cục bộ.");
    selection ||= await this.agent.api.selection(share.id);
    const result = selection.selection || selection;
    const liked = result.items.filter((item) => item.liked);
    return {
      ...input,
      source: input.source || share.rootPath,
      codes: liked.map((item) => item.code),
      notes: Object.fromEntries(
        result.items.filter((item) => item.note).map((item) => [item.code, item.note]),
      ),
      title: share.title,
      customer: share.customerName,
      outputName: input.outputName || config.filter.outputName,
    };
  }
  async state() {
    const config = this.store.loadConfig();
    let usage = 0;
    for (const name of await fs.readdir(path.join(this.store.directory, "cache")).catch(() => [])) {
      usage += (
        await fs.stat(path.join(this.store.directory, "cache", name)).catch(() => ({ size: 0 }))
      ).size;
    }
    return {
      config,
      shares: this.store
        .loadShares()
        .map(({ mediaSecret, files, previews, ...share }) => ({
          ...share,
          fileCount: Object.keys(files).length,
        })),
      connection: this.connection,
      tunnel: this.tunnel,
      warning: this.warning,
      notifications: this.notifications,
      cacheBytes: usage,
      cloudflared: Boolean(await locateCloudflared(config, this.store.directory)),
    };
  }
  async dispatch(route, method, body) {
    if (route === "/api/ping" && method === "GET")
      return { app: "StudioCoreDrive", pid: process.pid };
    if (route === "/api/state" && method === "GET") return this.state();
    if (route === "/api/logs" && method === "GET") {
      const data = (
        await Promise.all(
          ["access.jsonl.1", "access.jsonl"].map((name) =>
            fs.readFile(path.join(this.store.directory, name), "utf8").catch((error) => {
              if (error.code === "ENOENT") return "";
              throw error;
            }),
          ),
        )
      ).join("\n");
      const titles = new Map(this.store.loadShares().map((share) => [share.id, share.title]));
      return {
        entries: data
          .trim()
          .split("\n")
          .slice(-300)
          .flatMap((line) => {
            try {
              const entry = JSON.parse(line);
              return [{ ...entry, title: titles.get(entry.shareId) || entry.shareId }];
            } catch {
              return [];
            }
          })
          .reverse(),
      };
    }
    if (method !== "POST") throw failure(404, "Không tìm thấy.");
    if (route === "/api/shutdown") {
      setImmediate(() => this.stop().catch(() => {}));
      return { stopped: true };
    }
    if (route === "/api/settings") {
      const previous = this.store.loadConfig();
      const config = validateConfig(body);
      if (config.autoStart !== previous.autoStart) await integration.autoStart(config.autoStart);
      this.store.saveConfig(config);
      await this.startAgent();
      return { saved: true };
    }
    if (route === "/api/test") {
      const config = validateConfig(body);
      return new AgentApi(config).heartbeat({
        name: config.deviceName,
        tunnelOrigin: null,
        os: process.platform,
        appVersion: "2.0.0",
      });
    }
    if (route === "/api/picker") return { path: await integration.pickPath(body.kind) };
    if (route === "/api/open") {
      const value = String(body.path || "");
      if (/^https?:\/\//.test(value)) {
        const url = new URL(value);
        if (url.origin !== new URL(this.store.loadConfig().serverUrl).origin)
          throw failure(400, "Chỉ mở link của máy chủ đã cấu hình.");
      } else {
        if (!path.isAbsolute(value)) throw failure(400, "Cần đường dẫn tuyệt đối.");
        await fs.access(value);
      }
      await integration.openPath(value);
      return { opened: true };
    }
    if (route === "/api/handoff") {
      if (
        !path.isAbsolute(body.path || "") ||
        !["album", "view", "folder", "video"].includes(body.kind)
      )
        throw failure(400, "Nguồn hoặc loại chia sẻ không hợp lệ.");
      this.handoff = { path: body.path, kind: body.kind, id: randomBytes(8).toString("hex") };
      return { hash: `#create?path=${encodeURIComponent(body.path)}&kind=${body.kind}` };
    }
    if (route === "/api/shares") {
      const existing = this.store
        .loadShares()
        .filter(
          (share) =>
            path.resolve(share.rootPath) === path.resolve(body.path || "") &&
            share.kind === body.kind &&
            share.status !== "revoked",
        );
      if (existing.length && !body.force)
        return { duplicates: existing.map(({ id, title, url }) => ({ id, title, url })) };
      return { share: await this.agent.createShare(body.path, body.kind, body) };
    }
    if (route === "/api/share-action") {
      const local = this.store.loadShares().find((share) => share.id === body.id);
      if (!local) throw failure(404, "Không tìm thấy album.");
      if (body.action === "selection") return this.agent.api.selection(body.id);
      if (body.action === "reopen") await this.agent.api.reopen(body.id);
      else if (body.action === "delete") await this.agent.api.deleteShare(body.id);
      else if (["active", "paused"].includes(body.action))
        await this.agent.api.patchShare(body.id, body.action);
      else throw failure(400, "Thao tác không hợp lệ.");
      await this.agent.poll();
      return { saved: true };
    }
    if (route === "/api/filter/preview") return planFilter(await this.filterInput(body));
    if (route === "/api/filter/copy") return copyFilter(await this.filterInput(body));
    if (route === "/api/notifications/read") {
      this.notifications.forEach((item) => {
        item.read = true;
      });
      this.saveNotifications();
      return { saved: true };
    }
    if (route === "/api/cache/clear") {
      await this.agent.cache.clearCache();
      return { cleared: true };
    }
    if (route === "/api/context") {
      await integration.contextMenu(Boolean(body.install));
      return { saved: true };
    }
    if (route === "/api/tunnel") {
      if (body.action === "download") {
        await downloadCloudflared(this.store.directory);
        return { saved: true };
      }
      if (body.action === "stop") {
        await this.agent.tunnel?.stop();
        return { saved: true };
      }
      if (["start", "restart"].includes(body.action)) {
        await this.startAgent();
        return { saved: true };
      }
    }
    throw failure(404, "Không tìm thấy thao tác.");
  }
  async start(port = 3888) {
    const lock = path.join(this.store.directory, "gui-instance.lock");
    const takeLock = async () => {
      const handle = await fs.open(lock, "wx", 0o600);
      await handle.writeFile(String(process.pid));
      await handle.close();
      this.lock = lock;
    };
    try {
      await takeLock();
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      const pid = Number(await fs.readFile(lock, "utf8"));
      let alive = true;
      if (Number.isInteger(pid) && pid > 0) {
        try {
          process.kill(pid, 0);
        } catch (failure) {
          if (failure.code === "ESRCH") alive = false;
        }
      } else alive = Date.now() - (await fs.stat(lock)).mtimeMs < 30000;
      if (alive) throw error;
      await fs.unlink(lock);
      await takeLock();
    }
    this.token = await installToken(this.store);
    this.server = http.createServer(async (request, response) => {
      response.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
      );
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.setHeader("Referrer-Policy", "no-referrer");
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("X-Frame-Options", "DENY");
      try {
        const host = request.headers.host;
        if (![`127.0.0.1:${this.port}`, `localhost:${this.port}`].includes(host))
          throw failure(403, "Host không hợp lệ.");
        const url = new URL(request.url, `http://${host}`);
        let result;
        if (url.pathname.startsWith("/api/")) {
          if (!validSecret(this.token, String(request.headers["x-sc-token"] || "")))
            throw failure(401, "Token không hợp lệ.");
          if (
            request.method !== "GET" &&
            request.headers.origin &&
            request.headers.origin !== `http://${host}`
          )
            throw failure(403, "Origin không hợp lệ.");
          const body = request.method === "GET" ? {} : await readBody(request);
          if (request.method === "GET")
            result = await this.dispatch(url.pathname, request.method, body);
          else {
            const work = this.serial.then(() => this.dispatch(url.pathname, request.method, body));
            this.serial = work.catch(() => {});
            result = await work;
          }
          response.setHeader("Content-Type", "application/json; charset=utf-8");
          response.end(JSON.stringify(result));
        } else {
          if (request.method !== "GET" || !["/", "/app.js", "/style.css"].includes(url.pathname))
            throw failure(404, "Không tìm thấy.");
          const file = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
          let data = await fs.readFile(path.join(__dirname, "ui", file), "utf8");
          if (file === "index.html") data = data.replace("__SC_TOKEN__", this.token);
          response.setHeader(
            "Content-Type",
            file.endsWith("html")
              ? "text/html; charset=utf-8"
              : file.endsWith("js")
                ? "text/javascript; charset=utf-8"
                : "text/css; charset=utf-8",
          );
          response.end(data);
        }
      } catch (error) {
        response.statusCode = error.status || 400;
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.end(JSON.stringify({ error: error.message }));
      }
    });
    this.server.requestTimeout = 15000;
    this.server.headersTimeout = 10000;
    for (let attempt = 0; ; attempt++) {
      try {
        await new Promise((resolve, reject) => {
          this.server.once("error", reject);
          this.server.listen(port + attempt, "127.0.0.1", () => {
            this.server.removeListener("error", reject);
            resolve();
          });
        });
        break;
      } catch (error) {
        if (error.code !== "EADDRINUSE" || attempt >= 99 || port === 0) throw error;
      }
    }
    this.port = this.server.address().port;
    atomicWrite(path.join(this.store.directory, "gui.json"), { port: this.port, pid: process.pid });
    this.ready = this.startAgent();
    return this.port;
  }
  async stop() {
    if (this.stopping) return this.stopping;
    this.stopping = this.close();
    return this.stopping;
  }
  async close() {
    await this.serial;
    await this.agent?.stop();
    await this.ready;
    if (this.server?.listening)
      await new Promise((resolve) => {
        this.server.close(resolve);
        this.server.closeAllConnections?.();
      });
    const state = this.store.read("gui.json", null);
    if (state?.pid === process.pid && state?.port === this.port)
      await fs.unlink(path.join(this.store.directory, "gui.json")).catch(() => {});
    if (this.lock) await fs.unlink(this.lock).catch(() => {});
  }
}
module.exports = { DesktopApp, installToken, readBody };
