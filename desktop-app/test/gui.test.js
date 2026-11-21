const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { DesktopApp } = require("../src/gui");
const { Store } = require("../src/store");
const integration = require("../src/os-integration");

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "drive-gui-test-"));
  const store = new Store(root);
  const app = new DesktopApp(store);
  await app.start(0);
  const origin = `http://127.0.0.1:${app.port}`;
  t.after(async () => {
    await app.stop();
    await fs.rm(root, { recursive: true, force: true });
  });
  const headers = { "X-SC-Token": app.token, "Content-Type": "application/json" };
  return {
    app,
    store,
    root,
    origin,
    headers,
    post: (route, data, extra = {}) =>
      fetch(origin + route, {
        method: "POST",
        headers: { ...headers, ...extra },
        body: JSON.stringify(data),
      }),
  };
}
test("GUI binds only loopback and rejects missing token, bad Host, foreign Origin and invalid bodies", async (t) => {
  const { app, origin, headers, post } = await fixture(t);
  assert.equal(app.server.address().address, "127.0.0.1");
  assert.equal((await fetch(origin + "/api/state")).status, 401);
  assert.equal(
    (await fetch(origin + "/api/state", { headers: { "X-SC-Token": "invalid" } })).status,
    401,
  );
  const badHost = (route) =>
    new Promise((resolve, reject) => {
      const request = http.get(
        origin + route,
        { headers: { ...headers, Host: "evil.test" } },
        (response) => {
          response.resume();
          resolve(response.statusCode);
        },
      );
      request.on("error", reject);
    });
  assert.equal(await badHost("/api/state"), 403);
  assert.equal(await badHost("/"), 403);
  assert.equal(
    (await post("/api/notifications/read", {}, { Origin: "https://evil.test" })).status,
    403,
  );
  assert.equal((await post("/api/notifications/read", {}, { Origin: origin })).status, 200);
  assert.equal(
    (await post("/api/notifications/read", {}, { "Content-Type": "text/plain" })).status,
    415,
  );
  assert.equal((await post("/api/notifications/read", { value: "x".repeat(300000) })).status, 413);
  assert.equal(
    (await fetch(origin + "/api/notifications/read", { method: "POST", headers, body: "{" }))
      .status,
    400,
  );
  const index = await fetch(origin);
  assert.match(index.headers.get("content-security-policy"), /default-src 'self'/);
  assert.doesNotMatch(index.headers.get("content-security-policy"), /unsafe-inline/);
  assert.ok((await index.text()).includes(app.token));
});
test("all settings persist via API across GUI restart; private token is stable", async (t) => {
  const { app, store, root, origin, headers, post } = await fixture(t);
  const original = integration.autoStart;
  const operations = [];
  integration.autoStart = async (enabled) => operations.push(enabled);
  t.after(() => {
    integration.autoStart = original;
  });
  app.startAgent = async () => {};
  const config = store.loadConfig();
  Object.assign(config, { deviceName: "Máy ảnh chính", autoStart: true, mediaPort: 12345 });
  Object.assign(config.defaults, {
    allowOriginals: false,
    pin: "123456",
    maxSelect: 15,
    expiresDays: 0,
    rawDownload: "jpg",
  });
  Object.assign(config.filter, {
    notifyOnFinalize: false,
    autoCopyOnFinalize: true,
    mode: "both",
    outputName: "Chosen",
  });
  Object.assign(config.cache, { maxGB: 2.5, maxAgeDays: 14 });
  Object.assign(config.tunnel, {
    mode: "named",
    namedToken: "named-secret",
    namedHostname: "media.example.test",
    cloudflaredPath: "/custom/cloudflared",
  });
  assert.equal((await post("/api/settings", config)).status, 200);
  assert.deepEqual((await (await fetch(origin + "/api/state", { headers })).json()).config, config);
  assert.deepEqual(operations, [true]);
  const token = app.token;
  await app.stop();
  const restarted = new DesktopApp(store);
  await restarted.start(0);
  try {
    assert.equal(restarted.token, token);
    const result = await fetch(`http://127.0.0.1:${restarted.port}/api/state`, { headers });
    assert.deepEqual((await result.json()).config, config);
    if (process.platform !== "win32")
      for (const name of ["config.json", "gui.json", "gui-token"])
        assert.equal((await fs.stat(path.join(root, name))).mode & 0o777, 0o600);
  } finally {
    await restarted.stop();
  }
});
test("GUI handoff validates kinds/paths and dynamic rendering never interprets folder-name markup", async (t) => {
  const { post, origin, headers } = await fixture(t);
  const payload = "<img src=x onerror=alert(1)>";
  const response = await post("/api/handoff", { path: path.resolve(payload), kind: "album" });
  const result = await response.json();
  assert.equal(new URLSearchParams(result.hash.slice(8)).get("path"), path.resolve(payload));
  assert.equal((await post("/api/handoff", { path: "relative", kind: "album" })).status, 400);
  assert.equal(
    (await post("/api/handoff", { path: path.resolve(payload), kind: "bad" })).status,
    400,
  );
  const js = await (await fetch(origin + "/app.js", { headers })).text();
  assert.doesNotMatch(js, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(/);
  assert.match(js, /node\.textContent = String\(text\)/);
});
test("GUI enforces a single instance and chooses the next free port for another profile", async (t) => {
  const { app, store, root } = await fixture(t);
  await assert.rejects(new DesktopApp(store).start(0), { code: "EEXIST" });
  if (app.port === 65535) return;
  const other = new DesktopApp(new Store(path.join(root, "another-profile")));
  await other.start(app.port);
  try {
    assert.ok(other.port > app.port);
    assert.equal(other.store.read("gui.json").port, other.port);
  } finally {
    await other.stop();
  }
});
test("finalization persists unread notifications and automatically copies selected files when enabled", async (t) => {
  const { app, store, root, post } = await fixture(t);
  const source = path.join(root, "photos");
  await fs.mkdir(source);
  await fs.writeFile(path.join(source, "IMG_1.JPG"), "original");
  store.updateShares(() => [
    {
      id: "share-1",
      kind: "album",
      title: "Album",
      customerName: "An",
      rootPath: source,
      mediaSecret: "a".repeat(43),
      allowOriginals: true,
      rawDownload: "raw",
      status: "active",
      expiresAt: null,
      files: { image_01: "IMG_1.JPG" },
    },
  ]);
  const config = store.loadConfig();
  config.filter = {
    ...config.filter,
    mode: "jpg",
    notifyOnFinalize: false,
    autoCopyOnFinalize: true,
  };
  store.saveConfig(config);
  await app.onFinalize({
    shareId: "share-1",
    selection: { items: [{ code: "IMG_1", liked: true, note: "Giữ màu" }] },
  });
  assert.equal(
    await fs.readFile(path.join(source, "Anh_Chon_Goc", "IMG_1.JPG"), "utf8"),
    "original",
  );
  assert.match(
    await fs.readFile(path.join(source, "Anh_Chon_Goc", "GHI_CHU_KHACH.txt"), "utf8"),
    /Giữ màu/,
  );
  assert.equal(store.read("notifications.json")[0].read, false);
  await post("/api/notifications/read", {});
  assert.equal(store.read("notifications.json")[0].read, true);
});
