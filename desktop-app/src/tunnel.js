const fs = require("node:fs/promises");
const path = require("node:path");
const { constants, createWriteStream } = require("node:fs");
const { spawn, execFile } = require("node:child_process");
const { EventEmitter } = require("node:events");
const { promisify } = require("node:util");
const { Readable, Transform } = require("node:stream");
const { pipeline } = require("node:stream/promises");

function parseQuickUrl(text) {
  for (const value of text.match(/https:\/\/[^\s|│]+/g) || []) {
    try {
      const url = new URL(value);
      if (
        /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.trycloudflare\.com$/i.test(url.hostname) &&
        !url.username &&
        !url.password &&
        !url.port
      )
        return url.origin;
    } catch {
      /* Incomplete output chunk. */
    }
  }
  return null;
}

function cloudflaredAsset(platform = process.platform, arch = process.arch) {
  if (!["arm64", "x64"].includes(arch))
    throw new Error("Cloudflared chỉ hỗ trợ CPU x64 hoặc arm64.");
  const cpu = arch === "x64" ? "amd64" : "arm64";
  if (platform === "darwin") return `cloudflared-darwin-${cpu}.tgz`;
  if (platform === "win32") return "cloudflared-windows-amd64.exe";
  if (platform === "linux") return `cloudflared-linux-${cpu}`;
  throw new Error("Hệ điều hành chưa được hỗ trợ.");
}

async function locateCloudflared(config, directory) {
  const executable = process.platform === "win32" ? "cloudflared.exe" : "cloudflared";
  const candidates = [
    config.tunnel.cloudflaredPath,
    path.join(directory, "bin", executable),
    ...(process.env.PATH || "")
      .split(path.delimiter)
      .filter(Boolean)
      .map((folder) => path.join(folder, executable)),
  ];
  for (const candidate of candidates.filter(Boolean)) {
    try {
      if (!(await fs.stat(candidate)).isFile()) continue;
      await fs.access(candidate, process.platform === "win32" ? constants.F_OK : constants.X_OK);
      return path.resolve(candidate);
    } catch {
      /* Try the next installation location. */
    }
  }
  return null;
}

async function downloadCloudflared(directory, signal) {
  const bin = path.join(directory, "bin");
  await fs.mkdir(bin, { recursive: true, mode: 0o700 });
  const temporary = await fs.mkdtemp(path.join(bin, ".download-"));
  const asset = cloudflaredAsset();
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timeout = setTimeout(() => controller.abort(), 120000);
  try {
    const response = await fetch(
      `https://github.com/cloudflare/cloudflared/releases/latest/download/${asset}`,
      { signal: controller.signal },
    );
    if (!response.ok || !response.body)
      throw new Error(`Không tải được cloudflared (HTTP ${response.status}).`);
    const archive = path.join(temporary, asset);
    let bytes = 0;
    const limit = new Transform({
      transform(chunk, _encoding, done) {
        bytes += chunk.length;
        done(
          bytes > 256 * 1024 * 1024 ? new Error("Tệp cloudflared vượt giới hạn 256 MB.") : null,
          chunk,
        );
      },
    });
    await pipeline(
      Readable.fromWeb(response.body),
      limit,
      createWriteStream(archive, { flags: "wx", mode: 0o600 }),
      { signal: controller.signal },
    );
    const name = process.platform === "win32" ? "cloudflared.exe" : "cloudflared";
    let source = archive;
    if (asset.endsWith(".tgz")) {
      await promisify(execFile)("tar", ["-xzf", archive, "-C", temporary, "cloudflared"], {
        timeout: 30000,
      });
      source = path.join(temporary, "cloudflared");
    }
    await fs.chmod(source, 0o700);
    const destination = path.join(bin, name);
    await fs.rename(source, destination);
    return destination;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("Tải cloudflared quá thời gian chờ.");
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
    await fs.rm(temporary, { recursive: true, force: true });
  }
}

class TunnelManager extends EventEmitter {
  constructor(config, directory, port) {
    super();
    Object.assign(this, {
      config,
      directory,
      port,
      status: "stopped",
      origin: null,
      stopped: true,
      attempt: 0,
    });
  }
  publish(status, origin = null, message = "") {
    this.status = status;
    this.origin = origin;
    this.emit("status", { status, origin, message });
  }
  async start() {
    if (!this.stopped) return;
    this.stopped = false;
    this.abort = new AbortController();
    this.attempt = 0;
    if (
      this.config.tunnel.mode === "named" &&
      (!this.config.tunnel.namedToken || !this.config.tunnel.namedHostname)
    ) {
      this.stopped = true;
      throw new Error("Tunnel riêng cần namedToken và namedHostname.");
    }
    await this.launch();
  }
  async launch() {
    if (this.stopped) return;
    this.publish("starting");
    try {
      this.executable ||=
        (await locateCloudflared(this.config, this.directory)) ||
        (await downloadCloudflared(this.directory, this.abort.signal));
      if (this.stopped) return;
      const named = this.config.tunnel.mode === "named";
      const args = named
        ? ["tunnel", "--no-autoupdate", "run", "--token", this.config.tunnel.namedToken]
        : ["tunnel", "--no-autoupdate", "--url", `http://127.0.0.1:${this.port}`];
      const child = spawn(this.executable, args, {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      this.child = child;
      let buffer = "";
      let candidate = named ? `https://${this.config.tunnel.namedHostname}` : null;
      let registered = false;
      let completed = false;
      let connectedAt = 0;
      const readyTimeout = setTimeout(() => {
        this.publish("error", null, "Tunnel không kết nối được sau 60 giây.");
        child.kill();
      }, 60000);
      const inspect = (data) => {
        buffer = (buffer + data.toString()).slice(-16384);
        if (!named) candidate = parseQuickUrl(buffer) || candidate;
        if (/Registered tunnel connection/i.test(buffer)) registered = true;
        if (candidate && registered && !connectedAt && !this.stopped) {
          connectedAt = Date.now();
          clearTimeout(readyTimeout);
          this.publish("connected", candidate);
        }
      };
      child.stdout.on("data", inspect);
      child.stderr.on("data", inspect);
      const exited = () => {
        if (completed) return;
        completed = true;
        clearTimeout(readyTimeout);
        if (this.child === child) this.child = null;
        if (this.stopped) return;
        if (connectedAt && Date.now() - connectedAt >= 60000) this.attempt = 0;
        this.retry("Cloudflared đã dừng. Đang thử kết nối lại.");
      };
      child.once("error", exited);
      child.once("exit", exited);
    } catch {
      if (!this.stopped)
        this.retry("Không khởi động được cloudflared. Kiểm tra mạng hoặc tunnel.cloudflaredPath.");
    }
  }
  retry(message) {
    this.publish("error", null, message);
    const delay = Math.min(60000, 1000 * 2 ** Math.min(this.attempt++, 6));
    this.timer = setTimeout(() => this.launch(), delay);
  }
  async stop() {
    this.stopped = true;
    this.abort?.abort();
    clearTimeout(this.timer);
    const child = this.child;
    if (child) {
      await new Promise((resolve) => {
        const kill = setTimeout(() => {
          child.kill("SIGKILL");
          resolve();
        }, 5000);
        child.once("exit", () => {
          clearTimeout(kill);
          resolve();
        });
        child.kill();
      });
    }
    this.publish("stopped");
  }
}

module.exports = {
  parseQuickUrl,
  cloudflaredAsset,
  locateCloudflared,
  downloadCloudflared,
  TunnelManager,
};
