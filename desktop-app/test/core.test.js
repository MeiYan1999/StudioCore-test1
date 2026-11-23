"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { parseRange } = require("../src/core/agent");
const { DriveAgent } = require("../src/core/agent");
const { ApiClient, ApiError, normalizeServerUrl } = require("../src/core/api");
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
  LEGACY_QUICK_ACTION_NAME,
  quickActionName,
  installMacQuickActions,
  removeMacQuickActions,
} = require("../src/platform/mac-quick-action");
const {
  CONTEXT_MENU_KEY,
  WINDOWS_RUN_KEY,
  buildContextMenuCommand,
  buildContextMenuRegistryEntries,
  sharePathFromArgv,
} = require("../src/platform/context-menu");
const {
  CONTEXT_ACTIONS,
  contextActionFromArgv,
  contextActionRouteFromArgv,
  findSharesForFolder,
  shareOptionsForAction,
  sharesWithPicks,
} = require("../src/platform/context-actions");
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

test("quét mọi loại tệp khi được yêu cầu và tính cả kích thước", async () => {
  const dir = tmp();
  for (const [name, contents] of [
    ["a.jpg", "jpg"],
    ["a.CR3", "raw"],
    ["b.MOV", "video"],
    ["ghi-chu.txt", "ghi chú"],
    ["README", "file"],
    [".an.txt", "ẩn"],
  ]) {
    fs.writeFileSync(path.join(dir, name), contents);
  }

  const media = await scanFolder(dir, "media");
  assert.deepEqual(media.map((file) => file.name), ["a.jpg", "b.MOV"]);
  const all = await scanFolder(dir, "all", { includeAllFiles: true });
  assert.deepEqual(
    all.map((file) => [file.name, file.kind]).sort((a, b) => a[0].localeCompare(b[0])),
    [
      ["README", "other"],
      ["a.CR3", "raw"],
      ["a.jpg", "image"],
      ["b.MOV", "video"],
      ["ghi-chu.txt", "other"],
    ].sort((a, b) => a[0].localeCompare(b[0])),
  );
  assert.equal(all.find((file) => file.name === "ghi-chu.txt").size, Buffer.byteLength("ghi chú"));
});

test("lưu chế độ quét mọi tệp để lần đồng bộ sau vẫn giữ", async () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, "ghi-chu.txt"), "first");
  const store = new Store(tmp());
  store.set({ deviceToken: "scdt-test" });
  const agent = new DriveAgent({ store, images: {} });
  let replacedFiles = [];
  agent.client = () => ({
    createShare: async () => ({ id: "share-all", url: "https://example.test/drive/share-all" }),
    replaceFiles: async (_shareId, files) => { replacedFiles = files; },
  });

  await agent.createShare(dir, { kind: "deliver", includeAllFiles: true });
  assert.equal(store.getShare("share-all").includeAllFiles, true);
  fs.writeFileSync(path.join(dir, "more.txt"), "second");
  const result = await agent.rescanShare("share-all");

  assert.equal(result.count, 2);
  assert.deepEqual(replacedFiles.map((file) => file.kind), ["other", "other"]);
  assert.equal(store.getShare("share-all").includeAllFiles, true);
});

test("tác vụ Explorer dùng danh sách lệnh có thứ tự, trích dẫn và dấu phân cách", () => {
  const exePath = "C:\\Program Files\\StudioCore Drive\\StudioCore Drive.exe";
  const entries = buildContextMenuRegistryEntries(exePath);
  assert.deepEqual(
    CONTEXT_ACTIONS.map(({ id, label }) => [id, label]),
    [
      ["select", "Tạo album chọn ảnh cho khách"],
      ["view", "Tạo album xem & tải (không chọn)"],
      ["folder", "Chia sẻ thư mục cho khách tải về"],
      ["copylink", "Copy link đã chia sẻ"],
      ["picks", "Lọc ảnh khách chọn"],
      ["rescan", "Đồng bộ ngay với thư mục"],
      ["toggle", "Bật / tắt chia sẻ"],
      ["open", "Mở StudioCore Drive"],
    ],
  );
  const rootEntries = entries.filter((entry) => entry.key === CONTEXT_MENU_KEY);
  assert.deepEqual(rootEntries, [
    { key: CONTEXT_MENU_KEY, value: "MUIVerb", type: "REG_SZ", data: "StudioCore Drive" },
    { key: CONTEXT_MENU_KEY, value: "Icon", type: "REG_SZ", data: `"${exePath}"` },
    { key: CONTEXT_MENU_KEY, value: "SubCommands", type: "REG_SZ", data: "" },
  ]);
  for (const [index, action] of CONTEXT_ACTIONS.entries()) {
    const itemKey = `${CONTEXT_MENU_KEY}\\shell\\${String(index + 1).padStart(2, "0")}${action.id}`;
    assert.ok(entries.some((entry) => entry.key === itemKey && entry.value === "MUIVerb" && entry.data === action.label));
    assert.ok(
      entries.some(
        (entry) =>
          entry.key === `${itemKey}\\command` &&
          entry.data === `"${exePath}" --action=${action.id} --share="%1"`,
      ),
    );
  }
  const folderKey = `${CONTEXT_MENU_KEY}\\shell\\03folder`;
  assert.ok(
    entries.some(
      (entry) =>
        entry.key === folderKey &&
        entry.value === "CommandFlags" &&
        entry.type === "REG_DWORD" &&
        entry.data === "0x20",
    ),
  );
});

test("tác vụ dòng lệnh chỉ nhận ID được phép và mặc định mở ứng dụng", () => {
  assert.equal(contextActionFromArgv(["app.exe", "--action=select"]), "select");
  assert.equal(contextActionFromArgv(["app.exe", "--action=folder"]), "folder");
  assert.equal(contextActionFromArgv(["app.exe", '--action=select" --share=C:\\secret']), "open");
  assert.equal(contextActionFromArgv(["app.exe", "--action=delete"]), "open");
  assert.equal(contextActionFromArgv(["app.exe"]), null);
  assert.equal(contextActionRouteFromArgv(["app.exe"]), "show");
  assert.equal(contextActionRouteFromArgv(["app.exe", "--hidden"]), "hidden");
  assert.equal(contextActionRouteFromArgv(["app.exe", "--action=select", "--share=C:\\Photos"]), "context");
  assert.equal(contextActionRouteFromArgv(["app.exe", "--action=delete"]), "show");
  assert.equal(contextActionRouteFromArgv(["app.exe", "--hidden", "--action=delete"]), "hidden");
  assert.deepEqual(shareOptionsForAction("select"), {
    kind: "select",
    allowOriginal: false,
    includeAllFiles: false,
  });
  assert.deepEqual(shareOptionsForAction("view"), {
    kind: "deliver",
    allowOriginal: true,
    includeAllFiles: false,
  });
  assert.deepEqual(shareOptionsForAction("folder"), {
    kind: "deliver",
    allowOriginal: true,
    includeAllFiles: true,
  });
});

test("lọc ảnh chọn ưu tiên share đã gửi và bỏ qua share mới nhất chưa có ảnh chọn", () => {
  const matches = sharesWithPicks([
    { id: "newest-empty", pickedCount: 0, createdAt: 300, submittedAt: null },
    { id: "newest-active", pickedCount: 1, createdAt: 400, submittedAt: null },
    { id: "older-submitted", pickedCount: 2, createdAt: 100, submittedAt: 150 },
    { id: "newer-submitted", pickedCount: 1, createdAt: 200, submittedAt: 250 },
  ]);

  assert.deepEqual(matches.map((share) => share.id), ["newer-submitted", "older-submitted", "newest-active"]);
});

test("tìm share theo realpath và so sánh không phân biệt hoa thường trên Windows", async () => {
  const folder = tmp();
  const alias = path.join(tmp(), "alias");
  if (process.platform !== "win32") {
    fs.symlinkSync(folder, alias, "dir");
    const shares = [
      { id: "alias", folder: alias },
      { id: "other", folder: tmp() },
    ];
    assert.deepEqual((await findSharesForFolder(shares, folder)).map((share) => share.id), ["alias"]);
  }

  const winShares = [{ id: "windows", folder: "C:\\Users\\Studio\\Photos" }];
  const winMatches = await findSharesForFolder(
    winShares,
    "c:\\users\\studio\\photos",
    "win32",
    async (value) => value,
  );
  assert.deepEqual(winMatches.map((share) => share.id), ["windows"]);
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
  assert.equal(new Store(dir, cipher).get("serverUrl"), "https://www.studiocore.io.vn");
});

test("Store defaults to the canonical host and migrates exact apex URLs", () => {
  assert.equal(new Store(tmp()).get("serverUrl"), "https://www.studiocore.io.vn");

  const legacyDir = tmp();
  fs.writeFileSync(path.join(legacyDir, "settings.json"), JSON.stringify({
    serverUrl: "https://studiocore.io.vn",
    previousServerUrl: "https://studiocore.io.vn",
  }));
  const migrated = new Store(legacyDir);
  assert.equal(migrated.get("serverUrl"), "https://www.studiocore.io.vn");
  assert.equal(migrated.get("previousServerUrl"), "https://www.studiocore.io.vn");

  const otherDir = tmp();
  fs.writeFileSync(path.join(otherDir, "settings.json"), JSON.stringify({
    serverUrl: "https://example.com",
    previousServerUrl: "http://localhost:3000",
  }));
  const unchanged = new Store(otherDir);
  assert.equal(unchanged.get("serverUrl"), "https://example.com");
  assert.equal(unchanged.get("previousServerUrl"), "http://localhost:3000");
});

test("macOS Finder Quick Action is enabled by default", () => {
  assert.equal(new Store(tmp()).get("macQuickAction"), true);
  assert.equal(new Store(tmp()).get("keepAwake"), false);
  assert.equal(new Store(tmp()).get("defaultMessageSelect"), "");
  assert.equal(new Store(tmp()).get("defaultMessageDeliver"), "");
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

test("apex-to-www re-pair keeps the previous device token", async () => {
  const store = new Store(tmp());
  store.set({
    serverUrl: "https://www.studiocore.io.vn",
    previousServerUrl: "https://www.studiocore.io.vn",
    previousDeviceToken: "old",
  });
  const agent = new DriveAgent({ store, images: {}, appVersion: "test" });
  agent.start = () => {};

  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async (url, init) => {
    requests.push({ url: String(url), body: JSON.parse(init.body) });
    if (requests.length === 1) {
      return new Response(null, {
        status: 307,
        headers: { location: "https://www.studiocore.io.vn/api/drive/agent/pair" },
      });
    }
    return Response.json({
      deviceToken: "new",
      deviceId: "device-new",
      deviceName: "Máy mới",
      studioName: "Studio",
    });
  };
  try {
    await agent.pair("code", "https://studiocore.io.vn");
  } finally {
    global.fetch = originalFetch;
  }

  assert.equal(requests.length, 2);
  assert.equal(requests[1].url, "https://www.studiocore.io.vn/api/drive/agent/pair");
  assert.equal(requests[0].body.previousToken, undefined);
  assert.equal(requests[1].body.previousToken, "old");
  assert.equal(store.get("serverUrl"), "https://www.studiocore.io.vn");
});

test("previous token follows an apex-to-www redirect from its own origin", async () => {
  const serverUrl = "https://studiocore.io.vn";
  const store = new Store(tmp());
  store.set({ previousServerUrl: serverUrl, previousDeviceToken: "old" });
  const agent = new DriveAgent({ store, images: {}, appVersion: "test" });
  agent.start = () => {};

  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async (url, init) => {
    requests.push({ url: String(url), body: JSON.parse(init.body) });
    if (requests.length === 1) {
      return new Response(null, {
        status: 307,
        headers: { location: "https://www.studiocore.io.vn/api/drive/agent/pair" },
      });
    }
    return Response.json({
      deviceToken: "new",
      deviceId: "device-new",
      deviceName: "Máy mới",
      studioName: "Studio",
    });
  };
  try {
    await agent.pair("code", serverUrl);
  } finally {
    global.fetch = originalFetch;
  }

  assert.equal(requests.length, 2);
  assert.equal(requests[0].url, `${serverUrl}/api/drive/agent/pair`);
  assert.equal(requests[0].body.previousToken, "old");
  assert.equal(requests[1].url, "https://www.studiocore.io.vn/api/drive/agent/pair");
  assert.equal(requests[1].body.previousToken, "old");
});

test("same-origin www re-pair sends the previous device token on the first request", async () => {
  const serverUrl = "https://www.studiocore.io.vn";
  const store = new Store(tmp());
  store.set({ previousServerUrl: serverUrl, previousDeviceToken: "old" });
  const agent = new DriveAgent({ store, images: {}, appVersion: "test" });
  agent.start = () => {};

  const originalFetch = global.fetch;
  let request;
  global.fetch = async (url, init) => {
    request = { url: String(url), body: JSON.parse(init.body) };
    return Response.json({
      deviceToken: "new",
      deviceId: "device-new",
      deviceName: "Máy mới",
      studioName: "Studio",
    });
  };
  try {
    await agent.pair("code", serverUrl);
  } finally {
    global.fetch = originalFetch;
  }

  assert.equal(request.url, `${serverUrl}/api/drive/agent/pair`);
  assert.equal(request.body.previousToken, "old");
});

test("re-pair with an unrelated server never sends the previous device token", async () => {
  const store = new Store(tmp());
  store.set({
    previousServerUrl: "https://www.studiocore.io.vn",
    previousDeviceToken: "old",
  });
  const agent = new DriveAgent({ store, images: {}, appVersion: "test" });
  agent.start = () => {};

  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async (url, init) => {
    requests.push({ url: String(url), body: JSON.parse(init.body) });
    return Response.json({
      deviceToken: "new",
      deviceId: "device-new",
      deviceName: "Máy mới",
      studioName: "Studio",
    });
  };
  try {
    await agent.pair("code", "https://example.com");
  } finally {
    global.fetch = originalFetch;
  }

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://example.com/api/drive/agent/pair");
  assert.ok(requests.every(({ body }) => body.previousToken === undefined));
});

test("Node fetch exposes redirect status and Location in manual mode", async (t) => {
  const server = http.createServer((_request, response) => {
    response.writeHead(307, { location: "/destination" });
    response.end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const response = await fetch(`http://127.0.0.1:${server.address().port}/source`, { redirect: "manual" });

  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "/destination");
  assert.notEqual(response.type, "opaqueredirect");
});

test("pair follows one apex/www redirect in either direction", async () => {
  const path = "/api/drive/agent/pair";
  const directions = [
    ["https://studiocore.io.vn", "https://www.studiocore.io.vn"],
    ["https://www.studiocore.io.vn", "https://studiocore.io.vn"],
  ];
  const originalFetch = global.fetch;
  try {
    for (const [source, target] of directions) {
      const requests = [];
      global.fetch = async (url, options) => {
        requests.push({ url: String(url), options });
        if (requests.length === 1) {
          return new Response(null, { status: 307, headers: { location: `${target}${path}` } });
        }
        return Response.json({ deviceToken: "scdt-test" });
      };

      const client = new ApiClient({ serverUrl: source, appVersion: "test" });
      assert.deepEqual(await client.pair({ code: "pair-code" }), { deviceToken: "scdt-test" });
      assert.equal(client.serverUrl, target);
      assert.deepEqual(requests.map(({ url }) => url), [`${source}${path}`, `${target}${path}`]);
      assert.deepEqual(requests.map(({ options }) => options.redirect), ["manual", "error"]);
      assert.ok(requests.every(({ options }) => options.method === "POST"));
    }
  } finally {
    global.fetch = originalFetch;
  }
});

test("pair rejects redirects to another host, path, or port without retrying", async () => {
  const path = "/api/drive/agent/pair";
  const redirects = [
    ["https://evil.example/api/drive/agent/pair", "https://evil.example"],
    ["https://www.studiocore.io.vn/api/drive/agent/other", "https://www.studiocore.io.vn"],
    ["https://www.studiocore.io.vn:8443/api/drive/agent/pair", "https://www.studiocore.io.vn:8443"],
  ];
  const originalFetch = global.fetch;
  try {
    for (const [location, origin] of redirects) {
      const requests = [];
      global.fetch = async (url, options) => {
        requests.push({ url: String(url), options });
        return new Response(null, { status: 307, headers: { location } });
      };
      const client = new ApiClient({ serverUrl: "https://studiocore.io.vn", appVersion: "test" });

      await assert.rejects(client.pair({ code: "pair-code" }), (error) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.status, 307);
        assert.ok(error.message.includes(`Máy chủ chuyển hướng tới địa chỉ khác: ${origin}.`));
        return true;
      });
      assert.equal(requests.length, 1);
      assert.equal(requests[0].url, `https://studiocore.io.vn${path}`);
      assert.equal(requests[0].options.redirect, "manual");
    }
  } finally {
    global.fetch = originalFetch;
  }
});

test("authenticated non-pair requests continue to reject redirects", async () => {
  const client = new ApiClient({
    serverUrl: "https://www.studiocore.io.vn",
    token: "scdt-secret",
    appVersion: "test",
  });
  const originalFetch = global.fetch;
  let request;
  global.fetch = async (url, options) => {
    request = { url: String(url), options };
    return Response.json({ now: 0, submissions: [], jobs: [] });
  };
  try {
    await client.poll(0, 0);
  } finally {
    global.fetch = originalFetch;
  }

  assert.equal(request.options.redirect, "error");
  assert.equal(request.options.headers.authorization, "Bearer scdt-secret");
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
    buildContextMenuCommand("C:\\Program Files\\StudioCore Drive\\StudioCore Drive.exe", "select"),
    '"C:\\Program Files\\StudioCore Drive\\StudioCore Drive.exe" --action=select --share="%1"',
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

test("macOS installs a distinct Finder Quick Action per action and removes the legacy workflow", async () => {
  const templateDir = path.join(__dirname, "..", "assets", "mac-quick-action");
  const servicesDir = tmp();
  const legacyPath = path.join(servicesDir, `${LEGACY_QUICK_ACTION_NAME}.workflow`);
  fs.mkdirSync(legacyPath);
  const calls = [];
  const execFileImpl = (command, args, options, callback) => {
    calls.push({ command, args, options });
    callback(null, "", "");
  };

  assert.deepEqual(await installMacQuickActions({ templateDir, servicesDir, execFileImpl }), { changed: true });
  assert.equal(fs.existsSync(legacyPath), false);
  const toggleAction = CONTEXT_ACTIONS.find(({ id }) => id === "toggle");
  assert.equal(quickActionName(toggleAction), "StudioCore Drive – Bật – tắt chia sẻ");
  const unsafeName = quickActionName({ label: 'A/B\\C:<>"|?*\u0000' });
  assert.equal(unsafeName, "StudioCore Drive – A–B–C");
  assert.doesNotMatch(unsafeName, /[\\/:*?"<>|\u0000-\u001f]/);
  const bundleIds = new Set();
  for (const action of CONTEXT_ACTIONS) {
    const workflowPath = path.join(servicesDir, `${quickActionName(action)}.workflow`);
    assert.equal(path.dirname(workflowPath), servicesDir);
    const contentsDir = path.join(workflowPath, "Contents");
    const info = await fs.promises.readFile(path.join(contentsDir, "Info.plist"), "utf8");
    const workflow = await fs.promises.readFile(path.join(contentsDir, "document.wflow"), "utf8");
    assert.ok(info.includes(`<string>${quickActionName(action).replaceAll("&", "&amp;")}</string>`));
    assert.ok(info.includes(`<string>vn.io.studiocore.drive.context.${action.id}</string>`));
    const command = workflow.match(/<key>COMMAND_STRING<\/key>\s*<string>([^<]+)<\/string>/)?.[1];
    assert.equal(command, `open -n -a "StudioCore Drive" --args --action=${action.id} --share="$@"`);
    const bundleId = info.match(/<key>CFBundleIdentifier<\/key>\s*<string>([^<]+)<\/string>/)?.[1];
    bundleIds.add(bundleId);
  }
  assert.equal(bundleIds.size, CONTEXT_ACTIONS.length);
  assert.deepEqual(calls, [
    {
      command: "/System/Library/CoreServices/pbs",
      args: ["-update"],
      options: { timeout: 15000 },
    },
  ]);

  assert.deepEqual(await installMacQuickActions({ templateDir, servicesDir, execFileImpl }), { changed: false });
  assert.equal(calls.length, 1);
});

test("macOS Quick Action install ignores pbs errors", async () => {
  const result = await installMacQuickActions({
    templateDir: path.join(__dirname, "..", "assets", "mac-quick-action"),
    servicesDir: tmp(),
    execFileImpl: (_command, _args, _options, callback) => callback(new Error("pbs failed")),
  });

  assert.deepEqual(result, { changed: true });
});

test("macOS Quick Action removal deletes every workflow and refreshes Finder only when present", async () => {
  const servicesDir = tmp();
  const names = [LEGACY_QUICK_ACTION_NAME, ...CONTEXT_ACTIONS.map(quickActionName)];
  const bundlePaths = names.map((name) => path.join(servicesDir, `${name}.workflow`));
  const calls = [];
  const execFileImpl = (command, args, options, callback) => {
    calls.push({ command, args, options });
    callback(new Error("pbs failed"));
  };
  for (const bundlePath of bundlePaths) {
    fs.mkdirSync(path.join(bundlePath, "Contents"), { recursive: true });
    fs.writeFileSync(path.join(bundlePath, "Contents", "Info.plist"), "fixture");
  }

  await removeMacQuickActions({ servicesDir, execFileImpl });
  assert.ok(bundlePaths.every((bundlePath) => !fs.existsSync(bundlePath)));
  assert.deepEqual(calls, [
    {
      command: "/System/Library/CoreServices/pbs",
      args: ["-update"],
      options: { timeout: 15000 },
    },
  ]);

  await removeMacQuickActions({ servicesDir, execFileImpl });
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
  assert.equal(menuTitle, LEGACY_QUICK_ACTION_NAME);

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

test("exports customer markup as a correctly sized composite JPEG", async () => {
  const sharp = require("sharp");
  const dir = tmp();
  const source = path.join(dir, "photo.jpg");
  await sharp({ create: { width: 100, height: 50, channels: 3, background: { r: 0, g: 0, b: 0 } } })
    .jpeg()
    .toFile(source);

  await copyPicks(
    { folder: dir, files: { photo: "photo.jpg" } },
    [{
      key: "photo",
      name: "photo.jpg",
      note: null,
      markup: {
        v: 1,
        strokes: [{ c: "#ef4444", w: 0.08, p: [[0.1, 0.5], [0.9, 0.5]] }],
        notes: { "#ef4444": "Làm sáng vùng này" },
      },
    }],
    "Khach-chon",
    { sharp },
  );

  const output = path.join(dir, "Khach-chon", "Khách note màu", "photo_note.jpg");
  assert.ok(fs.existsSync(output));
  const { data, info } = await sharp(output).raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 100);
  assert.equal(info.height, 50);
  const pixel = (25 * info.width + 50) * info.channels;
  assert.ok(data[pixel] > 160);
  assert.ok(data[pixel + 1] < 100);
  assert.ok(fs.readFileSync(path.join(dir, "Khach-chon", "danh-sach-chon.txt"), "utf8").includes(
    "Ghi chú vẽ của khách:\r\nphoto.jpg: đỏ: Làm sáng vùng này",
  ));
});

test("customer markup composites mirror the source subfolder", async () => {
  const sharp = require("sharp");
  const dir = tmp();
  fs.mkdirSync(path.join(dir, "gallery"));
  await sharp({ create: { width: 40, height: 20, channels: 3, background: { r: 0, g: 0, b: 0 } } })
    .jpeg()
    .toFile(path.join(dir, "gallery", "photo.jpeg"));

  const result = await copyPicks(
    { folder: dir, files: { photo: "gallery/photo.jpeg" } },
    [{
      key: "photo",
      name: "photo.jpeg",
      note: null,
      markup: { v: 1, strokes: [{ c: "#ef4444", w: 0.04, p: [[0.1, 0.5]] }], notes: {} },
    }],
    "Khach-chon",
    { sharp },
  );

  assert.ok(fs.existsSync(path.join(result.dest, "Khách note màu", "gallery", "photo_note.jpg")));
  assert.ok(!fs.existsSync(path.join(result.dest, "Khách note màu", "photo_note.jpg")));
});

test("resubmitting customer markup replaces the existing composite", async () => {
  const sharp = require("sharp");
  const dir = tmp();
  const source = path.join(dir, "photo.jpg");
  await sharp({ create: { width: 100, height: 50, channels: 3, background: { r: 0, g: 0, b: 0 } } })
    .jpeg()
    .toFile(source);
  const share = { folder: dir, files: { photo: "photo.jpg" } };
  const pick = (color) => ({
    key: "photo",
    name: "photo.jpg",
    note: null,
    markup: { v: 1, strokes: [{ c: color, w: 0.08, p: [[0.1, 0.5], [0.9, 0.5]] }], notes: {} },
  });
  const output = path.join(dir, "Khach-chon", "Khách note màu", "photo_note.jpg");

  await copyPicks(share, [pick("#ef4444")], "Khach-chon", { sharp });
  await copyPicks(share, [pick("#3b82f6")], "Khach-chon", { sharp });

  const { data, info } = await sharp(output).raw().toBuffer({ resolveWithObject: true });
  const pixel = (25 * info.width + 50) * info.channels;
  assert.ok(data[pixel] < 140);
  assert.ok(data[pixel + 2] > 150);
});

test("same-stem customer markup exports use stable extension-aware names", async () => {
  const sharp = require("sharp");
  const dir = tmp();
  fs.mkdirSync(path.join(dir, "gallery"));
  const image = await sharp({
    create: { width: 100, height: 50, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .jpeg()
    .toBuffer();
  fs.writeFileSync(path.join(dir, "gallery", "a.jpg"), image);
  fs.writeFileSync(path.join(dir, "gallery", "a.png"), image);

  const share = { folder: dir, files: { jpg: "gallery/a.jpg", png: "gallery/a.png" } };
  const picks = ["jpg", "png"].map((key, index) => ({
      key,
      name: `a.${index ? "png" : "jpg"}`,
      note: null,
      markup: {
        v: 1,
        strokes: [{ c: index ? "#3b82f6" : "#ef4444", w: 0.04, p: [[0.1, 0.5], [0.9, 0.5]] }],
        notes: {},
      },
    }));
  const result = await copyPicks(share, picks, "Khach-chon", { sharp });
  const markupDir = path.join(result.dest, "Khách note màu", "gallery");
  assert.deepEqual(fs.readdirSync(markupDir).sort(), ["a_note.jpg", "a_png_note.jpg"]);
  assert.ok(fs.statSync(path.join(markupDir, "a_note.jpg")).size > 0);
  assert.ok(fs.statSync(path.join(markupDir, "a_png_note.jpg")).size > 0);

  await copyPicks(share, [picks[1]], "Khach-chon", { sharp });
  assert.deepEqual(fs.readdirSync(markupDir).sort(), ["a_note.jpg", "a_png_note.jpg"]);
});

test("concurrent markup exports use independent temp files", async () => {
  const sharp = require("sharp");
  const dir = tmp();
  await sharp({ create: { width: 100, height: 50, channels: 3, background: { r: 0, g: 0, b: 0 } } })
    .jpeg()
    .toFile(path.join(dir, "photo.jpg"));
  const share = { folder: dir, files: { photo: "photo.jpg" } };
  const pick = {
    key: "photo",
    name: "photo.jpg",
    note: null,
    markup: { v: 1, strokes: [{ c: "#ef4444", w: 0.08, p: [[0.1, 0.5], [0.9, 0.5]] }], notes: {} },
  };

  const [first, second] = await Promise.all([
    copyPicks(share, [pick], "Khach-chon", { sharp }),
    copyPicks(share, [pick], "Khach-chon", { sharp }),
  ]);

  const markupDir = path.join(first.dest, "Khách note màu");
  assert.equal(first.dest, second.dest);
  assert.ok(fs.existsSync(path.join(markupDir, "photo_note.jpg")));
  assert.deepEqual(fs.readdirSync(markupDir).filter((name) => name.endsWith(".tmp")), []);
});

test("markup export failure does not prevent picked files or the pick list from being written", async () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, "unreadable.jpg"), "not a decodable image");
  const result = await copyPicks(
    { folder: dir, files: { bad: "unreadable.jpg" } },
    [{
      key: "bad",
      name: "unreadable.jpg",
      note: null,
      markup: { v: 1, strokes: [{ c: "#ef4444", w: 0.01, p: [[0.1, 0.2]] }], notes: {} },
    }],
    "Khach-chon",
  );

  assert.equal(result.copied, 1);
  assert.equal(result.markupFailed, 1);
  assert.ok(fs.existsSync(path.join(result.dest, "unreadable.jpg")));
  assert.ok(fs.existsSync(path.join(result.dest, "danh-sach-chon.txt")));
});
