import { ValidationError } from "@/lib/errors";

export const DRIVE_MARKUP_PALETTE = [
  { name: "đỏ", color: "#ef4444" },
  { name: "cam", color: "#f97316" },
  { name: "vàng", color: "#eab308" },
  { name: "xanh lá", color: "#22c55e" },
  { name: "xanh dương", color: "#3b82f6" },
  { name: "tím", color: "#a855f7" },
] as const;

export type DriveMarkupColor = (typeof DRIVE_MARKUP_PALETTE)[number]["color"];

export type DriveMarkupStroke = {
  c: DriveMarkupColor;
  w: number;
  p: [number, number][];
};

export type DriveMarkup = {
  v: 1;
  strokes: DriveMarkupStroke[];
  notes: Partial<Record<DriveMarkupColor, string>>;
};

const PALETTE_COLORS = new Set<string>(DRIVE_MARKUP_PALETTE.map(({ color }) => color));
const MAX_SERIALIZED_BYTES = 64 * 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function serializedBytes(value: string): number {
  return new TextEncoder().encode(value).length;
}

function invalid(): never {
  throw new ValidationError("Nét vẽ không hợp lệ.");
}

function roundedCoordinate(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return invalid();
  const rounded = Math.round(Math.min(1, Math.max(0, value)) * 10_000) / 10_000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function parseDriveMarkup(input: unknown): DriveMarkup | null {
  if (input === null || input === undefined) return null;

  let raw: unknown;
  let serialized: string;
  if (typeof input === "string") {
    serialized = input;
    if (serializedBytes(serialized) > MAX_SERIALIZED_BYTES) return invalid();
    try {
      raw = JSON.parse(input);
    } catch {
      return invalid();
    }
  } else {
    raw = input;
    try {
      serialized = JSON.stringify(input);
    } catch {
      return invalid();
    }
    if (typeof serialized !== "string" || serializedBytes(serialized) > MAX_SERIALIZED_BYTES) return invalid();
  }

  if (
    !isRecord(raw) ||
    !hasOnlyKeys(raw, ["v", "strokes", "notes"]) ||
    raw.v !== 1 ||
    !Array.isArray(raw.strokes) ||
    raw.strokes.length > 200 ||
    !isRecord(raw.notes)
  ) {
    return invalid();
  }

  const strokes: DriveMarkupStroke[] = [];
  const usedColors = new Set<DriveMarkupColor>();
  let pointCount = 0;

  for (const rawStroke of raw.strokes) {
    if (!isRecord(rawStroke) || !hasOnlyKeys(rawStroke, ["c", "w", "p"])) return invalid();
    if (typeof rawStroke.c !== "string" || !PALETTE_COLORS.has(rawStroke.c)) return invalid();
    if (typeof rawStroke.w !== "number" || !Number.isFinite(rawStroke.w) || rawStroke.w < 0.002 || rawStroke.w > 0.08) {
      return invalid();
    }
    if (!Array.isArray(rawStroke.p) || rawStroke.p.length === 0) return invalid();

    pointCount += rawStroke.p.length;
    if (pointCount > 6000) return invalid();

    const points = rawStroke.p.map((point): [number, number] => {
      if (!Array.isArray(point) || point.length !== 2) return invalid();
      return [roundedCoordinate(point[0]), roundedCoordinate(point[1])];
    });
    const color = rawStroke.c as DriveMarkupColor;
    usedColors.add(color);
    strokes.push({ c: color, w: rawStroke.w, p: points });
  }

  const notes: Partial<Record<DriveMarkupColor, string>> = {};
  for (const [color, text] of Object.entries(raw.notes)) {
    if (!PALETTE_COLORS.has(color) || !usedColors.has(color as DriveMarkupColor)) return invalid();
    if (typeof text !== "string" || text.length > 200) return invalid();
    if (text) notes[color as DriveMarkupColor] = text;
  }

  if (strokes.length === 0) return null;

  const result: DriveMarkup = { v: 1, strokes, notes };
  if (serializedBytes(JSON.stringify(result)) > MAX_SERIALIZED_BYTES) return invalid();
  return result;
}
