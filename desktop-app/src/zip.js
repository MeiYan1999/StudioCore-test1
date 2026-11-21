const fs = require("node:fs/promises");

const table = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  return value >>> 0;
});
function updateCrc(crc, buffer) {
  for (const byte of buffer) crc = (crc >>> 8) ^ table[(crc ^ byte) & 255];
  return crc >>> 0;
}
function crc32(buffer) {
  return (updateCrc(0xffffffff, buffer) ^ 0xffffffff) >>> 0;
}

function dosDate(date) {
  const year = Math.max(1980, Math.min(2107, date.getFullYear()));
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

async function writeZip(entries, output, { zip64Threshold = 0xffffffffn, signal } = {}) {
  const threshold = BigInt(zip64Threshold);
  let offset = 0n;
  const directory = [];
  async function write(buffer) {
    signal?.throwIfAborted();
    if (output.destroyed) throw new Error("Kết nối ZIP đã đóng.");
    await new Promise((resolve, reject) =>
      output.write(buffer, (error) => (error ? reject(error) : resolve())),
    );
    offset += BigInt(buffer.length);
  }
  for (const entry of entries) {
    if (
      !entry.name ||
      /[\\\x00]/.test(entry.name) ||
      entry.name.split("/").some((part) => !part || part === "." || part === "..") ||
      /^[a-z]:/i.test(entry.name)
    )
      throw new Error("Tên tệp ZIP không hợp lệ.");
    const name = Buffer.from(entry.name, "utf8");
    if (name.length > 65535) throw new Error("Tên tệp ZIP quá dài.");
    const handle = entry.open ? await entry.open() : await fs.open(entry.path, "r");
    try {
      const stat = await handle.stat({ bigint: true });
      if (!stat.isFile()) throw new Error("Chỉ có thể ZIP tệp thông thường.");
      const size = stat.size;
      const zip64 = size >= threshold || offset >= threshold;
      const start = offset;
      const stamp = dosDate(new Date(Number(stat.mtimeMs)));
      const extra = Buffer.alloc(zip64 ? 20 : 0);
      if (zip64) {
        extra.writeUInt16LE(1, 0);
        extra.writeUInt16LE(16, 2);
        extra.writeBigUInt64LE(size, 4);
        extra.writeBigUInt64LE(size, 12);
      }
      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0);
      local.writeUInt16LE(zip64 ? 45 : 20, 4);
      local.writeUInt16LE(0x0808, 6);
      local.writeUInt16LE(stamp.time, 10);
      local.writeUInt16LE(stamp.date, 12);
      local.writeUInt32LE(zip64 ? 0xffffffff : 0, 18);
      local.writeUInt32LE(zip64 ? 0xffffffff : 0, 22);
      local.writeUInt16LE(name.length, 26);
      local.writeUInt16LE(extra.length, 28);
      await write(local);
      await write(name);
      if (extra.length) await write(extra);
      let crc = 0xffffffff;
      let copied = 0n;
      if (size > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Tệp quá lớn để đọc trên Node.");
      if (size > 0n) {
        for await (const chunk of handle.createReadStream({
          autoClose: false,
          start: 0,
          end: Number(size) - 1,
          signal,
        })) {
          copied += BigInt(chunk.length);
          crc = updateCrc(crc, chunk);
          await write(chunk);
        }
      }
      if (copied !== size) throw new Error("Tệp đã thay đổi trong khi tạo ZIP.");
      crc = (crc ^ 0xffffffff) >>> 0;
      const descriptor = Buffer.alloc(zip64 ? 24 : 16);
      descriptor.writeUInt32LE(0x08074b50, 0);
      descriptor.writeUInt32LE(crc, 4);
      if (zip64) {
        descriptor.writeBigUInt64LE(size, 8);
        descriptor.writeBigUInt64LE(size, 16);
      } else {
        descriptor.writeUInt32LE(Number(size), 8);
        descriptor.writeUInt32LE(Number(size), 12);
      }
      await write(descriptor);
      directory.push({ name, start, size, zip64, crc, stamp });
    } finally {
      await handle.close();
    }
  }
  const centralStart = offset;
  for (const item of directory) {
    const central = Buffer.alloc(46);
    const extra = Buffer.alloc(item.zip64 ? 28 : 0);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(45, 4);
    central.writeUInt16LE(item.zip64 ? 45 : 20, 6);
    central.writeUInt16LE(0x0808, 8);
    central.writeUInt16LE(item.stamp.time, 12);
    central.writeUInt16LE(item.stamp.date, 14);
    central.writeUInt32LE(item.crc, 16);
    central.writeUInt32LE(item.zip64 ? 0xffffffff : Number(item.size), 20);
    central.writeUInt32LE(item.zip64 ? 0xffffffff : Number(item.size), 24);
    central.writeUInt16LE(item.name.length, 28);
    central.writeUInt16LE(extra.length, 30);
    central.writeUInt32LE(item.zip64 ? 0xffffffff : Number(item.start), 42);
    if (item.zip64) {
      extra.writeUInt16LE(1, 0);
      extra.writeUInt16LE(24, 2);
      extra.writeBigUInt64LE(item.size, 4);
      extra.writeBigUInt64LE(item.size, 12);
      extra.writeBigUInt64LE(item.start, 20);
    }
    await write(central);
    await write(item.name);
    if (extra.length) await write(extra);
  }
  const centralSize = offset - centralStart;
  const zip64 =
    directory.some((item) => item.zip64) ||
    centralStart >= threshold ||
    centralSize >= threshold ||
    directory.length >= 65535;
  if (zip64) {
    const zip64Start = offset;
    const end = Buffer.alloc(56);
    end.writeUInt32LE(0x06064b50, 0);
    end.writeBigUInt64LE(44n, 4);
    end.writeUInt16LE(45, 12);
    end.writeUInt16LE(45, 14);
    end.writeBigUInt64LE(BigInt(directory.length), 24);
    end.writeBigUInt64LE(BigInt(directory.length), 32);
    end.writeBigUInt64LE(centralSize, 40);
    end.writeBigUInt64LE(centralStart, 48);
    await write(end);
    const locator = Buffer.alloc(20);
    locator.writeUInt32LE(0x07064b50, 0);
    locator.writeBigUInt64LE(zip64Start, 8);
    locator.writeUInt32LE(1, 16);
    await write(locator);
  }
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(zip64 ? 65535 : directory.length, 8);
  end.writeUInt16LE(zip64 ? 65535 : directory.length, 10);
  end.writeUInt32LE(zip64 ? 0xffffffff : Number(centralSize), 12);
  end.writeUInt32LE(zip64 ? 0xffffffff : Number(centralStart), 16);
  await write(end);
}

module.exports = { writeZip, crc32 };
