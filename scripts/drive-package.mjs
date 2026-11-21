import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";
import zipRuntime from "../desktop-app/src/zip.js";

const { crc32 } = zipRuntime;
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const excluded = new Set(["test", "tests", "data", "node_modules", "cache", "bin"]);

async function collect(source, relative, entries) {
  const full = path.join(source, relative);
  const stat = await fs.lstat(full);
  if (stat.isSymbolicLink()) throw new Error(`Cannot package a symlink: ${relative}`);
  if (stat.isDirectory()) {
    for (const name of (await fs.readdir(full)).sort()) {
      if (name.startsWith(".") || excluded.has(name) || name.endsWith(".log")) continue;
      await collect(source, path.join(relative, name), entries);
    }
  } else if (stat.isFile()) {
    const name = relative.split(path.sep).join("/");
    const executable =
      name.endsWith(".command") || name.endsWith("/app-launcher") || name === "cli.js";
    entries.push({
      name: `StudioCore Drive/${name}`,
      mode: executable ? 0o100755 : 0o100644,
      data: await fs.readFile(full),
    });
  } else throw new Error(`Cannot package a special file: ${relative}`);
}

function zip(entries) {
  const parts = [];
  const directory = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const compressed = deflateRawSync(entry.data, { level: 9 });
    const checksum = crc32(entry.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(33, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50);
    central.writeUInt16LE(0x0314, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(33, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE((entry.mode << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    parts.push(local, name, compressed);
    directory.push(central, name);
    offset += local.length + name.length + compressed.length;
  }
  const central = Buffer.concat(directory);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, central, end]);
}

export async function buildPackages({
  sourceDirectory = path.join(repository, "desktop-app"),
  outputDirectory = path.join(repository, "public", "downloads"),
} = {}) {
  await fs.mkdir(outputDirectory, { recursive: true });
  const results = [];
  for (const platform of ["Windows", "macOS"]) {
    const entries = [];
    const roots = [
      "cli.js",
      "package.json",
      "README.md",
      "src",
      ...(platform === "Windows" ? ["windows"] : ["macos", "install.command", "uninstall.command"]),
    ];
    for (const relative of roots) await collect(sourceDirectory, relative, entries);
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    const archive = zip(entries);
    const filename = `StudioCore-Drive-${platform}.zip`;
    const target = path.join(outputDirectory, filename);
    const temporary = target + `.${process.pid}.tmp`;
    try {
      await fs.writeFile(temporary, archive);
      await fs.rename(temporary, target);
    } finally {
      await fs.rm(temporary, { force: true });
    }
    results.push({ filename, files: entries.length, bytes: archive.length });
  }
  return results;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const result of await buildPackages())
    console.log(`${result.filename}: ${result.files} files, ${result.bytes} bytes`);
}
