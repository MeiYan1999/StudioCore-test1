"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BrainCircuit, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { runAlbumAiScanAction } from "@/lib/actions/ai-actions";
import type { AiJobView } from "@/lib/services/ai-service";
import { DateTimeText } from "@/components/shared/date-time";
import { formatVnd } from "@/lib/utils";

const ISSUE_LABELS: Record<string, string> = {
  blur: "Có thể mờ",
  under_exposed: "Thiếu sáng",
  over_exposed: "Quá sáng",
};

export function AlbumAiPanel({
  albumId,
  canRun,
  latest,
}: {
  albumId: string;
  canRun: boolean;
  latest: AiJobView | null;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    const result = await runAlbumAiScanAction({ albumId });
    setRunning(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      `Đã phân tích ${result.scanned} ảnh, ${result.issueCount} ảnh có cảnh báo.`,
    );
    router.refresh();
  };

  const result = latest?.result;

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <BrainCircuit className="h-4 w-4 text-primary" aria-hidden />
            AI Hub
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Local heuristic trên server: blur, sáng/tối, gần trùng, gợi ý burst.
            Chỉ gợi ý, không tự đổi lựa chọn hay copy ảnh.
          </p>
        </div>
        {canRun ? (
          <Button variant="outline" size="sm" onClick={() => void run()} disabled={running}>
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden />
            )}
            Chạy phân tích
          </Button>
        ) : null}
      </div>

      {!latest ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Chưa có job AI cho album này. Chạy phân tích để xem gợi ý; kết quả được
          ghi log và không ảnh hưởng dữ liệu khách chọn.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge
              tone={
                latest.status === "completed"
                  ? "success"
                  : latest.status === "failed"
                    ? "danger"
                    : "warning"
              }
            >
              {latest.status}
            </Badge>
            <Badge tone={latest.provider === "local" ? "info" : "warning"}>
              {latest.provider === "local" ? "heuristic local" : latest.provider}
            </Badge>
            <span>
              Job {latest.id.slice(0, 8)} · <DateTimeText value={latest.createdAt} />
            </span>
            {latest.estimatedCost > 0 ? (
              <span>Chi phí ước tính {formatVnd(latest.estimatedCost)}</span>
            ) : null}
          </div>

          {latest.error ? (
            <Alert tone="danger">{latest.error}</Alert>
          ) : null}

          {result ? (
            <>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="rounded-lg bg-surface-muted px-2 py-1.5">
                  <p className="text-[11px] text-muted-foreground">Đã quét</p>
                  <p className="font-semibold">{result.scanned}</p>
                </div>
                <div className="rounded-lg bg-surface-muted px-2 py-1.5">
                  <p className="text-[11px] text-muted-foreground">Cảnh báo</p>
                  <p className="font-semibold">{result.insights.length}</p>
                </div>
                <div className="rounded-lg bg-surface-muted px-2 py-1.5">
                  <p className="text-[11px] text-muted-foreground">Nhóm trùng</p>
                  <p className="font-semibold">{result.duplicateGroups.length}</p>
                </div>
              </div>

              {result.insights.length > 0 ? (
                <div>
                  <p className="text-sm font-medium text-foreground">Ảnh cần xem lại</p>
                  <ul className="mt-1 max-h-44 space-y-1 overflow-auto text-xs">
                    {result.insights.map((insight) => (
                      <li
                        key={insight.code}
                        className="flex flex-wrap items-center justify-between gap-2 rounded border border-border px-2 py-1.5"
                      >
                        <span className="font-mono font-semibold">{insight.code}</span>
                        <span className="text-muted-foreground">
                          {insight.issues.map((issue) => ISSUE_LABELS[issue] ?? issue).join(", ")}
                          {" · "}nét {insight.sharpness} · sáng {insight.brightness}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Không phát hiện bất thường theo heuristic hiện tại.
                </p>
              )}

              {result.duplicateGroups.length > 0 ? (
                <div>
                  <p className="text-sm font-medium text-foreground">Ảnh gần trùng</p>
                  <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                    {result.duplicateGroups.map((group, index) => (
                      <li key={`dup-${index}`}>
                        Nhóm {index + 1}: {group.codes.join(", ")} — kiểm tra thủ công.
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {result.burstGroups.length > 0 ? (
                <div>
                  <p className="text-sm font-medium text-foreground">Gợi ý burst</p>
                  <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                    {result.burstGroups.map((group, index) => (
                      <li key={`burst-${index}`}>
                        Nhóm {index + 1}: giữ <strong>{group.keep}</strong> trong{" "}
                        {group.codes.join(", ")}.
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {result.errors.length > 0 ? (
                <p className="text-xs text-[var(--danger)]">
                  {result.errors.length} ảnh không đọc được:{" "}
                  {result.errors
                    .slice(0, 3)
                    .map((item) => `${item.code} (${item.message})`)
                    .join("; ")}
                </p>
              ) : null}

              <p className="text-xs text-muted-foreground">
                Phát hiện nhắm mắt: <strong>chưa hỗ trợ</strong> (chưa có model phù
                hợp; không đọc EXIF để giả vờ phát hiện). Kết quả AI không tự
                động lọc ảnh hoặc thay đổi selection.
              </p>
            </>
          ) : null}
        </div>
      )}
    </section>
  );
}
