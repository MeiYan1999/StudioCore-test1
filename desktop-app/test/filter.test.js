const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { parseCodes, planFilter, copyFilter } = require("../src/filter");
test("filter parses extensions, delimiters and case-insensitive duplicate codes", () => {
  assert.deepEqual(parseCodes("IMG_1.CR3, img_1.JPG; IMG_2 | IMG_3\nIMG_4"), [
    "IMG_1",
    "IMG_2",
    "IMG_3",
    "IMG_4",
  ]);
  assert.deepEqual(parseCodes(""), []);
  assert.deepEqual(parseCodes(["Ảnh 01.JPG", "ảnh 01.CR3"]), ["Ảnh 01"]);
});
test("filter reports matches/missing/ambiguity, skips output, copies without overwrite and writes notes", async (t) => {
  const source = await fs.mkdtemp(path.join(os.tmpdir(), "drive-filter-test-"));
  t.after(() => fs.rm(source, { recursive: true, force: true }));
  await fs.mkdir(path.join(source, "nested"));
  await fs.mkdir(path.join(source, "Anh_Chon_Goc"));
  for (const name of [
    "IMG_1.CR3",
    "IMG_1.JPG",
    "nested/IMG_1.NEF",
    "IMG_2.JPG",
    "Anh_Chon_Goc/IMG_3.CR3",
  ])
    await fs.writeFile(path.join(source, name), name);
  const input = {
    source,
    mode: "both",
    codes: "IMG_1, IMG_2, IMG_3",
    title: "Album",
    customer: "An",
    notes: { IMG_1: "Giữ màu tự nhiên" },
  };
  const plan = await planFilter(input);
  assert.equal(plan.matched, 2);
  assert.equal(plan.fileCount, 4);
  assert.deepEqual(plan.missing, ["IMG_3"]);
  assert.deepEqual(plan.ambiguous, ["IMG_1"]);
  const first = await copyFilter(input);
  const second = await copyFilter(input);
  assert.equal(first.copied.length, 4);
  assert.equal(second.copied.length, 4);
  assert.notEqual(first.copied[0], second.copied[0]);
  assert.match(await fs.readFile(first.notesFile, "utf8"), /Giữ màu tự nhiên/);
  assert.match(first.text, /IMG_1, IMG_2, IMG_3/);
  assert.equal((await planFilter({ ...input, mode: "raw" })).fileCount, 2);
  assert.equal((await planFilter({ ...input, mode: "jpg" })).fileCount, 2);
  await assert.rejects(planFilter({ ...input, codes: "" }));
  await assert.rejects(planFilter({ ...input, outputName: ".." }));
  await assert.rejects(planFilter({ ...input, outputPath: source }));
  await assert.rejects(planFilter({ ...input, mode: "bad" }));
});

test("filter preserves dotted codes and strips only scanner-recognized media extensions", async (t) => {
  assert.deepEqual(parseCodes(["IMG_001.edit", "IMG_001.edit.CR3", "img_001.edit.JPG"]), [
    "IMG_001.edit",
  ]);
  assert.deepEqual(parseCodes("a.edit a.final.png b.HEIC c.NEF d.MOV e.backup"), [
    "a.edit",
    "a.final",
    "b",
    "c",
    "d",
    "e.backup",
  ]);
  const source = await fs.mkdtemp(path.join(os.tmpdir(), "drive-filter-dotted-"));
  t.after(() => fs.rm(source, { recursive: true, force: true }));
  for (const name of ["IMG_001.edit.CR3", "IMG_001.edit.JPG", "IMG_001.CR3"])
    await fs.writeFile(path.join(source, name), name);
  const input = { source, mode: "both", codes: parseCodes(["IMG_001.edit.JPG"]) };
  const plan = await planFilter(input);
  assert.equal(plan.matched, 1);
  assert.deepEqual(plan.missing, []);
  assert.deepEqual(
    plan.matches[0].files.map((file) => file.name),
    ["IMG_001.edit.CR3", "IMG_001.edit.JPG"],
  );
  const result = await copyFilter(input);
  assert.equal(result.copied.length, 2);
  assert.match(result.text, /IMG_001\.edit/);
});
