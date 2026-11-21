const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { Store, validateConfig } = require("../src/store");
const { scan, classify, fileKey } = require("../src/scanner");
const { AgentApi } = require("../src/api");
const { parseQuickUrl, cloudflaredAsset, TunnelManager } = require("../src/tunnel");
const { Agent } = require("../src/agent");
const { parseArgs } = require("../cli");

async function sandbox(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "studiocore-drive-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

test("config defaults merge, validate, write atomically and keep secrets private", async (t) => {
  const root = await sandbox(t);
  const store = new Store(root);
  assert.equal(store.loadConfig().serverUrl, "https://www.studiocore.io.vn");
  await fs.writeFile(
    path.join(root, "config.json"),
    JSON.stringify({ defaults: { maxSelect: 15 } }),
  );
  assert.equal(store.loadConfig().defaults.maxSelect, 15);
  assert.equal(store.loadConfig().defaults.allowOriginals, true);
  const config = store.loadConfig();
  config.connectKey = "scd_" + "a".repeat(43);
  store.saveConfig(config);
  store.saveConfig({ ...config, deviceName: "PC mới" });
  assert.equal(store.loadConfig().deviceName, "PC mới");
  assert.deepEqual((await fs.readdir(root)).sort(), ["config.json"]);
  if (process.platform !== "win32")
    assert.equal((await fs.stat(path.join(root, "config.json"))).mode & 0o777, 0o600);
  for (const invalid of [
    { defaults: { maxSelect: 0 } },
    { cache: { maxGB: -1 } },
    { defaults: { pin: 123456 } },
    { defaults: null },
    { serverUrl: "file:///etc" },
    { connectKey: "invalid" },
  ])
    assert.throws(() => store.saveConfig(invalid));
  assert.equal(store.loadConfig().deviceName, "PC mới");
  assert.deepEqual(store.loadShares(), []);
  store.updateShares(() => []);
  assert.deepEqual(store.loadShares(), []);
  assert.throws(() => store.updateShares(() => [{ id: "bad" }]));
  assert.deepEqual(store.loadShares(), []);
  await fs.writeFile(path.join(root, "config.json"), "{");
  assert.throws(() => store.loadConfig(), /Không đọc được/);
});

test("loading an invalid legacy key clears only the in-memory key and preserves other settings", async (t) => {
  const root = await sandbox(t);
  const store = new Store(root);
  const saved = {
    deviceName: "Old PC",
    connectKey: "sc_drive_live_legacy",
    defaults: { maxSelect: 15 },
  };
  await fs.writeFile(path.join(root, "config.json"), JSON.stringify(saved));
  const config = store.loadConfig();
  assert.equal(config.connectKey, "");
  assert.equal(config.deviceName, saved.deviceName);
  assert.equal(config.defaults.maxSelect, 15);
  assert.equal(store.configWarning, "Khóa cũ không còn dùng được, hãy dán khóa mới");
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(root, "config.json"), "utf8")), saved);
  assert.throws(() => store.saveConfig(saved), /connectKey/);
  store.saveConfig({ ...config, connectKey: "scd_" + "b".repeat(43) });
  assert.equal(store.loadConfig().connectKey, "scd_" + "b".repeat(43));
  assert.equal(store.configWarning, undefined);
});

test("scanner classifies, skips hidden/system/output files and groups RAW+JPG deterministically", async (t) => {
  const root = await sandbox(t);
  await fs.mkdir(path.join(root, "set"));
  await fs.mkdir(path.join(root, "Anh_Chon_Goc"));
  await fs.mkdir(path.join(root, ".hidden"));
  for (const name of [
    "set/IMG_1.CR3",
    "set/IMG_1.JPG",
    "only.NEF",
    "pic.HEIC",
    "movie.MOV",
    "doc.txt",
    "Thumbs.db",
    "desktop.ini",
    ".hidden/a.jpg",
    "Anh_Chon_Goc/copy.jpg",
    ".secret.jpg",
  ])
    await fs.writeFile(path.join(root, name), name);
  const first = await scan(root, "album");
  const again = await scan(root, "view");
  assert.deepEqual(first.files, again.files);
  assert.equal(first.files.length, 3);
  const pair = first.files.find((file) => file.name === "IMG_1.JPG");
  assert.equal(first.mapping[pair.fileKey], "set/IMG_1.CR3");
  assert.equal(first.previews[pair.fileKey], "set/IMG_1.JPG");
  assert.equal(pair.fileKey, fileKey("set/IMG_1.JPG"));
  assert.match(pair.fileKey, /^[\w-]{24}$/);
  assert.equal((await scan(root, "folder")).files.length, 6);
  assert.equal((await scan(path.join(root, "movie.MOV"), "video")).files.length, 1);
  assert.equal((await scan(root, "video")).files.length, 1);
  assert.equal(classify("a.srw"), "raw");
  for (const ext of "cr2 cr3 nef nrw arw srf sr2 raf orf rw2 pef dng srw 3fr iiq x3f".split(" "))
    assert.equal(classify(`a.${ext}`), "raw");
  assert.equal(classify("a.WEBP"), "image");
  assert.equal(classify("a.mkv"), "video");
  assert.equal(classify("a.pdf"), "other");
  await assert.rejects(scan(root, "unknown"));
  await assert.rejects(scan(path.join(root, "absent"), "album"));
  await assert.rejects(scan(path.join(root, "only.NEF"), "album"));
});

test("scanner supports empty folders and rejects the 20,001-file cap", async (t) => {
  const root = await sandbox(t);
  assert.deepEqual((await scan(root, "album")).files, []);
  for (let start = 0; start < 20001; start += 100)
    await Promise.all(
      Array.from({ length: Math.min(100, 20001 - start) }, (_, i) =>
        fs.writeFile(path.join(root, `${start + i}.jpg`), ""),
      ),
    );
  await assert.rejects(scan(root, "album"), /20.000/);
});

test("API client sends bearer JSON to every documented endpoint and translates errors", async () => {
  const calls = [];
  const config = validateConfig({ connectKey: "scd_" + "a".repeat(43) });
  const api = new AgentApi(config, {
    fetch: async (url, options) => {
      calls.push({ url, ...options });
      return new Response("{}", { status: 200 });
    },
  });
  await api.heartbeat({ name: "PC" });
  await api.createShare({ title: "Album" });
  await api.listShares();
  await api.patchShare("id", "paused");
  await api.deleteShare("id");
  await api.selection("id");
  await api.reopen("id");
  await api.mediaSecret("id");
  assert.equal(calls.length, 8);
  assert.deepEqual(
    calls.map((call) => call.method),
    ["POST", "POST", "GET", "PATCH", "DELETE", "GET", "POST", "GET"],
  );
  assert.equal(calls[0].headers.Authorization, `Bearer ${config.connectKey}`);
  assert.match(calls[7].url, /shares\/id\/media-secret$/);
  for (const [fetch, message] of [
    [
      async () => new Response("{}", { status: 401 }),
      /Khóa kết nối không hợp lệ hoặc đã bị thu hồi/,
    ],
    [async () => new Response("bad"), /dữ liệu không hợp lệ/],
    [
      async () => {
        throw new TypeError("fetch failed");
      },
      /Không kết nối/,
    ],
    [async () => new Response('{"error":"Tệp không hợp lệ"}', { status: 400 }), /Tệp không hợp lệ/],
  ])
    await assert.rejects(new AgentApi(config, { fetch }).listShares(), message);
  await assert.rejects(
    new AgentApi(config, {
      timeout: 5,
      fetch: (_url, { signal }) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener("abort", () =>
            reject(Object.assign(new Error(), { name: "AbortError" })),
          ),
        ),
    }).listShares(),
    /quá chậm/,
  );
  await assert.rejects(new AgentApi(validateConfig({})).listShares(), /dán khóa/);
});

test("quick tunnel parser and official platform assets do not accept spoofed origins", async (t) => {
  assert.equal(
    parseQuickUrl("INF | https://pretty-blue-bird.trycloudflare.com |"),
    "https://pretty-blue-bird.trycloudflare.com",
  );
  assert.equal(parseQuickUrl("https://bird.trycloudflare.com.evil.test https://example.com"), null);
  assert.equal(parseQuickUrl("no URL"), null);
  assert.equal(parseQuickUrl("https://user@bird.trycloudflare.com"), null);
  assert.equal(cloudflaredAsset("darwin", "arm64"), "cloudflared-darwin-arm64.tgz");
  assert.equal(cloudflaredAsset("linux", "x64"), "cloudflared-linux-amd64");
  assert.equal(cloudflaredAsset("win32", "x64"), "cloudflared-windows-amd64.exe");
  assert.throws(() => cloudflaredAsset("linux", "ia32"));
  const tunnel = new TunnelManager(
    validateConfig({ tunnel: { mode: "named" } }),
    await sandbox(t),
    1234,
  );
  await assert.rejects(tunnel.start(), /namedToken/);
  const states = [];
  tunnel.on("status", (state) => states.push(state));
  await tunnel.stop();
  assert.equal(states.at(-1).status, "stopped");
});

test("agent creates standalone shares, syncs revocation/expiry and emits finalization once", async (t) => {
  const root = await sandbox(t);
  const store = new Store(path.join(root, "state"));
  await fs.writeFile(path.join(root, "one.jpg"), "image");
  let remote = {
    id: "share-1",
    title: "Album",
    mediaSecret: "a".repeat(43),
    allowOriginals: true,
    status: "active",
    expiresAt: null,
    selectionStatus: "open",
    url: "https://studio.test/drive/token",
  };
  let created;
  const api = {
    createShare: async (data) => {
      created = data;
      return { share: remote };
    },
    listShares: async () => ({ shares: remote ? [remote] : [] }),
    selection: async () => ({ items: [] }),
  };
  const agent = new Agent(store, { api });
  const result = await agent.createShare(root, "album");
  assert.equal(result.fileCount, 1);
  assert.equal(created.maxSelect, 30);
  assert.equal(agent.media, undefined);
  const events = [];
  agent.on("finalized", (event) => events.push(event));
  remote = {
    ...remote,
    selectionStatus: "finalized",
    finalizedAt: "2026-01-01T00:00:00Z",
    expiresAt: "2030-01-01T00:00:00Z",
  };
  await agent.poll();
  await agent.poll();
  assert.equal(events.length, 1);
  assert.equal(store.loadShares()[0].expiresAt, remote.expiresAt);
  remote = { ...remote, selectionStatus: "open" };
  await agent.poll();
  remote = { ...remote, selectionStatus: "finalized", finalizedAt: "2026-02-01T00:00:00Z" };
  await agent.poll();
  assert.equal(events.length, 2);
  remote = null;
  await agent.poll();
  assert.equal(store.loadShares()[0].status, "revoked");
  assert.deepEqual(parseArgs(["--path", "a b", "--kind", "album", "--max", "3"]), {
    path: "a b",
    kind: "album",
    max: "3",
  });
  assert.throws(() => parseArgs(["--bad"]));
});
