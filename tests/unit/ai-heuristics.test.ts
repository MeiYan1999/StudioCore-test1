import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { measureLocalImage } from "@/lib/services/ai-service";

async function solidBuffer(color: string): Promise<Buffer> {
  return sharp({
    create: {
      width: 256,
      height: 256,
      channels: 3,
      background: color,
    },
  })
    .jpeg()
    .toBuffer();
}

async function checkerBuffer(): Promise<Buffer> {
  const squares: string[] = [];
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      squares.push(
        `<rect x="${x * 32}" y="${y * 32}" width="32" height="32" fill="${(x + y) % 2 === 0 ? "#000000" : "#ffffff"}"/>`,
      );
    }
  }
  return sharp(
    Buffer.from(
      `<svg width="256" height="256" xmlns="http://www.w3.org/2000/svg">${squares.join("")}</svg>`,
    ),
  )
    .jpeg({ quality: 95 })
    .toBuffer();
}

describe("AI heuristic local", () => {
  it("đo sáng/tối và sharpness; ảnh checker sắc nét hơn ảnh đồng màu", async () => {
    const dark = await measureLocalImage(await solidBuffer("#101010"));
    const bright = await measureLocalImage(await solidBuffer("#f4f4f4"));
    const checker = await measureLocalImage(await checkerBuffer());

    expect(dark.brightness).toBeLessThan(40);
    expect(bright.brightness).toBeGreaterThan(225);
    expect(dark.sharpness).toBeLessThan(5);
    expect(checker.sharpness).toBeGreaterThan(dark.sharpness + 100);
    expect(checker.hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("hash gần giống cho ảnh gần trùng và khác cho ảnh đảo màu", async () => {
    const origin = await sharp({
      create: { width: 256, height: 256, channels: 3, background: "#8a8a8a" },
    })
      .composite([
        {
          input: Buffer.from(
            '<svg width="256" height="256" xmlns="http://www.w3.org/2000/svg"><rect x="32" y="32" width="80" height="80" fill="#222"/></svg>',
          ),
        },
      ])
      .jpeg()
      .toBuffer();
    const near = await sharp(origin).modulate({ brightness: 1.02 }).jpeg().toBuffer();
    const inverted = await sharp(origin).negate().jpeg().toBuffer();

    const a = await measureLocalImage(origin);
    const b = await measureLocalImage(near);
    const c = await measureLocalImage(inverted);

    const distance = (x: string, y: string): number => {
      let value = BigInt(`0x${x}`) ^ BigInt(`0x${y}`);
      let count = 0;
      while (value > 0n) {
        count += Number(value & 1n);
        value >>= 1n;
      }
      return count;
    };
    expect(distance(a.hash, b.hash)).toBeLessThanOrEqual(4);
    expect(distance(a.hash, c.hash)).toBeGreaterThan(4);
  });
});
