"use strict";

const fs = require("node:fs");
const path = require("node:path");

const DEFAULTS = {
  serverUrl: "https://www.studiocore.io.vn",
  deviceToken: null,
  previousDeviceToken: null,
  previousServerUrl: null,
  deviceId: null,
  deviceName: null,
  studioName: null,
  autoCopyPicks: true,
  picksFolderName: "Khach-chon",
  launchAtLogin: false,
  macQuickAction: true,
  macLoginCleanupDone: false,
  contextMenu: false,
  lastSubmissionCheck: 0,
  pendingExports: [],
  shares: {},
};

/**
 * Lưu cài đặt vào một tệp JSON, ghi kiểu "ghi tạm rồi đổi tên" để không hỏng tệp khi tắt máy đột ngột.
 * `cipher` (tuỳ chọn) mã hoá token thiết bị bằng kho khoá của hệ điều hành.
 */
class Store {
  constructor(dir, cipher) {
    this.file = path.join(dir, "settings.json");
    this.cipher = cipher || null;
    this.data = { ...DEFAULTS, shares: {} };
    fs.mkdirSync(dir, { recursive: true });
    this.load();
  }

  load() {
    let raw;
    try {
      raw = JSON.parse(fs.readFileSync(this.file, "utf8"));
    } catch {
      return;
    }
    if (!raw || typeof raw !== "object") return;
    const data = {
      ...DEFAULTS,
      ...raw,
      pendingExports: Array.isArray(raw.pendingExports)
        ? [...new Set(raw.pendingExports.filter((id) => typeof id === "string" && id.length > 0))]
        : [],
      shares: raw.shares && typeof raw.shares === "object" ? raw.shares : {},
    };
    if (data.serverUrl === "https://studiocore.io.vn") {
      data.serverUrl = "https://www.studiocore.io.vn";
    }
    if (data.previousServerUrl === "https://studiocore.io.vn") {
      data.previousServerUrl = "https://www.studiocore.io.vn";
    }
    if (typeof raw.deviceTokenEnc === "string" && this.cipher) {
      try {
        data.deviceToken = this.cipher.decrypt(raw.deviceTokenEnc);
      } catch {
        data.deviceToken = null;
      }
    }
    if (typeof raw.previousDeviceTokenEnc === "string" && this.cipher) {
      try {
        data.previousDeviceToken = this.cipher.decrypt(raw.previousDeviceTokenEnc);
      } catch {
        data.previousDeviceToken = null;
      }
    }
    delete data.deviceTokenEnc;
    delete data.previousDeviceTokenEnc;
    this.data = data;
  }

  save() {
    const out = { ...this.data };
    if (out.deviceToken && this.cipher) {
      out.deviceTokenEnc = this.cipher.encrypt(out.deviceToken);
      delete out.deviceToken;
    }
    if (out.previousDeviceToken && this.cipher) {
      out.previousDeviceTokenEnc = this.cipher.encrypt(out.previousDeviceToken);
      delete out.previousDeviceToken;
    }
    const tmp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(out, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, this.file);
  }

  get(key) {
    return this.data[key];
  }

  set(patch) {
    Object.assign(this.data, patch);
    this.save();
  }

  getShare(id) {
    return Object.prototype.hasOwnProperty.call(this.data.shares, id) ? this.data.shares[id] : null;
  }

  setShare(id, value) {
    this.data.shares[id] = value;
    this.save();
  }

  deleteShare(id) {
    delete this.data.shares[id];
    this.save();
  }
}

module.exports = { Store, DEFAULTS };
