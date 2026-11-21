const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { Writable } = require("node:stream");
const { createHash } = require("node:crypto");
const { Store } = require("../src/store");
const { createMediaServer, disposition, AccessLog } = require("../src/media");
const { writeZip, crc32 } = require("../src/zip");
const { extractJpeg, embeddedJpeg, PreviewCache } = require("../src/previews");

function jpeg(extra = 4) {
  return Buffer.concat([
    Buffer.from("ffd8ffc0000b080001000101011100ffda0008010100003f00", "hex"),
    Buffer.alloc(extra, 0x10),
    Buffer.from("ffd9", "hex"),
  ]);
}

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "studiocore-drive-media-"));
  const source = path.join(root, "source");
  await fs.mkdir(source);
  const store = new Store(path.join(root, "state"));
  await fs.writeFile(path.join(source, "ảnh.jpg"), jpeg());
  await fs.writeFile(path.join(source, "clip.mp4"), "0123456789");
  const share = {
    id: "share-1",
    kind: "folder",
    rootPath: source,
    mediaSecret: "a".repeat(43),
    allowOriginals: true,
    rawDownload: "raw",
    status: "active",
    expiresAt: null,
    files: { image_01: "ảnh.jpg", video_01: "clip.mp4" },
  };
  store.updateShares(() => [share]);
  const cache = new PreviewCache(store.directory, { maxGB: 5, maxAgeDays: 30 });
  const media = createMediaServer({ store, cache });
  const port = await media.start();
  t.after(async () => {
    await media.stop();
    await fs.rm(root, { recursive: true, force: true });
  });
  const url = (key = "image_01", variant = "original", secret = share.mediaSecret) =>
    `http://127.0.0.1:${port}/m/${share.id}/${secret}/${key}/${variant}`;
  return {
    root,
    source,
    store,
    share,
    media,
    url,
    cache,
    zip: `http://127.0.0.1:${port}/z/${share.id}/${share.mediaSecret}`,
  };
}

test("media binds loopback, checks secrets, original permission, headers and expiry", async (t) => {
  const { media, url, store, share, zip } = await fixture(t);
  assert.equal(media.server.address().address, "127.0.0.1");
  const valid = await fetch(url());
  assert.equal(valid.status, 200);
  assert.equal(valid.headers.get("x-content-type-options"), "nosniff");
  assert.equal(valid.headers.get("content-type"), "image/jpeg");
  assert.match(valid.headers.get("content-disposition"), /filename\*=UTF-8''%E1%BA%A3nh.jpg/);
  assert.deepEqual(Buffer.from(await valid.arrayBuffer()), jpeg());
  assert.equal((await fetch(url("image_01", "original", "bad"))).status, 404);
  assert.equal((await fetch(url("unknown01"))).status, 404);
  assert.equal((await fetch(url("__proto__"))).status, 404);
  assert.equal((await fetch(url("image_01", "stream"))).status, 404);
  assert.equal((await fetch(url(), { method: "POST" })).status, 405);
  store.updateShares(() => [{ ...share, allowOriginals: false }]);
  assert.equal((await fetch(url())).status, 403);
  assert.equal((await fetch(zip)).status, 403);
  store.updateShares(() => [{ ...share, expiresAt: new Date(0).toISOString() }]);
  assert.equal((await fetch(url())).status, 404);
  for (const status of ["paused", "revoked"]) {
    store.updateShares(() => [{ ...share, status }]);
    assert.equal((await fetch(url())).status, 404);
  }
  assert.doesNotMatch(disposition('name"\r\n.jpg', true), /[\r\n]/);
});

test("media rejects symlinks escaping root and invalid mappings", async (t) => {
  const { root, source, store, share, url } = await fixture(t);
  const outside = path.join(root, "outside.jpg");
  await fs.writeFile(outside, "private");
  try {
    await fs.symlink(outside, path.join(source, "escape.jpg"), "file");
  } catch (error) {
    if (process.platform === "win32" && error.code === "EPERM") {
      t.skip("Symlink permission unavailable");
      return;
    }
    throw error;
  }
  store.updateShares(() => [{ ...share, files: { ...share.files, escape01: "escape.jpg" } }]);
  assert.equal((await fetch(url("escape01"))).status, 404);
  assert.throws(() =>
    store.updateShares(() => [{ ...share, files: { escape01: "../outside.jpg" } }]),
  );
});

test("failed thumbnail conversion never exposes originals without download permission", async (t) => {
  const { source, store, share, url, cache } = await fixture(t);
  await fs.writeFile(path.join(source, "private.png"), "private original, not a valid image");
  store.updateShares(() => [
    { ...share, allowOriginals: false, files: { image_01: "private.png" } },
  ]);
  for (const variant of ["thumb", "preview"])
    assert.equal((await fetch(url("image_01", variant))).status, 404);
  store.updateShares(() => [{ ...share, files: { image_01: "private.png" } }]);
  assert.equal(
    await (await fetch(url("image_01", "preview"))).text(),
    "private original, not a valid image",
  );
  const image = path.join(source, "ảnh.jpg");
  const stat = await fs.stat(image);
  const legacyHash = createHash("sha256")
    .update(`${image}\0image_01\0${stat.mtimeMs}\0${stat.size}\0thumb`)
    .digest("hex");
  await fs.writeFile(path.join(cache.directory, legacyHash + ".jpg"), jpeg());
  store.updateShares(() => [{ ...share, allowOriginals: false }]);
  assert.equal((await fetch(url("image_01", "thumb"))).status, 404);
  const raw = Buffer.concat([
    Buffer.from("private RAW header"),
    jpeg(),
    Buffer.from("private RAW tail"),
  ]);
  await fs.writeFile(path.join(source, "photo.CR3"), raw);
  store.updateShares(() => [{ ...share, allowOriginals: false, files: { image_01: "photo.CR3" } }]);
  for (const variant of ["thumb", "preview"]) {
    const response = await fetch(url("image_01", variant));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/jpeg");
    assert.notDeepEqual(Buffer.from(await response.arrayBuffer()), raw);
  }
  const derived = path.join(source, "derived.jpg");
  await fs.writeFile(derived, jpeg());
  cache.get = async () => derived;
  store.updateShares(() => [{ ...share, allowOriginals: false }]);
  assert.equal((await fetch(url("image_01", "preview"))).status, 200);
});

test("video supports HTTP Range, suffix, HEAD and 416 responses", async (t) => {
  const { url } = await fixture(t);
  for (const [range, expected] of [
    ["bytes=2-5", "2345"],
    ["bytes=-3", "789"],
    ["bytes=8-", "89"],
    ["bytes=0-99", "0123456789"],
  ]) {
    const response = await fetch(url("video_01", "stream"), { headers: { Range: range } });
    assert.equal(response.status, 206);
    assert.equal(await response.text(), expected);
    assert.equal(response.headers.get("accept-ranges"), "bytes");
  }
  for (const range of ["bytes=100-", "bytes=-0", "bytes=5-2", "bytes=0-1,3-4", "invalid"]) {
    const response = await fetch(url("video_01", "stream"), { headers: { Range: range } });
    assert.equal(response.status, 416);
    assert.equal(response.headers.get("content-range"), "bytes */10");
  }
  const head = await fetch(url("video_01", "stream"), { method: "HEAD" });
  assert.equal(head.headers.get("content-length"), "10");
  assert.equal(await head.text(), "");
});

test("streaming ZIP opens with Python zipfile, has UTF8 names and correct contents", async (t) => {
  const { root, zip } = await fixture(t);
  const response = await fetch(zip);
  assert.equal(response.status, 200);
  const file = path.join(root, "download.zip");
  await fs.writeFile(file, Buffer.from(await response.arrayBuffer()));
  const output = execFileSync(
    "python3",
    [
      "-c",
      "import sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; assert z.read('clip.mp4')==b'0123456789'; assert z.getinfo('ảnh.jpg').flag_bits & 0x800; print('ZIP OK')",
      file,
    ],
    { encoding: "utf8" },
  );
  assert.match(output, /ZIP OK/);
});

test("forced ZIP64 has descriptors/locator and opens with Python; empty ZIP is valid", async (t) => {
  const { root, source } = await fixture(t);
  assert.equal(crc32(Buffer.from("123456789")), 0xcbf43926);
  for (const empty of [false, true]) {
    const chunks = [];
    const output = new Writable({
      write(chunk, _encoding, done) {
        chunks.push(Buffer.from(chunk));
        done();
      },
    });
    await writeZip(
      empty ? [] : [{ name: "clip.mp4", path: path.join(source, "clip.mp4") }],
      output,
      { zip64Threshold: 1 },
    );
    const buffer = Buffer.concat(chunks);
    if (!empty) {
      for (const signature of ["504b0606", "504b0607", "504b0708"])
        assert.ok(buffer.includes(Buffer.from(signature, "hex")));
      assert.equal(buffer.readUInt32LE(18), 0xffffffff);
    }
    const file = path.join(root, `${empty}.zip`);
    await fs.writeFile(file, buffer);
    execFileSync("python3", [
      "-c",
      "import sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None",
      file,
    ]);
  }
  const sink = new Writable({
    write(_chunk, _encoding, done) {
      done();
    },
  });
  await assert.rejects(
    writeZip([{ name: "../escape", path: path.join(source, "clip.mp4") }], sink),
  );
});

test("extracts the largest valid embedded JPEG, including nested metadata and chunk boundaries", async (t) => {
  const { root } = await fixture(t);
  const small = jpeg(4);
  const large = jpeg(1024);
  const raw = Buffer.concat([Buffer.alloc(1024 * 1024 - 1), small, Buffer.from("RAW"), large]);
  assert.deepEqual(extractJpeg(raw), large);
  assert.equal(extractJpeg(Buffer.from("nothing")), null);
  assert.equal(extractJpeg(Buffer.from("ffd8ff001122ffd9", "hex")), null);
  const nested = Buffer.concat([
    Buffer.from("ffd8ffe1", "hex"),
    Buffer.from([0, small.length + 2]),
    small,
    large.subarray(2),
  ]);
  assert.deepEqual(extractJpeg(nested), nested);
  const file = path.join(root, "fake.CR3");
  await fs.writeFile(file, raw);
  assert.deepEqual(await embeddedJpeg(file), large);
  await fs.writeFile(file, nested);
  assert.deepEqual(await embeddedJpeg(file), nested);
});

test("RAW JPEG originals, cache hits/cleanup, and the preview concurrency limit", async (t) => {
  const { root, source, cache, store, share, url } = await fixture(t);
  const raw = path.join(source, "raw.CR3");
  await fs.writeFile(raw, Buffer.concat([Buffer.from("RAW"), jpeg(200)]));
  store.updateShares(() => [
    { ...share, rawDownload: "jpg", files: { ...share.files, rawfile1: "raw.CR3" } },
  ]);
  const response = await fetch(url("rawfile1"));
  assert.equal(response.headers.get("content-type"), "image/jpeg");
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), jpeg(200));
  const first = await cache.get(raw, "rawfile1", "embedded");
  assert.equal(await cache.get(raw, "rawfile1", "embedded"), first);
  let concurrent = 0;
  let maximum = 0;
  await Promise.all(
    Array.from({ length: 6 }, () =>
      cache.limited(async () => {
        maximum = Math.max(maximum, ++concurrent);
        await new Promise((resolve) => setTimeout(resolve, 5));
        concurrent--;
      }),
    ),
  );
  assert.equal(maximum, 2);
  await cache.clearCache();
  assert.deepEqual(await fs.readdir(cache.directory), []);
  await cache.get(raw, "rawfile1", "embedded");
  cache.settings.maxGB = 0;
  await cache.cleanup();
  assert.deepEqual(await fs.readdir(cache.directory), []);
  const log = new AccessLog(root, 1);
  await log.append({ status: 200 });
  await log.append({ status: 404 });
  assert.ok((await fs.readFile(path.join(root, "access.jsonl.1"), "utf8")).includes("200"));
  assert.ok((await fs.readFile(path.join(root, "access.jsonl"), "utf8")).includes("404"));
});
