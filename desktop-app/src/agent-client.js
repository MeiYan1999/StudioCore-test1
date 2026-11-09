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

  if (fs.existsSync(CONFIG_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    } catch {
      // Fallback
    }
  }

  const defaultConfig = {
    serverUrl: "http://localhost:3000",
    connectKey: "sc_drive_live_tenant_demo_984f7b2e1a",
    hostname: os.hostname(),
    os: process.platform === "win32" ? "windows" : process.platform === "darwin" ? "macos" : "linux",
    shares: [],
    autoFilterRaw: true,
    chimeSound: true,
  };

  saveConfig(defaultConfig);
  return defaultConfig;
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
    return this.sendRequest("/api/drive/agent", "POST", {
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
      res.publicUrl = res.publicUrl || publicUrl;
      res.lanUrl = lanUrl;
      res.localIp = localIp;
      this.config.shares.push({
        id: shareId,
        title: scan.title,
        localPath: scan.localPath,
        type: scan.type,
        publicUrl: res.publicUrl,
        lanUrl,
        createdAt: new Date().toISOString(),
      });
      saveConfig(this.config);
    }

    return res;
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
