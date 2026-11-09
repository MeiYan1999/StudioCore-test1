const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const https = require("node:https");
const { scanFolder } = require("./scanner");
const { autoFilterRawFiles } = require("./raw-filter");

const CONFIG_DIR = path.join(os.homedir(), ".studiocore-drive");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

function loadConfig() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  let cfg = null;
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    } catch {
      // Fallback
    }
  }

  if (!cfg) {
    cfg = {
      serverUrl: "https://www.studiocore.io.vn",
      connectKey: "sc_drive_live_tenant_demo_984f7b2e1a",
      hostname: os.hostname(),
      os: process.platform === "win32" ? "windows" : process.platform === "darwin" ? "macos" : "linux",
      shares: [],
      autoFilterRaw: true,
      chimeSound: true,
    };
    saveConfig(cfg);
    return cfg;
  }

  // Deduplicate and ensure status
  let modified = false;
  if (Array.isArray(cfg.shares)) {
    const seen = new Set();
    const deduped = [];
    for (let i = cfg.shares.length - 1; i >= 0; i--) {
      const s = cfg.shares[i];
      if (!s || !s.localPath) continue;
      const key = s.localPath.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        if (!s.status) {
          s.status = "active";
          modified = true;
        }
        deduped.unshift(s);
      } else {
        modified = true;
      }
    }
    if (modified || deduped.length !== cfg.shares.length) {
      cfg.shares = deduped;
      saveConfig(cfg);
    }
  }

  return cfg;
}

function saveConfig(cfg) {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), "utf8");
}

function getLocalNetworkIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "127.0.0.1";
}

class AgentClient {
  constructor(config = loadConfig()) {
    this.config = config;
    this.timer = null;
  }

  async sendRequest(endpoint, method = "GET", data = null) {
    const url = new URL(endpoint, this.config.serverUrl);
    const client = url.protocol === "https:" ? https : http;

    return new Promise((resolve, reject) => {
      const payload = data ? JSON.stringify(data) : null;
      const options = {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
        },
      };

      const req = client.request(url, options, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(body);
            resolve(parsed);
          } catch {
            resolve({ raw: body });
          }
        });
      });

      req.on("error", reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  async register() {
    const res = await this.sendRequest("/api/drive/agent", "POST", {
      action: "register",
      connectKey: this.config.connectKey,
      agentInfo: {
        hostname: this.config.hostname,
        os: this.config.os,
        osVersion: `${os.type()} ${os.release()}`,
        appVersion: "1.0.0",
        activeSharesCount: this.config.shares.length,
      },
    });
    this.syncShares().catch(() => {});
    return res;
  }

  async syncShares() {
    if (!Array.isArray(this.config.shares) || this.config.shares.length === 0) return;
    for (const s of this.config.shares) {
      if (!s.localPath || !fs.existsSync(s.localPath)) continue;
      try {
        const scan = scanFolder(s.localPath);
        await this.sendRequest("/api/drive/agent", "POST", {
          action: "create_share",
          connectKey: this.config.connectKey,
          agentInfo: {
            hostname: this.config.hostname,
          },
          shareData: {
            id: s.id,
            title: s.title || scan.title,
            subtitle: `Thư mục trên máy ${this.config.hostname}`,
            type: s.type || scan.type,
            localPath: scan.localPath,
            items: scan.items,
            totalSizeBytes: scan.totalSizeBytes,
            totalSizeLabel: scan.totalSizeLabel,
            videoMeta: scan.videoMeta,
          },
        });
      } catch {
        // Ignore offline sync errors
      }
    }
  }

  async createShare(folderPath, type = null) {
    const scan = scanFolder(folderPath);
    if (type) scan.type = type;

    const shareId = `drv-${path.basename(folderPath).toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now().toString().slice(-4)}`;
    const publicUrl = `${this.config.serverUrl.replace(/\/$/, "")}/drive/${shareId}`;

    const localIp = getLocalNetworkIp();
    let lanUrl = publicUrl;
    try {
      const serverUrlObj = new URL(this.config.serverUrl);
      if (serverUrlObj.hostname === "localhost" || serverUrlObj.hostname === "127.0.0.1") {
        lanUrl = `${serverUrlObj.protocol}//${localIp}:${serverUrlObj.port || 3000}/drive/${shareId}`;
      }
    } catch {
      // Ignore
    }

    let res = null;
    try {
      res = await this.sendRequest("/api/drive/agent", "POST", {
        action: "create_share",
        connectKey: this.config.connectKey,
        agentInfo: {
          hostname: this.config.hostname,
        },
        shareData: {
          id: shareId,
          title: scan.title,
          subtitle: `Thư mục trên máy ${this.config.hostname}`,
          type: scan.type,
          localPath: scan.localPath,
          items: scan.items,
          totalSizeBytes: scan.totalSizeBytes,
          totalSizeLabel: scan.totalSizeLabel,
          videoMeta: scan.videoMeta,
        },
      });
    } catch {
      // Offline / fallback mode
      res = {
        success: true,
        offline: true,
        shareId,
        publicUrl,
        message: "Đã lưu chia sẻ cục bộ.",
      };
    }

    if (res && res.success) {
      if (res.publicUrl && res.publicUrl.includes("localhost") && !this.config.serverUrl.includes("localhost")) {
        res.publicUrl = publicUrl;
      }
      if (res.publicUrl && res.publicUrl.includes("studiocore.io.vn") && !res.publicUrl.includes("www.studiocore.io.vn")) {
        res.publicUrl = res.publicUrl.replace("studiocore.io.vn", "www.studiocore.io.vn");
      }
      res.publicUrl = res.publicUrl || publicUrl;
      res.lanUrl = lanUrl;
      res.localIp = localIp;

      const shareEntry = {
        id: shareId,
        title: scan.title,
        localPath: scan.localPath,
        type: scan.type,
        status: "active",
        publicUrl: res.publicUrl,
        lanUrl,
        createdAt: new Date().toISOString(),
      };

      const existingIndex = this.config.shares.findIndex(
        (s) => s.localPath && s.localPath.toLowerCase() === scan.localPath.toLowerCase()
      );
      if (existingIndex !== -1) {
        this.config.shares[existingIndex] = shareEntry;
      } else {
        this.config.shares.push(shareEntry);
      }
      saveConfig(this.config);
    }

    return res;
  }

  async deleteShare(shareId) {
    const idx = this.config.shares.findIndex((s) => s.id === shareId);
    if (idx !== -1) {
      this.config.shares.splice(idx, 1);
      saveConfig(this.config);
    }

    try {
      await this.sendRequest("/api/drive/agent", "POST", {
        action: "delete_share",
        connectKey: this.config.connectKey,
        shareId,
      });
    } catch {
      // Offline / ignore error
    }

    return { success: true, shareId };
  }

  async toggleShareStatus(shareId) {
    const share = this.config.shares.find((s) => s.id === shareId);
    if (!share) {
      return { success: false, error: "Share not found" };
    }

    share.status = share.status === "paused" ? "active" : "paused";
    saveConfig(this.config);

    try {
      await this.sendRequest("/api/drive/agent", "POST", {
        action: "toggle_status",
        connectKey: this.config.connectKey,
        shareId,
        status: share.status,
      });
    } catch {
      // Offline / ignore error
    }

    return { success: true, shareId, status: share.status };
  }

  async pollNotifications() {
    try {
      const res = await this.sendRequest("/api/drive/agent?action=notifications", "GET");
      if (res && res.notifications) {
        for (const notif of res.notifications) {
          if (notif.type === "selection_finalized") {
            const matchingShare = this.config.shares.find((s) => s.id === notif.shareId);
            if (matchingShare && this.config.autoFilterRaw) {
              const selectedItems = (notif.selectedCodes || []).map((c) => ({ filename: `${c}.CR3`, code: c }));
              autoFilterRawFiles(matchingShare.localPath, selectedItems);
            }
          }
        }
      }
    } catch {
      // Ignore network errors in polling
    }
  }

  startDaemon(intervalMs = 15000) {
    this.register().catch(() => {});
    this.timer = setInterval(() => {
      this.pollNotifications().catch(() => {});
    }, intervalMs);
  }

  stopDaemon() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

module.exports = {
  AgentClient,
  loadConfig,
  saveConfig,
};
