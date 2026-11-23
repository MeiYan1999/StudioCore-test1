import { describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/errors";
import { parseDriveMarkup } from "@/lib/drive/markup";

describe("parseDriveMarkup", () => {
  it("clamps and rounds normalized points and retains notes for used colors", () => {
    expect(
      parseDriveMarkup({
        v: 1,
        strokes: [{ c: "#ef4444", w: 0.02, p: [[-0.2, 0.123456], [1.2, 0.5]] }],
        notes: { "#ef4444": "Sáng hơn" },
      }),
    ).toEqual({
      v: 1,
      strokes: [{ c: "#ef4444", w: 0.02, p: [[0, 0.1235], [1, 0.5]] }],
      notes: { "#ef4444": "Sáng hơn" },
    });
  });

  it("returns null for empty strokes and null input", () => {
    expect(parseDriveMarkup(null)).toBeNull();
    expect(parseDriveMarkup({ v: 1, strokes: [], notes: {} })).toBeNull();
  });

  it.each([
    { v: 2, strokes: [], notes: {} },
    { v: 1, strokes: [{ c: "#000000", w: 0.02, p: [[0, 0]] }], notes: {} },
    { v: 1, strokes: [{ c: "#ef4444", w: 0.001, p: [[0, 0]] }], notes: {} },
    { v: 1, strokes: [{ c: "#ef4444", w: 0.02, p: [] }], notes: {} },
    { v: 1, strokes: [{ c: "#ef4444", w: 0.02, p: [[0, 0]], extra: true }], notes: {} },
    { v: 1, strokes: [{ c: "#ef4444", w: 0.02, p: [[0, 0]] }], notes: { "#3b82f6": "Không dùng" } },
    { v: 1, strokes: [{ c: "#ef4444", w: 0.02, p: [[0, 0]] }], notes: { "#ef4444": "x".repeat(201) } },
    { v: 1, strokes: [{ c: "#ef4444", w: 0.02, p: [[NaN, 0]] }], notes: {} },
  ])("rejects invalid markup structures", (markup) => {
    expect(() => parseDriveMarkup(markup)).toThrow(ValidationError);
  });

  it("limits the stroke count, point count, and serialized size", () => {
    const stroke = { c: "#ef4444", w: 0.02, p: [[0, 0]] };
    expect(() => parseDriveMarkup({ v: 1, strokes: Array(201).fill(stroke), notes: {} })).toThrow(ValidationError);

    const tooManyPoints = { v: 1, strokes: [{ c: "#ef4444", w: 0.02, p: Array(6001).fill([0, 0]) }], notes: {} };
    expect(() => parseDriveMarkup(tooManyPoints)).toThrow(ValidationError);

    const tooLarge = {
      v: 1,
      strokes: Array.from({ length: 200 }, () => ({
        c: "#ef4444",
        w: 0.02,
        p: Array(30).fill([0.1234, 0.5678]),
      })),
      notes: {},
    };
    expect(() => parseDriveMarkup(tooLarge)).toThrow(ValidationError);
  });
});
