"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Apple,
  Check,
  Copy,
  Download,
  ExternalLink,
  KeyRound,
  Laptop,
  Link2,
  ListChecks,
  Lock,
  MonitorSmartphone,
  Pause,
  Play,
  RotateCcw,
  Trash2,
  Unplug,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  createDrivePairingCodeAction,
  deleteDriveShareAction,
  getDrivePicksAction,
  revokeDriveDeviceAction,
  updateDriveShareAction,
} from "@/lib/actions/drive-actions";
import { DRIVE_RELEASES_URL, formatDriveBytes } from "@/lib/drive/constants";
import type { DriveDeviceView, DrivePick, DriveShareSummary } from "@/lib/services/drive-service";

type Props = {
  devices: DriveDeviceView[];
  shares: DriveShareSummary[];
  canManage: boolean;
  siteUrl: string;
};

const dateFormat = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Ho_Chi_Minh",
});

async function copyText(text: string, message: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(message);
  } catch {
    toast.error("Trình duyệt không cho phép sao chép. Hãy chọn và sao chép thủ công.");
  }
}

export function DriveManager({ devices, shares, canManage, siteUrl }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pairing, setPairing] = useState<{ code: string; expiresAt: number } | null>(null);
  const [picksFor, setPicksFor] = useState<DriveShareSummary | null>(null);
  const [picks, setPicks] = useState<{ picks: DrivePick[]; codes: string[] } | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "submitted" | "paused">("all");

  // Trạng thái trực tuyến và lượt chọn thay đổi theo thời gian thực phía máy studio/khách.
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 20_000);
    return () => clearInterval(timer);
  }, [router]);

  const visible = useMemo(
    () =>
      shares.filter((s) =>
        filter === "all"
          ? true
          : filter === "submitted"
            ? !!s.submittedAt
            : filter === "paused"
              ? s.status === "paused" || s.expired
              : s.status === "active" && !s.expired,
      ),
    [shares, filter],
  );

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(success);
        router.refresh();
      } else {
        toast.error(result.error ?? "Không thể thực hiện thao tác.");
      }
    });
  }

  function createCode() {
    startTransition(async () => {
      const result = await createDrivePairingCodeAction();
      if (result.ok) setPairing({ code: result.code, expiresAt: result.expiresAt });
      else toast.error(result.error);
    });
  }

  function openPicks(share: DriveShareSummary) {
    setPicksFor(share);
    setPicks(null);
    startTransition(async () => {
      const result = await getDrivePicksAction(share.id);
      if (result.ok) setPicks({ picks: result.picks, codes: result.codes });
      else toast.error(result.error);
    });
  }

  const onlineCount = devices.filter((d) => d.online).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MonitorSmartphone className="h-5 w-5 text-primary" aria-hidden />
              Máy tính đã kết nối
              <Badge tone={onlineCount > 0 ? "success" : "neutral"}>
                {onlineCount}/{devices.length} trực tuyến
              </Badge>
            </CardTitle>
            <CardDescription>
              Ảnh nằm trên các máy này. Link chỉ mở được khi máy đang bật và ứng dụng StudioCore Drive đang chạy.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {devices.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                Chưa có máy nào. Cài ứng dụng, bấm “Tạo mã kết nối” rồi dán mã vào ứng dụng.
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {devices.map((device) => (
                  <li key={device.id} className="flex flex-wrap items-center gap-3 p-3">
                    {device.platform === "darwin" ? (
                      <Apple className="h-5 w-5 text-muted-foreground" aria-hidden />
                    ) : (
                      <Laptop className="h-5 w-5 text-muted-foreground" aria-hidden />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{device.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {device.shareCount} link
                        {device.appVersion ? ` · v${device.appVersion}` : ""}
                        {device.lastSeenAt ? ` · hoạt động ${dateFormat.format(device.lastSeenAt)}` : ""}
                      </p>
                    </div>
                    <Badge tone={device.online ? "success" : "neutral"}>
                      {device.online ? "Trực tuyến" : "Ngoại tuyến"}
                    </Badge>
                    {canManage ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => {
                          if (window.confirm(`Gỡ kết nối máy “${device.name}”? Các link của máy này sẽ tạm dừng.`)) {
                            run(() => revokeDriveDeviceAction(device.id), "Đã gỡ kết nối máy.");
                          }
                        }}
                      >
                        <Unplug className="h-4 w-4" aria-hidden />
                        Gỡ
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {canManage ? (
              <Button onClick={createCode} disabled={pending}>
                <KeyRound className="h-4 w-4" aria-hidden />
                Tạo mã kết nối
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" aria-hidden />
              Tải ứng dụng
            </CardTitle>
            <CardDescription>Windows 10/11 và macOS 12 trở lên.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Button asChild variant="outline" className="w-full">
              <a href={DRIVE_RELEASES_URL} target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4" aria-hidden />
                Tải bộ cài StudioCore Drive
              </a>
            </Button>
            <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>Cài và mở ứng dụng trên máy chứa ảnh.</li>
              <li>Bấm “Tạo mã kết nối”, dán mã vào ứng dụng.</li>
              <li>Chuột phải thư mục ảnh → “Chia sẻ bằng StudioCore Drive”.</li>
            </ol>
            <p className="text-xs text-muted-foreground">
              Mac/Windows chặn app khi mở lần đầu?{" "}
              <Link className="font-medium text-primary hover:underline" href="/studiocore-drive#mo-app-lan-dau">
                Xem cách cho phép
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" aria-hidden />
            Link đã chia sẻ
            <Badge>{shares.length}</Badge>
          </CardTitle>
          <div className="flex flex-wrap gap-2 pt-2">
            {(
              [
                ["all", "Tất cả"],
                ["active", "Đang mở"],
                ["submitted", "Khách đã chọn xong"],
                ["paused", "Tạm dừng / hết hạn"],
              ] as const
            ).map(([key, label]) => (
              <Button
                key={key}
                size="sm"
                variant={filter === key ? "primary" : "outline"}
                onClick={() => setFilter(key)}
              >
                {label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {visible.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {shares.length === 0
                ? "Chưa có link nào. Tạo link từ ứng dụng StudioCore Drive trên máy tính."
                : "Không có link nào khớp bộ lọc."}
            </p>
          ) : (
            <ul className="space-y-3">
              {visible.map((share) => {
                const url = `${siteUrl}/drive/${share.slug}`;
                return (
                  <li key={share.id} className="rounded-xl border border-border p-4">
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-medium">{share.title}</p>
                          <Badge tone="info">{share.kind === "select" ? "Chọn ảnh" : "Giao file"}</Badge>
                          {share.expired ? (
                            <Badge tone="danger">Hết hạn</Badge>
                          ) : share.status === "paused" ? (
                            <Badge tone="warning">Tạm dừng</Badge>
                          ) : (
                            <Badge tone="success">Đang mở</Badge>
                          )}
                          {share.hasPin ? (
                            <Badge>
                              <Lock className="mr-1 h-3 w-3" aria-hidden />
                              PIN
                            </Badge>
                          ) : null}
                          {share.submittedAt ? (
                            <Badge tone="success">
                              <Check className="mr-1 h-3 w-3" aria-hidden />
                              Khách đã gửi
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {share.clientName ? `${share.clientName} · ` : ""}
                          {share.fileCount} tệp · {formatDriveBytes(share.totalBytes)} · {share.viewCount} lượt xem ·{" "}
                          {share.deviceName}
                          {share.expiresAt ? ` · hết hạn ${dateFormat.format(share.expiresAt)}` : ""}
                        </p>
                        {share.kind === "select" ? (
                          <p className="mt-1 text-xs">
                            Đã chọn <strong>{share.pickedCount}</strong>
                            {share.maxSelect > 0 ? ` / ${share.maxSelect}` : ""} ảnh
                            {share.submittedAt ? ` · gửi lúc ${dateFormat.format(share.submittedAt)}` : ""}
                          </p>
                        ) : null}
                        {share.submissionNote ? (
                          <p className="mt-1 whitespace-pre-wrap rounded-md bg-surface-muted p-2 text-xs">
                            {share.submissionNote}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => copyText(url, "Đã sao chép link.")}>
                          <Copy className="h-4 w-4" aria-hidden />
                          Sao chép link
                        </Button>
                        <Button size="sm" variant="ghost" asChild>
                          <a href={url} target="_blank" rel="noopener noreferrer" aria-label="Mở link">
                            <ExternalLink className="h-4 w-4" aria-hidden />
                          </a>
                        </Button>
                        {share.kind === "select" ? (
                          <Button size="sm" variant="outline" onClick={() => openPicks(share)}>
                            <ListChecks className="h-4 w-4" aria-hidden />
                            Ảnh đã chọn
                          </Button>
                        ) : null}
                        {canManage ? (
                          <>
                            {share.submittedAt ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={pending}
                                onClick={() =>
                                  run(
                                    () => updateDriveShareAction(share.id, { reopen: true }),
                                    "Đã mở lại để khách chọn tiếp.",
                                  )
                                }
                              >
                                <RotateCcw className="h-4 w-4" aria-hidden />
                                Cho chọn lại
                              </Button>
                            ) : null}
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={pending}
                              onClick={() =>
                                run(
                                  () =>
                                    updateDriveShareAction(share.id, {
                                      status: share.status === "active" ? "paused" : "active",
                                    }),
                                  share.status === "active" ? "Đã tạm dừng link." : "Đã mở lại link.",
                                )
                              }
                            >
                              {share.status === "active" ? (
                                <Pause className="h-4 w-4" aria-hidden />
                              ) : (
                                <Play className="h-4 w-4" aria-hidden />
                              )}
                              {share.status === "active" ? "Tạm dừng" : "Mở lại"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={pending}
                              aria-label="Xóa link"
                              onClick={() => {
                                if (window.confirm(`Xóa link “${share.title}”? Ảnh trên máy tính không bị ảnh hưởng.`)) {
                                  run(() => deleteDriveShareAction(share.id), "Đã xóa link.");
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-[var(--danger)]" aria-hidden />
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!pairing} onOpenChange={(open) => !open && setPairing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mã kết nối máy tính</DialogTitle>
            <DialogDescription>
              Dán mã này vào ứng dụng StudioCore Drive. Mã dùng một lần và hết hạn sau 15 phút.
            </DialogDescription>
          </DialogHeader>
          {pairing ? (
            <div className="space-y-3">
              <Input readOnly value={pairing.code} className="font-mono" onFocus={(e) => e.currentTarget.select()} />
              <Button onClick={() => copyText(pairing.code, "Đã sao chép mã kết nối.")}>
                <Copy className="h-4 w-4" aria-hidden />
                Sao chép mã
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!picksFor} onOpenChange={(open) => !open && setPicksFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ảnh khách đã chọn</DialogTitle>
            <DialogDescription>{picksFor?.title}</DialogDescription>
          </DialogHeader>
          {!picks ? (
            <p className="text-sm text-muted-foreground">Đang tải…</p>
          ) : picks.picks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Khách chưa chọn ảnh nào.</p>
          ) : (
            <div className="space-y-3">
              <ul className="max-h-64 space-y-1 overflow-auto rounded-lg border border-border p-2 text-sm">
                {picks.picks.map((pick) => (
                  <li key={pick.key}>
                    <span className="font-mono">{pick.name}</span>
                    {pick.note ? <span className="text-muted-foreground"> — {pick.note}</span> : null}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => copyText(picks.codes.join(", "), "Đã sao chép mã ảnh (dán vào bộ lọc Lightroom).")}>
                  <Copy className="h-4 w-4" aria-hidden />
                  Sao chép mã cho Lightroom
                </Button>
                <Button
                  variant="outline"
                  onClick={() => copyText(picks.picks.map((p) => p.name).join("\n"), "Đã sao chép danh sách tên tệp.")}
                >
                  Sao chép tên tệp
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Trên máy tính, ứng dụng StudioCore Drive có thể tự chép ảnh đã chọn (kèm RAW cùng tên) ra thư mục riêng.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
