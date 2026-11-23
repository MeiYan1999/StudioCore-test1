"use client";

import { useRef, useState, type PointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DRIVE_MARKUP_PALETTE,
  type DriveMarkup,
  type DriveMarkupColor,
  type DriveMarkupStroke,
} from "@/lib/drive/markup";

type Props = {
  fileName: string;
  imageUrl: string;
  markup: DriveMarkup | null;
  editable: boolean;
  onSave: (markup: DriveMarkup) => Promise<boolean>;
};

function pointSegmentDistance(point: [number, number], start: [number, number], end: [number, number]): number {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  if (!dx && !dy) return Math.hypot(point[0] - start[0], point[1] - start[1]);
  const t = Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point[0] - (start[0] + t * dx), point[1] - (start[1] + t * dy));
}

function strokeHit(stroke: DriveMarkupStroke, point: [number, number], width: number, height: number): boolean {
  const scale = Math.max(width, height);
  const radius = 12 + (stroke.w * scale) / 2;
  const points = stroke.p.map(([x, y]) => [x * width, y * height] as [number, number]);
  if (points.length === 1) return Math.hypot(point[0] * width - points[0][0], point[1] * height - points[0][1]) <= radius;
  for (let index = 1; index < points.length; index += 1) {
    if (pointSegmentDistance([point[0] * width, point[1] * height], points[index - 1], points[index]) <= radius) {
      return true;
    }
  }
  return false;
}

export function DriveMarkupEditor({ fileName, imageUrl, markup, editable, onSave }: Props) {
  const [drawing, setDrawing] = useState(false);
  const [showMarkup, setShowMarkup] = useState(true);
  const [draft, setDraft] = useState<DriveMarkup>(markup ?? { v: 1, strokes: [], notes: {} });
  const [activeStroke, setActiveStroke] = useState<DriveMarkupStroke | null>(null);
  const activeStrokeRef = useRef<DriveMarkupStroke | null>(null);
  const pointerId = useRef<number | null>(null);
  const [undoStack, setUndoStack] = useState<DriveMarkupStroke[][]>([]);
  const [redoStack, setRedoStack] = useState<DriveMarkupStroke[][]>([]);
  const [color, setColor] = useState<DriveMarkupColor>(DRIVE_MARKUP_PALETTE[0].color);
  const [brushWidth, setBrushWidth] = useState(0.012);
  const [erasing, setErasing] = useState(false);
  const [busy, setBusy] = useState(false);

  const usedColors = [...new Set(draft.strokes.map((stroke) => stroke.c))];

  function commitStrokes(strokes: DriveMarkupStroke[]) {
    setUndoStack([...undoStack, draft.strokes]);
    setRedoStack([]);
    setDraft({ ...draft, strokes });
  }

  function normalizedPoint(event: PointerEvent<SVGSVGElement>): [number, number] {
    const rect = event.currentTarget.getBoundingClientRect();
    const round = (value: number) => Math.round(Math.max(0, Math.min(1, value)) * 10_000) / 10_000;
    return [round((event.clientX - rect.left) / rect.width), round((event.clientY - rect.top) / rect.height)];
  }

  function onPointerDown(event: PointerEvent<SVGSVGElement>) {
    if (!drawing || event.button !== 0) return;
    event.preventDefault();
    const nextPoint = normalizedPoint(event);
    if (erasing) {
      const rect = event.currentTarget.getBoundingClientRect();
      const strokes = draft.strokes.filter((stroke) => !strokeHit(stroke, nextPoint, rect.width, rect.height));
      if (strokes.length !== draft.strokes.length) commitStrokes(strokes);
      return;
    }
    if (draft.strokes.length >= 200) return;
    pointerId.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    const stroke = { c: color, w: brushWidth, p: [nextPoint] };
    activeStrokeRef.current = stroke;
    setActiveStroke(stroke);
  }

  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!drawing || pointerId.current !== event.pointerId) return;
    const nextPoint = normalizedPoint(event);
    const current = activeStrokeRef.current;
    if (!current || current.p.length >= 6000) return;
    const previous = current.p[current.p.length - 1];
    if (Math.hypot(nextPoint[0] - previous[0], nextPoint[1] - previous[1]) < 0.001) return;
    const stroke = { ...current, p: [...current.p, nextPoint] };
    activeStrokeRef.current = stroke;
    setActiveStroke(stroke);
  }

  function onPointerUp(event: PointerEvent<SVGSVGElement>) {
    if (pointerId.current !== event.pointerId) return;
    pointerId.current = null;
    const stroke = activeStrokeRef.current;
    activeStrokeRef.current = null;
    setActiveStroke(null);
    if (!stroke) return;
    setUndoStack([...undoStack, draft.strokes]);
    setRedoStack([]);
    setDraft({ ...draft, strokes: [...draft.strokes, stroke] });
  }

  function undo() {
    const previous = undoStack[undoStack.length - 1];
    if (!previous) return;
    setUndoStack(undoStack.slice(0, -1));
    setRedoStack([draft.strokes, ...redoStack]);
    setDraft({ ...draft, strokes: previous });
  }

  function redo() {
    const next = redoStack[0];
    if (!next) return;
    setRedoStack(redoStack.slice(1));
    setUndoStack([...undoStack, draft.strokes]);
    setDraft({ ...draft, strokes: next });
  }

  async function save() {
    setBusy(true);
    const notes = Object.fromEntries(
      usedColors.flatMap((usedColor) => {
        const text = draft.notes[usedColor]?.slice(0, 200) ?? "";
        return text ? [[usedColor, text]] : [];
      }),
    ) as DriveMarkup["notes"];
    try {
      if (await onSave({ v: 1, strokes: draft.strokes, notes })) setDrawing(false);
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    setDrawing(false);
    setDraft(markup ?? { v: 1, strokes: [], notes: {} });
    setActiveStroke(null);
    activeStrokeRef.current = null;
    pointerId.current = null;
  }

  const visibleStrokes = drawing ? [...draft.strokes, ...(activeStroke ? [activeStroke] : [])] : markup?.strokes ?? [];

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      {editable || markup ? (
        <div className="flex flex-wrap items-center justify-center gap-2 py-2">
          {editable && !drawing ? (
            <Button size="sm" onClick={() => setDrawing(true)}>Bút vẽ</Button>
          ) : null}
          {drawing ? (
            <>
              <div className="flex items-center gap-1" aria-label="Bảng màu">
                {DRIVE_MARKUP_PALETTE.map((entry) => (
                  <button
                    key={entry.color}
                    type="button"
                    aria-label={`Màu ${entry.name}`}
                    aria-pressed={color === entry.color}
                    onClick={() => {
                      setColor(entry.color);
                      setErasing(false);
                    }}
                    className="h-7 w-7 rounded-full border-2"
                    style={{
                      backgroundColor: entry.color,
                      borderColor: color === entry.color && !erasing ? "white" : "transparent",
                      boxShadow: color === entry.color && !erasing ? "0 0 0 2px #6d4aff" : undefined,
                    }}
                  />
                ))}
              </div>
              <label className="flex items-center gap-2 text-xs">
                Cỡ nét
                <input
                  type="range"
                  min="0.002"
                  max="0.08"
                  step="0.002"
                  value={brushWidth}
                  onChange={(event) => setBrushWidth(Number(event.target.value))}
                  aria-label="Cỡ nét"
                />
              </label>
              <Button size="sm" variant={erasing ? "primary" : "outline"} onClick={() => setErasing(!erasing)}>
                Tẩy
              </Button>
              <Button size="sm" variant="outline" disabled={undoStack.length === 0} onClick={undo}>
                Hoàn tác
              </Button>
              <Button size="sm" variant="outline" disabled={redoStack.length === 0} onClick={redo}>
                Làm lại
              </Button>
              <Button size="sm" disabled={busy} onClick={() => void save()}>
                {busy ? "Đang lưu…" : "Lưu"}
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={cancel}>
                Hủy
              </Button>
            </>
          ) : null}
          {!drawing && markup ? (
            <Button size="sm" variant="outline" onClick={() => setShowMarkup(!showMarkup)}>
              {showMarkup ? "Ẩn nét vẽ" : "Hiện nét vẽ"}
            </Button>
          ) : null}
        </div>
      ) : null}
      {drawing && usedColors.length > 0 ? (
        <div className="mx-auto grid w-full max-w-3xl gap-2 px-3 pb-2 sm:grid-cols-2">
          {usedColors.map((usedColor) => {
            const name = DRIVE_MARKUP_PALETTE.find((entry) => entry.color === usedColor)?.name ?? "";
            return (
              <Textarea
                key={usedColor}
                value={draft.notes[usedColor] ?? ""}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    notes: { ...draft.notes, [usedColor]: event.target.value.slice(0, 200) },
                  })
                }
                maxLength={200}
                rows={2}
                placeholder={`Ghi chú cho màu ${name}…`}
                aria-label={`Ghi chú cho màu ${name}`}
                className="min-h-12 border-white/20 bg-white/10 text-xs text-white placeholder:text-white/50"
              />
            );
          })}
        </div>
      ) : null}
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        <div className="relative inline-flex max-h-full max-w-full items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- ảnh được chuyển tiếp trực tiếp từ máy studio */}
          <img src={imageUrl} alt={fileName} className="block max-h-full max-w-full object-contain" />
          {visibleStrokes.length > 0 && (drawing || showMarkup) ? (
            <svg
              viewBox="0 0 1 1"
              preserveAspectRatio="none"
              className={`absolute inset-0 h-full w-full ${drawing ? "cursor-crosshair" : "pointer-events-none"}`}
              style={{
                touchAction: drawing ? "none" : undefined,
                pointerEvents: drawing ? "all" : "none",
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              {visibleStrokes.map((stroke, index) =>
                stroke.p.length === 1 ? (
                  <circle key={index} cx={stroke.p[0][0]} cy={stroke.p[0][1]} r={stroke.w / 2} fill={stroke.c} />
                ) : (
                  <polyline
                    key={index}
                    points={stroke.p.map(([x, y]) => `${x},${y}`).join(" ")}
                    fill="none"
                    stroke={stroke.c}
                    strokeWidth={stroke.w}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ),
              )}
            </svg>
          ) : null}
        </div>
      </div>
    </div>
  );
}
