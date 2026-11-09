"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Apple,
  Check,
  Copy,
  ExternalLink,
  Folder,
  HardDrive,
  Heart,
  Key,
  Monitor,
  PauseCircle,
  PlayCircle,
  Server,
  Sparkles,
  Terminal,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  listDriveShares,
  updateDriveShareStatus,
  deleteDriveShare,
  getDriveExportRawCodes,
  type DriveShare,
  type DriveShareStatus,
} from "@/lib/services/drive-service";

export default function ManageDrivePage() {
  const [shares, setShares] = useState<DriveShare[]>(listDriveShares());
  const [selectedShare, setSelectedShare] = useState<DriveShare | null>(null);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [copiedRaw, setCopiedRaw] = useState<boolean>(false);
  const [copiedCmd, setCopiedCmd] = useState<boolean>(false);

  useEffect(() => {
    fetch("/api/drive/agent")
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.shares)) {
          setShares(data.shares);
        }
      })
      .catch(() => {});
  }, []);

  const connectKey = "sc_drive_live_tenant_demo_984f7b2e1a";

  const handleToggleStatus = (shareId: string, currentStatus: DriveShareStatus) => {
    const newStatus: DriveShareStatus = currentStatus === "active" ? "paused" : "active";
    updateDriveShareStatus(shareId, newStatus);
    setShares([...listDriveShares()]);
  };

  const handleDeleteShare = (share: DriveShare) => {
    const ok = window.confirm(`Bạn có chắc chắn muốn xóa chia sẻ "${share.title}"?\nKhách sẽ không thể truy cập link này nữa.`);
    if (!ok) return;
    deleteDriveShare(share.id);
    setShares([...listDriveShares()]);
  };

  const handleCopyLink = (share: DriveShare) => {
    const url = `${window.location.origin}/drive/${share.id}`;
    navigator.clipboard?.writeText(url);
    setCopiedLink(share.id);
    setTimeout(() => setCopiedLink(null), 2500);
  };

  const handleCopyRawCodes = (share: DriveShare) => {
    const codes = getDriveExportRawCodes(share.id);
    navigator.clipboard?.writeText(codes);
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 2500);
  };

  const handleCopyCommand = (share: DriveShare) => {
    const codes = getDriveExportRawCodes(share.id);
    const cmd = `mkdir -p "Retouch_Final" && for f in ${codes.replace(/,/g, "")}; do cp "${share.localPath}/$f"* "Retouch_Final/"; done`;
    navigator.clipboard?.writeText(cmd);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2500);
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              StudioCore Drive
            </h1>
            <Badge tone="info">Zero-Cloud</Badge>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Quản lý chia sẻ trực tiếp từ máy tính &amp; ổ NAS studio. Khách duyệt ảnh hoặc góp ý video được
            đồng bộ thời gian thực về studio.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button asChild variant="outline" size="sm">
            <Link href="/studiocore-drive" target="_blank">
              <ExternalLink className="h-4 w-4 mr-1.5" />
              Xem Landing Page
            </Link>
          </Button>
          <Button size="sm" onClick={() => setSelectedShare(shares[0])}>
            <Sparkles className="h-4 w-4 mr-1.5" />
            Lọc mã RAW ảnh khách chốt
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Link đang hoạt động</span>
            <HardDrive className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-foreground">
            {shares.filter((s) => s.status === "active").length}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Tự động đồng bộ theo thư mục</p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Dung lượng đã tiết kiệm</span>
            <Server className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
            37.7 GB
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">0 ₫ chi phí lưu trữ Google Drive</p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Máy tính đang kết nối</span>
            <Monitor className="h-4 w-4 text-indigo-500" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-foreground">2 máy tính</p>
          <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            PC-PhongDung &amp; Mac Studio Live
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Ảnh khách vừa chốt</span>
            <Heart className="h-4 w-4 text-rose-500" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-rose-600 dark:text-rose-400">
            14 ảnh duyệt
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Sẵn sàng lọc file RAW ngay</p>
        </div>
      </div>

      {/* Shares List Table / Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">Thư mục &amp; Video đang chia sẻ</h2>
          <span className="text-xs text-muted-foreground">Cập nhật mỗi khi có thay đổi file</span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-xs">
          <div className="divide-y divide-border">
            {shares.map((share) => (
              <div
                key={share.id}
                className="flex flex-col gap-4 p-5 transition-colors hover:bg-surface-muted/40 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3.5">
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                      share.type === "video"
                        ? "bg-fuchsia-500/10 text-fuchsia-600"
                        : share.type === "album"
                        ? "bg-violet-500/10 text-violet-600"
                        : "bg-amber-500/10 text-amber-500"
                    }`}
                  >
                    {share.type === "video" ? (
                      <Video className="h-5 w-5" />
                    ) : share.type === "album" ? (
                      <Heart className="h-5 w-5" />
                    ) : (
                      <Folder className="h-5 w-5" />
                    )}
                  </span>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-foreground">{share.title}</p>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          share.status === "active"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            share.status === "active" ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                          }`}
                        />
                        {share.status === "active" ? "Đang chia sẻ" : "Tạm dừng"}
                      </span>
                    </div>

                    <p className="mt-1 font-mono text-[11px] text-muted-foreground truncate max-w-md">
                      {share.localPath}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                      <span>Máy chủ: <strong className="text-foreground">{share.agentHostname}</strong></span>
                      <span>Dung lượng: <strong className="text-foreground">{share.totalSizeLabel}</strong></span>
                      <span>Lượt xem: <strong className="text-foreground">{share.viewsCount}</strong></span>
                      {share.type === "album" && (
                        <span className="text-primary font-semibold">
                          Khách đã chọn: {share.selectedCount}/{share.maxSelectCount} ảnh
                        </span>
                      )}
                      {share.type === "video" && (
                        <span className="text-fuchsia-600 dark:text-fuchsia-400 font-semibold">
                          {share.comments?.length || 0} góp ý theo giây
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopyLink(share)}
                    className="text-xs"
                  >
                    {copiedLink === share.id ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-500 mr-1" />
                        Đã copy link
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 mr-1" />
                        Copy link khách
                      </>
                    )}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedShare(share)}
                    className="text-xs"
                  >
                    Chi tiết &amp; Lọc
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleToggleStatus(share.id, share.status)}
                    className={`text-xs ${
                      share.status === "active"
                        ? "text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-300 border-amber-500/20"
                        : "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-300 border-emerald-500/20"
                    }`}
                    title={share.status === "active" ? "Dừng chia sẻ tạm thời" : "Tiếp tục chia sẻ"}
                  >
                    {share.status === "active" ? (
                      <>
                        <PauseCircle className="h-3.5 w-3.5 mr-1" />
                        Dừng chia sẻ
                      </>
                    ) : (
                      <>
                        <PlayCircle className="h-3.5 w-3.5 mr-1" />
                        Tiếp tục chia sẻ
                      </>
                    )}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeleteShare(share)}
                    className="text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-300 border-rose-500/20"
                    title="Xóa chia sẻ này"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Xóa
                  </Button>

                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/drive/${share.id}`} target="_blank" title="Mở trang khách">
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Desktop Agent Connection Card */}
      <div className="rounded-3xl border border-primary/30 bg-gradient-to-br from-surface to-primary/[0.03] p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Key className="h-4 w-4" />
              </span>
              <h3 className="text-base font-bold text-foreground">
                Khóa kết nối máy tính (Studio Connect Key)
              </h3>
            </div>
            <p className="text-xs text-muted-foreground max-w-xl">
              Dán mã này vào ứng dụng StudioCore Drive trên Windows hoặc macOS để liên kết máy tính/NAS
              của studio với hệ thống SaaS. Cả studio dùng chung 1 khóa.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <code className="rounded-xl border border-border bg-background px-3 py-1.5 font-mono text-xs font-bold text-foreground">
                {connectKey}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard?.writeText(connectKey);
                  setCopiedKey(true);
                  setTimeout(() => setCopiedKey(false), 2000);
                }}
                className="text-xs"
              >
                {copiedKey ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-500 mr-1" />
                    Đã copy
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    Copy mã
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row shrink-0">
            <Button asChild size="sm" className="shadow-md">
              <a href="/downloads/StudioCore-Drive-Windows.zip" download="StudioCore-Drive-Windows.zip">
                <Monitor className="h-4 w-4 mr-1.5" />
                Tải StudioCore-Drive (Windows)
              </a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href="/downloads/StudioCore-Drive-macOS.zip" download="StudioCore-Drive-macOS.zip">
                <Apple className="h-4 w-4 mr-1.5" />
                Tải StudioCore-Drive (macOS)
              </a>
            </Button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          INSPECT / RAW FILTER MODAL
          ========================================================================= */}
      {selectedShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-border p-5">
              <div>
                <h3 className="text-base font-bold text-foreground">{selectedShare.title}</h3>
                <p className="text-xs text-muted-foreground">
                  {selectedShare.localPath} · {selectedShare.agentHostname}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedShare(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-muted text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-6 overflow-y-auto p-5 sm:p-6 text-xs">
              {/* Client Selection Codes */}
              {selectedShare.type === "album" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">
                      Danh sách mã ảnh khách chọn ({selectedShare.selectedCount} ảnh):
                    </span>
                    <Button
                      size="sm"
                      onClick={() => handleCopyRawCodes(selectedShare)}
                      className="text-xs"
                    >
                      {copiedRaw ? (
                        <>
                          <Check className="h-3 w-3 mr-1" /> Đã chép mã
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 mr-1" /> Chép mã cho Lightroom
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="rounded-xl border border-border bg-background p-3 font-mono text-foreground font-semibold">
                    {getDriveExportRawCodes(selectedShare.id) || "Chưa có ảnh nào được chọn"}
                  </div>

                  {/* Notes from Client */}
                  <div className="space-y-2 pt-2">
                    <span className="font-bold text-foreground">Ghi chú của khách hàng:</span>
                    <div className="space-y-1.5">
                      {selectedShare.items
                        .filter((i) => i.note)
                        .map((item) => (
                          <div
                            key={item.id}
                            className="rounded-lg border border-border/70 bg-surface-muted/50 p-2.5 text-[11px]"
                          >
                            <span className="font-mono font-bold text-primary">{item.filename}:</span>{" "}
                            <span className="text-foreground">{item.note}</span>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Auto-copy Terminal Command */}
                  <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-primary flex items-center gap-1.5">
                        <Terminal className="h-3.5 w-3.5" />
                        Lệnh tự động gom file RAW gốc:
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyCommand(selectedShare)}
                        className="text-[11px] font-semibold text-primary underline"
                      >
                        {copiedCmd ? "Đã chép lệnh!" : "Chép lệnh terminal"}
                      </button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Mở Terminal hoặc Command Prompt tại thư mục show, chạy lệnh này để tự copy các file
                      được chọn vào thư mục <code>Retouch_Final</code>.
                    </p>
                  </div>
                </div>
              )}

              {/* Video Comments Review */}
              {selectedShare.type === "video" && selectedShare.comments && (
                <div className="space-y-3">
                  <span className="font-bold text-foreground">
                    Danh sách góp ý của khách ({selectedShare.comments.length}):
                  </span>
                  <div className="space-y-2">
                    {selectedShare.comments.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-xl border border-border bg-background p-3 text-xs"
                      >
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span className="font-bold text-foreground">{c.author}</span>
                          <span className="font-mono font-semibold text-primary rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px]">
                            {c.timeLabel}
                          </span>
                        </div>
                        <p className="mt-1 text-foreground/90">{c.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Folder Details */}
              {selectedShare.type === "folder" && (
                <div className="space-y-2">
                  <span className="font-bold text-foreground">Danh sách file trong thư mục:</span>
                  <div className="divide-y divide-border rounded-xl border border-border bg-background">
                    {selectedShare.items.map((file) => (
                      <div key={file.id} className="flex justify-between p-2.5">
                        <span className="font-medium text-foreground">{file.name}</span>
                        <span className="text-muted-foreground font-mono">{file.sizeLabel}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-border p-4 bg-surface-muted/40 flex justify-end">
              <Button size="sm" onClick={() => setSelectedShare(null)}>
                Đóng
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
