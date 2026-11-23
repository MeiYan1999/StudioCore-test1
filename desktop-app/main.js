"use strict";

const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { pathToFileURL } = require("node:url");
const {
  app,
  BrowserWindow,
  Menu,
  Notification,
  Tray,
  clipboard,
  dialog,
  ipcMain,
  nativeImage,
  powerSaveBlocker,
  safeStorage,
  session,
  shell,
} = require("electron");
const { DriveAgent } = require("./src/core/agent");
const { normalizeServerUrl } = require("./src/core/api");
const { ImageCache } = require("./src/core/images");
const { safeFolderName } = require("./src/core/picks");
const { Store } = require("./src/core/store");
const { applyLoginItem, setWindowsAppUserModelId } = require("./src/platform/app-identity");
const { setWindowsContextMenu, sharePathFromArgv } = require("./src/platform/context-menu");
const { startKeepAwake } = require("./src/platform/keep-awake");
const {
  contextActionFromArgv,
  contextActionRouteFromArgv,
  findSharesForFolder,
  shareOptionsForAction,
  sharesWithPicks,
} = require("./src/platform/context-actions");
const { macBundlePath, removeMacLoginItems } = require("./src/platform/mac-login-cleanup");
const { installMacQuickActions, removeMacQuickActions } = require("./src/platform/mac-quick-action");

setWindowsAppUserModelId(app);

const RENDERER_FILE = path.join(__dirname, "renderer", "index.html");
const RENDERER_URL = pathToFileURL(RENDERER_FILE).href;

let win = null;
let tray = null;
let store = null;
let agent = null;
let quitting = false;
let pendingShare = null;
let keepAwakeHandle = null;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    void handleContextMenuArguments(argv);
  });
  // macOS: kéo thư mục vào biểu tượng Dock hoặc "Mở bằng → StudioCore Drive".
  app.on("open-file", (event, file) => {
    event.preventDefault();
    requestShare(file);
    if (app.isReady()) showWindow();
  });
  app.whenReady().then(init);
}

function requestShare(folder, options = {}) {
  if (!folder) return;
  let stat = null;
  try {
    stat = fs.statSync(folder);
  } catch {
    return;
  }
  if (!stat.isDirectory()) return;
  const request = { folder, ...options };
  if (win && !win.webContents.isLoading()) win.webContents.send("drive:share-request", request);
  else pendingShare = request;
}

function notifyContextAction(body, onClick) {
  if (!Notification.isSupported()) {
    onClick?.();
    return;
  }
  const notification = new Notification({ title: "StudioCore Drive", body });
  if (onClick) notification.on("click", onClick);
  notification.show();
}

async function runShareContextAction(action, folder) {
  const localShares = Object.entries(store.get("shares") || {}).map(([id, share]) => ({
    id,
    folder: share.folder,
  }));
  const localMatches = await findSharesForFolder(localShares, folder);
  const notifyUnshared = () => {
    notifyContextAction("Thư mục này chưa được chia sẻ", () => {
      requestShare(folder, { kind: "select", allowOriginal: false, includeAllFiles: false });
      showWindow();
    });
  };
  if (localMatches.length === 0) {
    notifyUnshared();
    return;
  }
  const localIds = new Set(localMatches.map((share) => share.id));
  const matches = (await agent.listShares())
    .filter((share) => localIds.has(share.id))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  if (matches.length === 0) {
    notifyUnshared();
    return;
  }
  const newest = matches[0];
  if (action === "copylink") {
    clipboard.writeText(matches.map((share) => share.url).filter(Boolean).join("\n"));
    notifyContextAction("Đã sao chép link");
    return;
  }
  if (action === "picks") {
    for (const share of sharesWithPicks(matches)) {
      try {
        const result = await agent.copyPicks(share.id);
        notifyContextAction(`Đã chép ${result.codes.length} ảnh khách chọn vào ${result.dest}`);
        return;
      } catch (error) {
        if (error.message !== "Khách chưa chọn ảnh nào.") throw error;
      }
    }
    notifyContextAction("Khách chưa chọn ảnh nào");
    return;
  }
  if (action === "rescan") {
    const result = await agent.rescanShare(newest.id);
    notifyContextAction(`Đã đồng bộ: ${result.count} tệp`);
    return;
  }
  if (action === "toggle") {
    const status = newest.status === "paused" ? "active" : "paused";
    await agent.updateShare(newest.id, { status });
    notifyContextAction(status === "paused" ? "Đã tạm dừng chia sẻ" : "Đã bật lại chia sẻ");
  }
}

async function handleContextMenuArguments(argv) {
  const route = contextActionRouteFromArgv(argv);
  const action = contextActionFromArgv(argv);
  const folder = sharePathFromArgv(argv);
  if (route === "hidden") return;
  if (route === "show") {
    if (action === null && folder) requestShare(folder);
    showWindow();
    return;
  }
  if (action === "open") {
    showWindow();
    return;
  }
  const shareOptions = shareOptionsForAction(action);
  if (shareOptions) {
    if (folder) requestShare(folder, shareOptions);
    showWindow();
    return;
  }
  if (!folder) {
    showWindow();
    return;
  }
  try {
    await runShareContextAction(action, folder);
  } catch (error) {
    notifyContextAction(error.message || "Không thể thực hiện thao tác.");
  }
}

function publicState() {
  return {
    paired: agent.paired,
    status: agent.status,
    serverUrl: store.get("serverUrl"),
    deviceName: store.get("deviceName"),
    studioName: store.get("studioName"),
    settings: {
      autoCopyPicks: !!store.get("autoCopyPicks"),
      picksFolderName: store.get("picksFolderName"),
      keepAwake: !!store.get("keepAwake"),
      defaultMessageSelect: store.get("defaultMessageSelect"),
      defaultMessageDeliver: store.get("defaultMessageDeliver"),
      messageShared: !!store.get("messageShared"),
      launchAtLogin: !!store.get("launchAtLogin"),
      contextMenu:
        process.platform === "darwin" ? !!store.get("macQuickAction") : !!store.get("contextMenu"),
    },
    platform: process.platform,
    version: app.getVersion(),
    pendingShare,
  };
}

function createWindow() {
  win = new BrowserWindow({
    width: 1040,
    height: 720,
    minWidth: 760,
    minHeight: 520,
    title: "StudioCore Drive",
    backgroundColor: "#f6f5fb",
    icon: path.join(__dirname, "assets", "icon.png"),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      webviewTag: false,
      spellcheck: false,
    },
  });
  win.setMenuBarVisibility(false);
  // Cửa sổ chỉ hiển thị giao diện đóng gói sẵn: chặn mọi điều hướng và cửa sổ mới.
  win.webContents.on("will-navigate", (event, url) => {
    if (url !== RENDERER_URL) event.preventDefault();
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-attach-webview", (event) => event.preventDefault());
  win.once("ready-to-show", () => {
    const startupAction = contextActionFromArgv(process.argv);
    const showsWindow = startupAction === null || ["open", "select", "view", "folder"].includes(startupAction);
    if (!process.argv.includes("--hidden") && showsWindow) win.show();
  });
  win.on("close", (event) => {
    if (!quitting) {
      event.preventDefault();
      win.hide();
    }
  });
  win.loadFile(RENDERER_FILE);
}

function showWindow() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function createTray() {
  const image = nativeImage.createFromPath(path.join(__dirname, "assets", "tray.png"));
  tray = new Tray(process.platform === "darwin" ? image.resize({ width: 18, height: 18 }) : image);
  tray.setToolTip("StudioCore Drive");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Mở StudioCore Drive", click: showWindow },
      { label: "Chia sẻ thư mục…", click: async () => {
        const folder = await pickFolder();
        if (folder) {
          requestShare(folder);
          showWindow();
        }
      } },
      { type: "separator" },
      { label: "Thoát", click: () => {
        quitting = true;
        app.quit();
      } },
    ]),
  );
  tray.on("click", showWindow);
}

async function pickFolder() {
  const result = await dialog.showOpenDialog(win && win.isVisible() ? win : undefined, {
    title: "Chọn thư mục ảnh để chia sẻ",
    properties: ["openDirectory"],
  });
  return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
}

/** Ảnh thu nhỏ từ hệ điều hành cho định dạng sharp không đọc được (RAW, HEIC trên Windows...). */
async function osThumbnail(file, edge) {
  if (process.platform === "linux") return null;
  const image = await nativeImage.createThumbnailFromPath(file, { width: edge, height: edge });
  return image.isEmpty() ? null : image.toJPEG(82);
}

function handle(channel, fn) {
  ipcMain.handle(`drive:${channel}`, async (event, payload) => {
    // Chỉ nhận lệnh từ khung chính của cửa sổ ứng dụng đang hiển thị giao diện đóng gói sẵn.
    const frame = event.senderFrame;
    if (!win || event.sender !== win.webContents || !frame || frame !== win.webContents.mainFrame || frame.url !== RENDERER_URL) {
      throw new Error("Từ chối yêu cầu.");
    }
    try {
      return { ok: true, data: await fn(payload) };
    } catch (error) {
      return { ok: false, error: error && error.message ? String(error.message) : "Có lỗi xảy ra." };
    }
  });
}

function str(value, max = 500) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function messageText(value) {
  return typeof value === "string" ? value.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "").slice(0, 1000) : "";
}

function stopKeepAwake() {
  if (keepAwakeHandle === null) return;
  const handle = keepAwakeHandle;
  keepAwakeHandle = null;
  try {
    handle.stop();
  } catch (error) {
    console.warn("Không thể dừng chế độ giữ máy luôn bật:", error);
  }
}

function applyKeepAwake() {
  const shouldBlock = !!store?.get("keepAwake") && !!agent?.paired;
  if (shouldBlock && keepAwakeHandle === null) {
    try {
      keepAwakeHandle = startKeepAwake({ platform: process.platform, powerSaveBlocker });
    } catch (error) {
      console.warn("Không thể giữ máy luôn bật:", error);
    }
  } else if (!shouldBlock) {
    stopKeepAwake();
  }
}

function registerIpc() {
  handle("state", () => {
    const state = publicState();
    pendingShare = null;
    return state;
  });
  handle("pair", async (p) => {
    const serverUrl = p && p.serverUrl ? normalizeServerUrl(str(p.serverUrl)) : undefined;
    await agent.pair(str(p && p.code, 200), serverUrl);
    applyKeepAwake();
    return publicState();
  });
  handle("unpair", () => {
    agent.unpair();
    applyKeepAwake();
    return publicState();
  });
  handle("pick-folder", () => pickFolder());
  handle("preview-folder", (p) =>
    agent.previewFolder(str(p && p.folder, 4096), { includeAllFiles: p && p.includeAllFiles === true }),
  );
  handle("create-share", async (p) => {
    const result = await agent.createShare(str(p && p.folder, 4096), {
      title: str(p.title, 160),
      clientName: str(p.clientName, 120),
      kind: p.kind === "deliver" ? "deliver" : "select",
      includeAllFiles: p.includeAllFiles === true,
      message: messageText(p.message),
      pin: str(p.pin, 12),
      maxSelect: Number(p.maxSelect) || 0,
      allowOriginal: p.allowOriginal === true,
      expiresInDays: Number(p.expiresInDays) || 0,
    });
    clipboard.writeText(result.url);
    return result;
  });
  handle("list-shares", () => agent.listShares());
  handle("update-share", (p) => {
    const patch = {};
    if (p.status === "active" || p.status === "paused") patch.status = p.status;
    if (p.reopen === true) patch.reopen = true;
    if (typeof p.pin === "string" || p.pin === null) patch.pin = p.pin;
    if (p.expiresInDays !== undefined) patch.expiresInDays = Number(p.expiresInDays) || null;
    if (p.maxSelect !== undefined) patch.maxSelect = Number(p.maxSelect) || 0;
    return agent.updateShare(str(p.id, 64), patch);
  });
  handle("delete-share", (id) => agent.deleteShare(str(id, 64)));
  handle("rescan-share", (id) => agent.rescanShare(str(id, 64)));
  handle("copy-picks", async (id) => {
    const result = await agent.copyPicks(str(id, 64));
    void shell.openPath(result.dest);
    return { copied: result.copied, missing: result.missing, codes: result.codes };
  });
  handle("copy-text", (text) => {
    clipboard.writeText(str(text, 20000));
    return true;
  });
  handle("open-folder", async (id) => {
    const share = store.getShare(str(id, 64));
    if (!share) throw new Error("Link này không được tạo từ máy tính này.");
    const error = await shell.openPath(share.folder);
    if (error) throw new Error("Không mở được thư mục.");
    return true;
  });
  handle("open-link", async (url) => {
    // Chỉ mở link thuộc máy chủ StudioCore đang kết nối.
    const target = new URL(str(url, 2000));
    if (target.origin !== store.get("serverUrl")) throw new Error("Link không hợp lệ.");
    await shell.openExternal(target.href);
    return true;
  });
  handle("set-settings", async (p) => {
    const patch = {};
    if (typeof p.autoCopyPicks === "boolean") patch.autoCopyPicks = p.autoCopyPicks;
    if (typeof p.picksFolderName === "string") patch.picksFolderName = safeFolderName(p.picksFolderName);
    if (typeof p.keepAwake === "boolean") patch.keepAwake = p.keepAwake;
    if (typeof p.defaultMessageSelect === "string") patch.defaultMessageSelect = messageText(p.defaultMessageSelect);
    if (typeof p.defaultMessageDeliver === "string") patch.defaultMessageDeliver = messageText(p.defaultMessageDeliver);
    if (typeof p.messageShared === "boolean") patch.messageShared = p.messageShared;
    if (typeof p.launchAtLogin === "boolean") {
      applyLoginItem(app, p.launchAtLogin);
      patch.launchAtLogin = p.launchAtLogin;
      if (process.platform === "darwin" && !p.launchAtLogin && !store.get("macLoginCleanupDone")) {
        const bundlePath = macBundlePath(process.execPath);
        if (bundlePath) {
          const result = await removeMacLoginItems(bundlePath);
          store.set({ macLoginCleanupDone: true });
          if (!result.ok) {
            await dialog.showMessageBox(win, {
              type: "info",
              title: "Không thể xóa mục khởi động cũ",
              message:
                "Nếu Cài đặt hệ thống › Cài đặt chung › Mục đăng nhập vẫn còn “StudioCore Drive”, hãy chọn mục đó và bấm “−”.",
            });
          }
        }
      }
    }
    if (typeof p.contextMenu === "boolean") {
      if (process.platform === "win32") {
        await setWindowsContextMenu(p.contextMenu, process.execPath);
        patch.contextMenu = p.contextMenu;
      } else if (process.platform === "darwin") {
        if (p.contextMenu) {
          await installMacQuickActions({
            templateDir: path.join(__dirname, "assets", "mac-quick-action"),
          });
        } else {
          await removeMacQuickActions({
            servicesDir: path.join(os.homedir(), "Library", "Services"),
          });
        }
        patch.macQuickAction = p.contextMenu;
      }
    }
    store.set(patch);
    applyKeepAwake();
    return publicState();
  });
}

function cleanupMacLoginItemsAtStartup() {
  try {
    if (process.platform !== "darwin" || store.get("launchAtLogin") || store.get("macLoginCleanupDone")) return;
    if (!app.getLoginItemSettings().wasOpenedAtLogin) return;
    const bundlePath = macBundlePath(process.execPath);
    if (!bundlePath) return;

    void (async () => {
      let result;
      try {
        result = await removeMacLoginItems(bundlePath);
      } catch (error) {
        result = { ok: false, error: error.message || String(error) };
      }
      try {
        store.set({ macLoginCleanupDone: true });
      } catch (error) {
        console.warn("Không thể lưu trạng thái dọn mục khởi động cũ:", error);
      }
      if (!result.ok) console.warn("Không thể gỡ mục khởi động cũ của StudioCore Drive:", result.error);
    })().catch((error) => {
      console.warn("Không thể hoàn tất việc dọn mục khởi động cũ:", error);
    });
  } catch (error) {
    console.warn("Không thể kiểm tra mục khởi động cũ:", error);
  }
}

function init() {
  // Giao diện không cần quyền nào của trình duyệt (camera, vị trí, thông báo web...).
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);

  const cipher = safeStorage.isEncryptionAvailable()
    ? {
        encrypt: (text) => safeStorage.encryptString(text).toString("base64"),
        decrypt: (text) => safeStorage.decryptString(Buffer.from(text, "base64")),
      }
    : null;
  store = new Store(app.getPath("userData"), cipher);
  if (process.platform === "win32" && store.get("contextMenu")) {
    setWindowsContextMenu(true, process.execPath).catch((error) => {
      console.warn("Không thể cập nhật mục chia sẻ trong Explorer:", error);
    });
  }
  if (process.platform === "darwin" && store.get("macQuickAction")) {
    installMacQuickActions({
      templateDir: path.join(__dirname, "assets", "mac-quick-action"),
    }).catch((error) => {
      console.warn("Không thể cài mục chia sẻ trong Finder:", error);
    });
  }
  if (store.get("launchAtLogin")) {
    try {
      applyLoginItem(app, true);
    } catch (error) {
      console.warn("Không thể khôi phục cài đặt khởi động cùng hệ thống:", error);
    }
  }
  cleanupMacLoginItemsAtStartup();
  agent = new DriveAgent({
    store,
    images: new ImageCache(path.join(app.getPath("userData"), "cache"), { fallback: osThumbnail }),
    appVersion: app.getVersion(),
  });
  applyKeepAwake();
  agent.on("status", (payload) => win && win.webContents.send("drive:status", payload));
  agent.on("submission", ({ share, copied }) => {
    if (win) win.webContents.send("drive:submission", { id: share.id });
    if (Notification.isSupported()) {
      const body =
        copied && !copied.error
          ? `${share.pickedCount} ảnh đã chọn. Đã chép ${copied.copied} tệp vào thư mục “${store.get("picksFolderName")}”.`
          : `${share.pickedCount} ảnh đã chọn.`;
      const notification = new Notification({ title: `Khách đã chọn xong: ${share.title}`, body });
      notification.on("click", showWindow);
      notification.show();
    }
  });

  registerIpc();
  createWindow();
  createTray();
  void handleContextMenuArguments(process.argv);
  agent.start();

  app.on("activate", showWindow);
  app.on("before-quit", () => {
    quitting = true;
    stopKeepAwake();
    agent.stop();
  });
  app.on("window-all-closed", () => undefined);
}
