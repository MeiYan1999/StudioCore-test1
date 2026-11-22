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
const { APP_USER_MODEL_ID, setWindowsAppUserModelId } = require("../src/platform/app-identity");
const { Store } = require("../src/core/store");
const { sharePathFromArgv } = require("../src/platform/context-menu");
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
  assert.deepEqual(again.get("pendingExports"), ["s1"]);
  assert.ok(again.getShare("s1"));
  assert.equal(again.getShare("__proto__"), null);
  fs.writeFileSync(path.join(dir, "settings.json"), "{hong");
  assert.equal(new Store(dir, cipher).get("serverUrl"), "https://studiocore.io.vn");
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
  assert.equal(sharePathFromArgv(["app.exe", "--share", "C:\\Ảnh cưới", "--hidden"]), "C:\\Ảnh cưới");
  assert.equal(sharePathFromArgv(["app.exe", "--share"]), null);
  assert.equal(sharePathFromArgv(["app.exe", "--share", "--hidden"]), null);
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
