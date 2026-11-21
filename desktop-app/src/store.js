const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { randomBytes } = require("node:crypto");

const defaults = {
  serverUrl: "https://www.studiocore.io.vn",
  connectKey: "",
  deviceName: os.hostname(),
  defaults: { allowOriginals: true, pin: "", maxSelect: 30, expiresDays: 30, rawDownload: "raw" },
  filter: {
    notifyOnFinalize: true,
    autoCopyOnFinalize: false,
    mode: "raw",
    outputName: "Anh_Chon_Goc",
  },
  cache: { maxGB: 5, maxAgeDays: 30 },
  tunnel: { mode: "quick", namedToken: "", namedHostname: "", cloudflaredPath: "" },
  autoStart: false,
  mediaPort: 0,
};

function merge(base, value) {
  check(
    value === undefined || (value && typeof value === "object" && !Array.isArray(value)),
    "cần đối tượng JSON",
  );
  const output = {};
  for (const [key, fallback] of Object.entries(base)) {
    output[key] =
      fallback && typeof fallback === "object"
        ? merge(fallback, value?.[key])
        : value?.[key] === undefined
          ? fallback
          : value[key];
  }
  return output;
}

function check(condition, message) {
  if (!condition) throw new Error(`Cấu hình không hợp lệ: ${message}`);
}

function validateConfig(value) {
  check(value && typeof value === "object" && !Array.isArray(value), "cần đối tượng JSON");
  const config = merge(defaults, value);
  let url;
  try {
    url = new URL(config.serverUrl);
  } catch {
    throw new Error("Địa chỉ máy chủ không hợp lệ.");
  }
  check(
    ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash,
    "serverUrl phải là HTTP(S) origin",
  );
  check(
    typeof config.connectKey === "string" &&
      (!config.connectKey || /^scd_[\w-]{43}$/.test(config.connectKey)),
    "connectKey",
  );
  check(
    typeof config.deviceName === "string" &&
      config.deviceName.trim().length > 0 &&
      config.deviceName.length <= 255,
    "deviceName",
  );
  for (const [object, keys] of [
    [config.defaults, ["allowOriginals"]],
    [config.filter, ["notifyOnFinalize", "autoCopyOnFinalize"]],
    [config, ["autoStart"]],
  ]) {
    for (const key of keys) check(typeof object[key] === "boolean", key);
  }
  check(
    typeof config.defaults.pin === "string" &&
      (config.defaults.pin === "" || /^\d{6}$/.test(config.defaults.pin)),
    "PIN phải có 6 số",
  );
  check(
    Number.isInteger(config.defaults.maxSelect) &&
      config.defaults.maxSelect >= 1 &&
      config.defaults.maxSelect <= 5000,
    "maxSelect",
  );
  check(
    Number.isInteger(config.defaults.expiresDays) &&
      config.defaults.expiresDays >= 0 &&
      config.defaults.expiresDays <= 3650,
    "expiresDays",
  );
  check(["raw", "jpg"].includes(config.defaults.rawDownload), "rawDownload");
  check(["raw", "jpg", "both"].includes(config.filter.mode), "filter.mode");
  check(
    typeof config.filter.outputName === "string" &&
      !!config.filter.outputName &&
      !/[\\/:\x00]/.test(config.filter.outputName) &&
      ![".", ".."].includes(config.filter.outputName),
    "outputName",
  );
  for (const key of ["maxGB", "maxAgeDays"])
    check(Number.isFinite(config.cache[key]) && config.cache[key] >= 0, `cache.${key}`);
  check(["quick", "named"].includes(config.tunnel.mode), "tunnel.mode");
  for (const key of ["namedToken", "namedHostname", "cloudflaredPath"])
    check(typeof config.tunnel[key] === "string", key);
  check(
    !config.tunnel.namedHostname ||
      /^(?=.{1,253}$)[a-z0-9]+(?:[a-z0-9.-]*[a-z0-9])?$/i.test(config.tunnel.namedHostname),
    "namedHostname",
  );
  check(
    Number.isInteger(config.mediaPort) && config.mediaPort >= 0 && config.mediaPort <= 65535,
    "mediaPort",
  );
  config.serverUrl = url.origin;
  return config;
}

function safeRelative(value) {
  return (
    typeof value === "string" &&
    !!value &&
    !/[\\:\x00]/.test(value) &&
    value.split("/").every((part) => part && part !== "." && part !== "..")
  );
}

function validateShares(shares) {
  check(Array.isArray(shares), "shares phải là danh sách");
  const ids = new Set();
  for (const share of shares) {
    check(
      typeof share.id === "string" && /^[\w-]+$/.test(share.id) && !ids.has(share.id),
      "share.id",
    );
    ids.add(share.id);
    check(["album", "view", "video", "folder"].includes(share.kind), "share.kind");
    check(typeof share.rootPath === "string" && path.isAbsolute(share.rootPath), "share.rootPath");
    check(
      typeof share.mediaSecret === "string" && /^[\w-]{43}$/.test(share.mediaSecret),
      "share.mediaSecret",
    );
    check(
      typeof share.allowOriginals === "boolean" && ["raw", "jpg"].includes(share.rawDownload),
      "share.download",
    );
    check(["active", "paused", "revoked"].includes(share.status), "share.status");
    check(
      share.expiresAt === null ||
        (typeof share.expiresAt === "string" && Number.isFinite(Date.parse(share.expiresAt))),
      "share.expiresAt",
    );
    check(
      share.files &&
        typeof share.files === "object" &&
        !Array.isArray(share.files) &&
        Object.keys(share.files).length <= 20000,
      "share.files",
    );
    for (const [key, value] of Object.entries(share.files))
      check(/^[\w-]{8,64}$/.test(key) && safeRelative(value), "share.fileKey/path");
    for (const [key, value] of Object.entries(share.previews || {}))
      check(Object.hasOwn(share.files, key) && safeRelative(value), "share.preview");
  }
  return shares;
}

function atomicWrite(file, value) {
  const temporary = `${file}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
  let descriptor;
  try {
    descriptor = fs.openSync(temporary, "wx", 0o600);
    fs.writeFileSync(descriptor, JSON.stringify(value, null, 2) + "\n");
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temporary, file);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    try {
      fs.unlinkSync(temporary);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
}

class Store {
  constructor(
    directory = process.env.STUDIOCORE_DRIVE_DIR || path.join(os.homedir(), ".studiocore-drive"),
  ) {
    this.directory = path.resolve(directory);
    fs.mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    fs.chmodSync(this.directory, 0o700);
  }
  read(name, fallback) {
    try {
      const file = path.join(this.directory, name);
      const value = JSON.parse(fs.readFileSync(file, "utf8"));
      fs.chmodSync(file, 0o600);
      return value;
    } catch (error) {
      if (error.code === "ENOENT") return fallback;
      throw new Error(`Không đọc được ${name}: ${error.message}`);
    }
  }
  loadConfig() {
    return validateConfig(this.read("config.json", {}));
  }
  saveConfig(config) {
    const value = validateConfig(config);
    atomicWrite(path.join(this.directory, "config.json"), value);
    return value;
  }
  loadShares() {
    return validateShares(this.read("shares.json", []));
  }
  updateShares(update) {
    const lock = path.join(this.directory, "shares.lock");
    let descriptor;
    try {
      descriptor = fs.openSync(lock, "wx", 0o600);
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      let active = true;
      try {
        const owner = JSON.parse(fs.readFileSync(lock, "utf8"));
        if (Number.isInteger(owner.pid) && owner.pid > 0) {
          try {
            process.kill(owner.pid, 0);
          } catch (failure) {
            if (failure.code === "ESRCH") active = false;
          }
        }
      } catch {
        active = Date.now() - fs.statSync(lock).mtimeMs < 300000;
      }
      if (active) throw new Error("Danh sách chia sẻ đang được cập nhật. Vui lòng thử lại.");
      fs.unlinkSync(lock);
      descriptor = fs.openSync(lock, "wx", 0o600);
    }
    try {
      fs.writeFileSync(descriptor, JSON.stringify({ pid: process.pid }));
      const result = validateShares(update(this.loadShares()));
      atomicWrite(path.join(this.directory, "shares.json"), result);
      return result;
    } finally {
      fs.closeSync(descriptor);
      fs.unlinkSync(lock);
    }
  }
}

module.exports = { Store, defaults, validateConfig, validateShares, atomicWrite, safeRelative };
