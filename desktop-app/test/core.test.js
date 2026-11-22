"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { parseRange } = require("../src/core/agent");
const { DriveAgent } = require("../src/core/agent");
const { ApiError, normalizeServerUrl } = require("../src/core/api");
const { copyPicks, safeFolderName } = require("../src/core/picks");
const { scanFolder, resolveInside } = require("../src/core/scanner");
const {
  APP_USER_MODEL_ID,
  LEGACY_WINDOWS_LOGIN_ITEM_NAME,
  applyLoginItem,
  setWindowsAppUserModelId,
} = require("../src/platform/app-identity");
const { macBundlePath, removeMacLoginItems } = require("../src/platform/mac-login-cleanup");
const { Store } = require("../src/core/store");
const {
  QUICK_ACTION_NAME,
  installMacQuickAction,
  removeMacQuickAction,
} = require("../src/platform/mac-quick-action");
const {
  CONTEXT_MENU_KEY,
  WINDOWS_RUN_KEY,
  buildContextMenuCommand,
  sharePathFromArgv,
} = require("../src/platform/context-menu");
const { getMacSigningOptions } = require("../src/platform/mac-signing");

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "scdrive-"));
}

test("quét thư mục: bỏ RAW đã có JPG, khoá không lộ đường dẫn", async () => {
  const dir = tmp();
  for (const name of ["a.jpg", "a.CR3", "b.NEF", "c.mp4", "ghi-chu.txt", ".an.jpg"]) fs.writeFileSync(path.join(dir, name), "x");
  const files = await scanFolder(dir, "salt");
  assert.deepEqual(files.map((f) => [f.name, f.kind]), [["a.jpg", "image"], ["b.NEF", "raw"], ["c.mp4", "video"]]);
  for (const f of files) assert.match(f.key, /^[A-Za-z0-9_-]{22}$/);
  assert.notEqual((await scanFolder(dir, "salt-khac"))[0].key, files[0].key);
});

test("quét thư mục bỏ qua tên thư mục xuất tùy chỉnh không phân biệt hoa thường", async () => {
  const dir = tmp();
  fs.mkdirSync(path.join(dir, "Da Chon"));
  fs.writeFileSync(path.join(dir, "root.jpg"), "x");
  fs.writeFileSync(path.join(dir, "Da Chon", "picked.jpg"), "x");

  const files = await scanFolder(dir, "salt", { skipDirs: ["dA cHon"] });

  assert.deepEqual(files.map((file) => file.name), ["root.jpg"]);
});

test("chặn đường dẫn thoát khỏi thư mục chia sẻ", async () => {
  const dir = tmp();
  const outside = tmp();
  fs.writeFileSync(path.join(dir, "a.jpg"), "x");
  fs.writeFileSync(path.join(outside, "bi-mat.jpg"), "x");
  assert.ok(await resolveInside(dir, "a.jpg"));
  assert.equal(await resolveInside(dir, `..${path.sep}${path.basename(outside)}${path.sep}bi-mat.jpg`), null);
  assert.equal(await resolveInside(dir, path.join(outside, "bi-mat.jpg")), null);
  if (process.platform !== "win32") {
    fs.symlinkSync(path.join(outside, "bi-mat.jpg"), path.join(dir, "link.jpg"));
    assert.equal(await resolveInside(dir, "link.jpg"), null);
    assert.equal((await scanFolder(dir, "s")).length, 1);
  }
});

test("cài đặt được lưu và đọc lại, token được mã hoá khi có kho khoá", () => {
  const dir = tmp();
  const cipher = { encrypt: (t) => Buffer.from(t).toString("hex"), decrypt: (t) => Buffer.from(t, "hex").toString() };
  const store = new Store(dir, cipher);
  store.set({
    deviceToken: "scdt-bi-mat",
    previousDeviceToken: "scdt-cu",
    picksFolderName: "Da chon",
    autoCopyPicks: false,
    macLoginCleanupDone: true,
    pendingExports: ["s1"],
  });
  store.setShare("s1", { folder: "/x", salt: "s", files: {} });
  assert.ok(!fs.readFileSync(path.join(dir, "settings.json"), "utf8").includes("scdt-bi-mat"));
  assert.ok(!fs.readFileSync(path.join(dir, "settings.json"), "utf8").includes("scdt-cu"));
  const again = new Store(dir, cipher);
  assert.equal(again.get("deviceToken"), "scdt-bi-mat");
  assert.equal(again.get("previousDeviceToken"), "scdt-cu");
  assert.equal(again.get("picksFolderName"), "Da chon");
  assert.equal(again.get("autoCopyPicks"), false);
  assert.equal(again.get("macLoginCleanupDone"), true);
  assert.deepEqual(again.get("pendingExports"), ["s1"]);
  assert.ok(again.getShare("s1"));
  assert.equal(again.getShare("__proto__"), null);
  fs.writeFileSync(path.join(dir, "settings.json"), "{hong");
  assert.equal(new Store(dir, cipher).get("serverUrl"), "https://studiocore.io.vn");
});

test("macOS Finder Quick Action is enabled by default", () => {
  assert.equal(new Store(tmp()).get("macQuickAction"), true);
});

test("poll initializes the submission cursor from server time", async () => {
  const store = new Store(tmp());
  const agent = new DriveAgent({ store, images: {}, appVersion: "test" });
  const controller = new AbortController();
  let requestedSince = null;
  agent.client = () => ({
    poll: async (since) => {
      requestedSince = since;
      controller.abort();
      return { now: 1234, submissions: [], jobs: [] };
    },
  });

  await agent.loop(controller.signal);

  assert.equal(requestedSince, 0);
  assert.equal(store.get("lastSubmissionCheck"), 1234);
});

test("unpair keeps local shares and re-pair sends then clears the previous token", async () => {
  const store = new Store(tmp());
  store.set({
    deviceToken: "scdt-old",
    deviceId: "device-old",
    serverUrl: "http://localhost:3000",
  });
  store.setShare("share-local", { folder: "/photos", salt: "salt", files: {} });
  const agent = new DriveAgent({ store, images: {}, appVersion: "test" });
  agent.start = () => {};
  agent.unpair();

  assert.equal(store.get("previousDeviceToken"), "scdt-old");
  assert.equal(store.get("previousServerUrl"), "http://localhost:3000");
  assert.equal(store.getShare("share-local").folder, "/photos");
  agent.client = () => ({ listShares: async () => ({ shares: [] }) });
  assert.deepEqual(await agent.listShares(), []);

  const originalFetch = global.fetch;
  let pairInput;
  global.fetch = async (_url, init) => {
    pairInput = JSON.parse(init.body);
    return Response.json({
      deviceToken: "scdt-new",
      deviceId: "device-new",
      deviceName: "Máy mới",
      studioName: "Studio",
    });
  };
  try {
    await agent.pair("code", "http://localhost:3000");
  } finally {
    global.fetch = originalFetch;
  }

  assert.equal(pairInput.previousToken, "scdt-old");
  assert.equal(store.get("previousDeviceToken"), null);
  assert.equal(store.get("previousServerUrl"), null);
  assert.equal(store.getShare("share-local").folder, "/photos");
  agent.unpair();
  assert.equal(store.get("previousDeviceToken"), "scdt-new");
});

test("does not send a previous device token to a different server origin", async () => {
  const store = new Store(tmp());
  store.set({ deviceToken: "scdt-old", serverUrl: "https://studio-old.example" });
  const agent = new DriveAgent({ store, images: {}, appVersion: "test" });
  agent.start = () => {};
  agent.unpair();

  const originalFetch = global.fetch;
  let pairInput;
  global.fetch = async (_url, init) => {
    pairInput = JSON.parse(init.body);
    return Response.json({
      deviceToken: "scdt-new",
      deviceId: "device-new",
      deviceName: "Máy mới",
      studioName: "Studio",
    });
  };
  try {
    await agent.pair("code", "https://studio-new.example/path");
  } finally {
    global.fetch = originalFetch;
  }

  assert.equal(pairInput.previousToken, undefined);
  assert.equal(store.get("previousDeviceToken"), null);
  assert.equal(store.get("previousServerUrl"), null);
});

test("suspended responses preserve the device token and retry with a 60-second cap", async () => {
  const store = new Store(tmp());
  store.set({ deviceToken: "scdt-valid", deviceId: "device-1" });
  const agent = new DriveAgent({ store, images: {}, appVersion: "test" });
  const controller = new AbortController();
  const delays = [];
  let attempts = 0;
  const originalSetTimeout = global.setTimeout;
  agent.client = () => ({
    poll: async () => {
      attempts += 1;
      throw new ApiError("Studio đang bị tạm khóa.", 403);
    },
  });
  global.setTimeout = (callback, delay, ...args) => {
    delays.push(delay);
    if (delay >= 60000) controller.abort();
    queueMicrotask(() => callback(...args));
    return {};
  };
  try {
    await agent.loop(controller.signal);
  } finally {
    global.setTimeout = originalSetTimeout;
  }

  assert.equal(store.get("deviceToken"), "scdt-valid");
  assert.equal(agent.status, "suspended");
  assert.equal(attempts, 7);
  assert.deepEqual(delays, [1000, 2000, 4000, 8000, 16000, 32000, 60000]);
});

test("failed auto-copy stays pending and retry does not emit another notification", async () => {
  const store = new Store(tmp());
  store.setShare("share-1", { folder: "/photos", salt: "salt", files: {} });
  const agent = new DriveAgent({ store, images: {}, appVersion: "test" });
  const notifications = [];
  agent.on("submission", (event) => notifications.push(event));
  agent.copyPicks = async () => {
    throw new Error("Mất kết nối");
  };

  await agent.onSubmission({ id: "share-1" });

  assert.deepEqual(store.get("pendingExports"), ["share-1"]);
  assert.equal(notifications.length, 1);
  agent.copyPicks = async () => ({ copied: 1 });
  await agent.retryPendingExports();

  assert.deepEqual(store.get("pendingExports"), []);
  assert.equal(notifications.length, 1);
});

test("fast image jobs and bulk jobs use independent concurrency limits", async () => {
  const store = new Store(tmp());
  store.setShare("share-1", {
    folder: "/photos",
    salt: "salt",
    files: { image: "a.jpg", video: "b.mp4" },
  });
  const agent = new DriveAgent({ store, images: {}, appVersion: "test" });
  const finish = [];
  agent.serve = () => new Promise((resolve) => finish.push(resolve));

  for (let index = 0; index < 5; index += 1) {
    agent.enqueue({ id: `image-${index}`, shareId: "share-1", fileKey: "image", variant: "thumb" });
  }
  for (let index = 0; index < 3; index += 1) {
    agent.enqueue({ id: `video-${index}`, shareId: "share-1", fileKey: "video", variant: "preview" });
  }

  assert.equal(agent.fastActive, 4);
  assert.equal(agent.fastQueue.length, 1);
  assert.equal(agent.bulkActive, 2);
  assert.equal(agent.bulkQueue.length, 1);

  finish[4]();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(agent.bulkActive, 2);
  assert.equal(agent.bulkQueue.length, 0);
  assert.equal(agent.fastActive, 4);
  let resolved = 0;
  while (resolved < finish.length) {
    const current = finish.slice(resolved);
    resolved = finish.length;
    current.forEach((resolve) => resolve());
    await new Promise((resolve) => setImmediate(resolve));
  }
});

test("lọc ảnh khách chọn kèm RAW, không ghi đè", async () => {
  const dir = tmp();
  for (const name of ["IMG_1.jpg", "IMG_1.ARW", "IMG_2.jpg"]) fs.writeFileSync(path.join(dir, name), name);
  const share = { folder: dir, files: { k1: "IMG_1.jpg", k2: "IMG_2.jpg", k3: "../x.jpg" } };
  const picks = [{ key: "k1", name: "IMG_1.jpg", note: "sáng hơn" }, { key: "k3", name: "x.jpg", note: null }];
  const first = await copyPicks(share, picks, "../../Chon");
  assert.equal(path.dirname(first.dest), dir);
  assert.deepEqual([first.copied, first.missing, first.codes], [2, 1, ["IMG_1"]]);
  assert.equal((await copyPicks(share, picks, "../../Chon")).copied, 0);
  assert.deepEqual(fs.readdirSync(first.dest).sort(), ["IMG_1.ARW", "IMG_1.jpg", "danh-sach-chon.txt"]);
  assert.equal(safeFolderName('..\\<>:"|?*'), "Khach-chon");
});

test("giữ thư mục con để chép các ảnh trùng tên riêng biệt", async () => {
  const dir = tmp();
  fs.mkdirSync(path.join(dir, "a"));
  fs.mkdirSync(path.join(dir, "b"));
  fs.writeFileSync(path.join(dir, "a", "IMG_1.jpg"), "a");
  fs.writeFileSync(path.join(dir, "b", "IMG_1.jpg"), "b");

  const result = await copyPicks(
    { folder: dir, files: { a: "a/IMG_1.jpg", b: "b/IMG_1.jpg" } },
    [
      { key: "a", name: "IMG_1.jpg", note: null },
      { key: "b", name: "IMG_1.jpg", note: null },
    ],
    "Khach-chon",
  );

  assert.equal(result.copied, 2);
  assert.equal(fs.readFileSync(path.join(result.dest, "a", "IMG_1.jpg"), "utf8"), "a");
  assert.equal(fs.readFileSync(path.join(result.dest, "b", "IMG_1.jpg"), "utf8"), "b");
});

test("địa chỉ máy chủ, Range và tham số dòng lệnh", () => {
  assert.equal(normalizeServerUrl("https://studiocore.io.vn/abc"), "https://studiocore.io.vn");
  assert.equal(normalizeServerUrl("http://localhost:3000"), "http://localhost:3000");
  assert.throws(() => normalizeServerUrl("http://evil.example"));
  assert.throws(() => normalizeServerUrl("file:///etc/passwd"));
  assert.deepEqual(parseRange("bytes=0-99", 1000), { start: 0, end: 99 });
  assert.deepEqual(parseRange("bytes=-100", 1000), { start: 900, end: 999 });
  assert.equal(parseRange("bytes=2000-", 1000), "invalid");
  assert.equal(parseRange(null, 1000), null);
  assert.equal(sharePathFromArgv(["app.exe", "--share", "C:\\Ảnh cưới & <b>"]), "C:\\Ảnh cưới & <b>");
  assert.equal(sharePathFromArgv(["app.exe", "--share=C:\\Ảnh cưới"]), "C:\\Ảnh cưới");
  assert.equal(
    sharePathFromArgv([
      "C:\\Program Files\\StudioCore Drive\\StudioCore Drive.exe",
      "--share",
      "--allow-file-access-from-files",
      "--original-process-start-time=1",
      "C:\\Users\\A\\Pictures\\Drive Test",
    ]),
    "C:\\Users\\A\\Pictures\\Drive Test",
  );
  assert.equal(
    sharePathFromArgv([
      "C:\\Program Files\\StudioCore Drive\\StudioCore Drive.exe",
      "--allow-file-access-from-files",
      "--share=C:\\Users\\A\\Pictures\\Drive Test",
    ]),
    "C:\\Users\\A\\Pictures\\Drive Test",
  );
  assert.equal(sharePathFromArgv(["app.exe", "--share", "C:\\Ảnh cưới", "--hidden"]), "C:\\Ảnh cưới");
  assert.equal(sharePathFromArgv(["app.exe", "--share"]), null);
  assert.equal(
    sharePathFromArgv(["StudioCore Drive.exe", ".", "--share", "--hidden"]),
    null,
  );
  assert.equal(
    sharePathFromArgv(["StudioCore Drive.exe", path.resolve(__dirname, ".."), "--share", "--hidden"]),
    null,
  );
  assert.equal(
    buildContextMenuCommand("C:\\Program Files\\StudioCore Drive\\StudioCore Drive.exe"),
    '"C:\\Program Files\\StudioCore Drive\\StudioCore Drive.exe" --share="%1"',
  );
});

test("giao diện không dùng innerHTML và có CSP chặt", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "renderer", "app.js"), "utf8");
  assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(/.test(app));
  const html = fs.readFileSync(path.join(__dirname, "..", "renderer", "index.html"), "utf8");
  assert.match(html, /default-src 'none'; script-src 'self'/);
  const main = fs.readFileSync(path.join(__dirname, "..", "main.js"), "utf8");
  assert.match(main, /contextIsolation: true/);
  assert.match(main, /sandbox: true/);
  assert.match(main, /nodeIntegration: false/);
  assert.ok(!/createServer|\.listen\(/.test(main));
});

test("macOS build explicitly ad-hoc signs without credentials and supports CSC_LINK signing", () => {
  assert.deepEqual(getMacSigningOptions({ CSC_IDENTITY_AUTO_DISCOVERY: "false" }), {
    identity: "-",
    hardenedRuntime: false,
    enableIdentityAutoDiscovery: false,
  });
  assert.deepEqual(getMacSigningOptions({ CSC_LINK: "certificate.p12", CSC_IDENTITY_AUTO_DISCOVERY: "false" }), {
    hardenedRuntime: true,
    enableIdentityAutoDiscovery: true,
  });
  assert.deepEqual(getMacSigningOptions({ CSC_NAME: "Developer ID Application: StudioCore" }), {
    hardenedRuntime: true,
    enableIdentityAutoDiscovery: false,
  });
});

test("macOS registers Finder folder and directory document types", () => {
  const documentTypes = require("../package.json").build.mac.extendInfo.CFBundleDocumentTypes;
  assert.equal(documentTypes[0].LSHandlerRank, "Alternate");
  assert.deepEqual(documentTypes[0].CFBundleTypeOSTypes, ["fold"]);
  assert.deepEqual(documentTypes[0].LSItemContentTypes, ["public.folder", "public.directory"]);
});

test("Windows notification identity matches the packaged app id and is set before launch", () => {
  const packageJson = require("../package.json");
  let actualId = null;
  setWindowsAppUserModelId({ setAppUserModelId: (id) => { actualId = id; } }, "win32");
  assert.equal(APP_USER_MODEL_ID, packageJson.build.appId);
  assert.equal(actualId, packageJson.build.appId);
});

test("login-item settings clean the Windows legacy value and preserve platform options", () => {
  for (const enabled of [false, true]) {
    const calls = [];
    applyLoginItem({ setLoginItemSettings: (settings) => calls.push(settings) }, enabled, "win32");
    assert.deepEqual(calls, [
      { openAtLogin: false, name: LEGACY_WINDOWS_LOGIN_ITEM_NAME },
      { openAtLogin: enabled, args: ["--hidden"], name: APP_USER_MODEL_ID },
    ]);
  }

  const calls = [];
  applyLoginItem({ setLoginItemSettings: (settings) => calls.push(settings) }, true, "darwin");
  assert.deepEqual(calls, [{ openAtLogin: true, args: ["--hidden"] }]);
});

test("macOS login cleanup finds the app bundle path", () => {
  assert.equal(
    macBundlePath("/Applications/StudioCore Drive.app/Contents/MacOS/StudioCore Drive"),
    "/Applications/StudioCore Drive.app",
  );
  assert.equal(macBundlePath("/usr/bin/node"), null);
});

test("macOS login cleanup passes the bundle path to osascript as an argument", async () => {
  const bundlePath = "/Applications/StudioCore Drive.app";
  let invocation = null;
  const result = await removeMacLoginItems(bundlePath, (command, args, options, callback) => {
    invocation = { command, args, options };
    callback(null, "", "");
  });

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(invocation, {
    command: "osascript",
    args: [
      "-e",
      "on run argv",
      "-e",
      'tell application "System Events" to delete (every login item whose path is (item 1 of argv))',
      "-e",
      "end run",
      bundlePath,
    ],
    options: { timeout: 30000 },
  });
});

test("macOS login cleanup resolves errors instead of rejecting", async () => {
  const error = new Error("Automation permission denied");
  const cleanup = removeMacLoginItems("/Applications/StudioCore Drive.app", (_command, _args, _options, callback) =>
    callback(error),
  );

  await assert.doesNotReject(cleanup);
  assert.deepEqual(await cleanup, { ok: false, error: error.message });
});

test("macOS Quick Action install copies templates and refreshes Finder only when changed", async () => {
  const templateDir = path.join(__dirname, "..", "assets", "mac-quick-action");
  const servicesDir = tmp();
  const contentsDir = path.join(servicesDir, `${QUICK_ACTION_NAME}.workflow`, "Contents");
  const calls = [];
  const execFileImpl = (command, args, options, callback) => {
    calls.push({ command, args, options });
    callback(null, "", "");
  };

  assert.deepEqual(await installMacQuickAction({ templateDir, servicesDir, execFileImpl }), { changed: true });
  for (const fileName of ["Info.plist", "document.wflow"]) {
    assert.deepEqual(
      await fs.promises.readFile(path.join(contentsDir, fileName)),
      await fs.promises.readFile(path.join(templateDir, fileName)),
    );
  }
  assert.deepEqual(calls, [
    {
      command: "/System/Library/CoreServices/pbs",
      args: ["-update"],
      options: { timeout: 15000 },
    },
  ]);

  assert.deepEqual(await installMacQuickAction({ templateDir, servicesDir, execFileImpl }), { changed: false });
  assert.equal(calls.length, 1);
});

test("macOS Quick Action install ignores pbs errors", async () => {
  const result = await installMacQuickAction({
    templateDir: path.join(__dirname, "..", "assets", "mac-quick-action"),
    servicesDir: tmp(),
    execFileImpl: (_command, _args, _options, callback) => callback(new Error("pbs failed")),
  });

  assert.deepEqual(result, { changed: true });
});

test("macOS Quick Action removal deletes the workflow and refreshes Finder only when present", async () => {
  const servicesDir = tmp();
  const bundlePath = path.join(servicesDir, `${QUICK_ACTION_NAME}.workflow`);
  const calls = [];
  const execFileImpl = (command, args, options, callback) => {
    calls.push({ command, args, options });
    callback(new Error("pbs failed"));
  };
  fs.mkdirSync(path.join(bundlePath, "Contents"), { recursive: true });
  fs.writeFileSync(path.join(bundlePath, "Contents", "Info.plist"), "fixture");

  await removeMacQuickAction({ servicesDir, execFileImpl });
  assert.equal(fs.existsSync(bundlePath), false);
  assert.deepEqual(calls, [
    {
      command: "/System/Library/CoreServices/pbs",
      args: ["-update"],
      options: { timeout: 15000 },
    },
  ]);

  await removeMacQuickAction({ servicesDir, execFileImpl });
  assert.equal(calls.length, 1);
});

test("macOS Quick Action templates describe a Finder folder service and have valid XML", () => {
  const templateDir = path.join(__dirname, "..", "assets", "mac-quick-action");
  const infoPlist = fs.readFileSync(path.join(templateDir, "Info.plist"), "utf8");
  const workflow = fs.readFileSync(path.join(templateDir, "document.wflow"), "utf8");

  const assertWellFormedXml = (xml) => {
    try {
      require("plist").parse(xml);
      return;
    } catch (error) {
      if (error.code !== "MODULE_NOT_FOUND") throw error;
    }

    const stack = [];
    for (const [, token] of xml.matchAll(/<([^>]+)>/g)) {
      if (token.startsWith("?") || token.startsWith("!")) continue;
      if (token.startsWith("/")) {
        assert.equal(stack.pop(), token.slice(1).trim());
      } else if (!token.endsWith("/")) {
        stack.push(token.split(/[\s/>]/, 1)[0]);
      }
    }
    assert.deepEqual(stack, []);
  };
  assertWellFormedXml(infoPlist);
  assertWellFormedXml(workflow);

  assert.match(infoPlist, /<key>CFBundleIdentifier<\/key>\s*<string>vn\.io\.studiocore\.drive\.share-folder<\/string>/);
  assert.match(infoPlist, /<key>NSSendFileTypes<\/key>\s*<array>\s*<string>public\.folder<\/string>/);
  assert.match(infoPlist, /<key>NSRequiredContext<\/key>\s*<dict>\s*<key>NSApplicationIdentifier<\/key>\s*<string>com\.apple\.finder<\/string>/);
  assert.match(infoPlist, /<key>NSMessage<\/key>\s*<string>runWorkflowAsService<\/string>/);
  const menuTitle = infoPlist.match(
    /<key>NSMenuItem<\/key>\s*<dict>\s*<key>default<\/key>\s*<string>([^<]+)<\/string>/,
  )?.[1];
  assert.equal(menuTitle, QUICK_ACTION_NAME);

  const command = workflow.match(/<key>COMMAND_STRING<\/key>\s*<string>([^<]+)<\/string>/)?.[1];
  assert.equal(command, `open -b ${APP_USER_MODEL_ID} "$@"`);
  const uuids = ["InputUUID", "OutputUUID", "UUID"].map((key) => {
    const value = workflow.match(new RegExp(`<key>${key}</key>\\s*<string>([^<]+)</string>`))?.[1];
    assert.match(value || "", /^[0-9A-F]{8}-(?:[0-9A-F]{4}-){3}[0-9A-F]{12}$/);
    return value;
  });
  assert.equal(new Set(uuids).size, 3);
  assert.ok(require("../package.json").build.files.includes("assets/mac-quick-action/**/*"));
});

test("Windows uninstall removes the registered context menu and login-item values", () => {
  const installer = fs.readFileSync(path.join(__dirname, "..", "build", "installer.nsh"), "utf8");
  const runKeyPath = WINDOWS_RUN_KEY.replace(/^HKCU\\/, "");
  const contextMenuKeyPath = CONTEXT_MENU_KEY.replace(/^HKCU\\/, "");

  assert.ok(
    installer.includes([
      "!macro customUnInstall",
      "  ${ifNot} ${isUpdated}",
      `    DeleteRegKey HKCU "${contextMenuKeyPath}"`,
      `    DeleteRegValue HKCU "${runKeyPath}" "${APP_USER_MODEL_ID}"`,
      `    DeleteRegValue HKCU "${runKeyPath}" "electron.app.StudioCore Drive"`,
      "  ${endIf}",
      "!macroend",
    ].join("\n")),
  );
  assert.ok(installer.includes(`DeleteRegKey HKCU "${contextMenuKeyPath}"`));
  assert.ok(installer.includes(`DeleteRegValue HKCU "${runKeyPath}" "${APP_USER_MODEL_ID}"`));
  assert.ok(installer.includes(`DeleteRegValue HKCU "${runKeyPath}" "electron.app.StudioCore Drive"`));
});
