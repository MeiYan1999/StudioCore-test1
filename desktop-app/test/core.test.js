"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { parseRange } = require("../src/core/agent");
const { DriveAgent } = require("../src/core/agent");
const { normalizeServerUrl } = require("../src/core/api");
const { copyPicks, safeFolderName } = require("../src/core/picks");
const { scanFolder, resolveInside } = require("../src/core/scanner");
const { Store } = require("../src/core/store");
const { sharePathFromArgv } = require("../src/platform/context-menu");

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
  store.set({ deviceToken: "scdt-bi-mat", picksFolderName: "Da chon", autoCopyPicks: false, pendingExports: ["s1"] });
  store.setShare("s1", { folder: "/x", salt: "s", files: {} });
  assert.ok(!fs.readFileSync(path.join(dir, "settings.json"), "utf8").includes("scdt-bi-mat"));
  const again = new Store(dir, cipher);
  assert.equal(again.get("deviceToken"), "scdt-bi-mat");
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
