"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { FaceIndexer } = require("../src/core/faces");
const { DriveAgent } = require("../src/core/agent");

function descriptor(value) {
  return Array(128).fill(value);
}

async function createFiles(t, count, kinds = []) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "drive-face-index-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return Promise.all(
    Array.from({ length: count }, async (_, index) => {
      const filePath = path.join(root, `file-${index}.jpg`);
      await fs.writeFile(filePath, String(index).padStart(4, "0"));
      return {
        key: `key-${index}`,
        path: filePath,
        kind: kinds[index] || "image",
      };
    }),
  );
}

function fakeImages() {
  return { get: (filePath) => fs.readFile(filePath) };
}

function fakeEngine(describe) {
  return { describe, close: async () => undefined };
}

test("FaceIndexer filters kinds and skips individual failures without uploading empty results", async (t) => {
  const files = await createFiles(t, 4, ["image", "raw", "video", "other"]);
  const root = path.dirname(files[0].path);
  const cacheDir = path.join(root, "cache");
  const engine = fakeEngine(async (buffer) => {
    if (buffer.toString().trim() === "0001") throw new Error("decode failed");
    return [descriptor(0.25)];
  });
  const uploaded = [];
  const indexer = new FaceIndexer({ engine, images: fakeImages(), cacheDir });
  await indexer.indexShare("share", files, async (_shareId, batch) => uploaded.push(...batch));
  assert.deepEqual(uploaded.map((item) => item.key), ["key-0"]);
  assert.deepEqual(uploaded[0].faces, [descriptor(0.25)]);
});

test("FaceIndexer reuses its descriptor cache without invoking the engine", async (t) => {
  const [file] = await createFiles(t, 1);
  const cacheDir = path.join(path.dirname(file.path), "cache");
  const first = new FaceIndexer({
    engine: fakeEngine(async () => [descriptor(0.1)]),
    images: fakeImages(),
    cacheDir,
  });
  await first.indexShare("share", [file], async () => undefined);
  let calls = 0;
  const second = new FaceIndexer({
    engine: fakeEngine(async () => {
      calls += 1;
      throw new Error("cache should be used");
    }),
    images: fakeImages(),
    cacheDir,
  });
  await second.indexShare("share", [file], async () => undefined);
  assert.equal(calls, 0);
});

test("FaceIndexer uploads sequential batches of 25 and emits progress", async (t) => {
  const files = await createFiles(t, 52);
  const indexer = new FaceIndexer({
    engine: fakeEngine(async () => [descriptor(0.2)]),
    images: fakeImages(),
    cacheDir: path.join(path.dirname(files[0].path), "cache"),
  });
  const sizes = [];
  const progress = [];
  indexer.on("progress", (event) => progress.push(event));
  await indexer.indexShare("share", files, async (_shareId, batch) => sizes.push(batch.length));
  assert.deepEqual(sizes, [25, 25, 2]);
  assert.deepEqual(progress[0], { shareId: "share", done: 0, total: 52 });
  assert.deepEqual(progress.at(-1), { shareId: "share", done: 52, total: 52 });
});

test("FaceIndexer processes shares one at a time", async (t) => {
  const files = await createFiles(t, 2);
  let active = 0;
  let maxActive = 0;
  const indexer = new FaceIndexer({
    engine: fakeEngine(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return [descriptor(0.2)];
    }),
    images: fakeImages(),
    cacheDir: path.join(path.dirname(files[0].path), "cache"),
  });
  await Promise.all([
    indexer.indexShare("first", [files[0]], async () => undefined),
    indexer.indexShare("second", [files[1]], async () => undefined),
  ]);
  assert.equal(maxActive, 1);
});

test("DriveAgent stops face indexing on stop and unpair", () => {
  for (const action of ["stop", "unpair"]) {
    let stopped = false;
    const store = {
      get: (key) => (key === "deviceToken" ? "device-token" : null),
      set: () => undefined,
    };
    const faceIndexer = {
      on: () => undefined,
      stop: () => {
        stopped = true;
        return Promise.resolve();
      },
    };
    const agent = new DriveAgent({ store, images: {}, faceIndexer });
    agent[action]();
    assert.equal(stopped, true, `${action} should stop the face indexer`);
  }
});
