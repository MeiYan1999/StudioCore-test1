"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import {
  Calendar,
  Check,
  Copy,
  ExternalLink,
  Laptop,
  RefreshCw,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { ActorBranch } from "@/lib/auth/types";
import {
  connectGoogleCalendarAction,
  disconnectGoogleCalendarAction,
} from "@/lib/actions/google-calendar-actions";
import { regenerateCalendarFeedTokenAction } from "@/lib/actions/scheduling-actions";

const RESULT_MESSAGES = {
  connected: "Đã kết nối Google Calendar.",
  disconnected: "Đã ngắt kết nối Google Calendar.",
  invalid: "Thông tin kết nối không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.",
  unconfigured: "StudioCore chưa được cấu hình kết nối Google Calendar.",
  host: "Hãy mở Lịch chụp trên tên miền chính của StudioCore để kết nối Google Calendar.",
  error: "Không thể kết nối. Kiểm tra mã lịch, tài khoản có sở hữu lịch và đã cấp quyền đọc sự kiện.",
} as const;

function ConnectionSubmit({ connected }: { connected: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Đang chuyển đến Google…" : connected ? "Kết nối lại với Google" : "Kết nối với Google"}
    </Button>
  );
}

export function GoogleCalendarSyncDialog({
  feedToken: initialFeedToken,
  siteUrl,
  inbound,
}: {
  feedToken: string;
  siteUrl: string;
  inbound: {
    configured: boolean;
    connection: { branchId: string; calendarId: string } | null;
    branches: ActorBranch[];
    defaultBranchId: string;
    result?: string;
  } | null;
}) {
  const [token, setToken] = useState(initialFeedToken);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const result = inbound?.result;
  const resultMessage = result && Object.hasOwn(RESULT_MESSAGES, result)
    ? RESULT_MESSAGES[result as keyof typeof RESULT_MESSAGES] : null;

  // Normalize site URL
  const cleanSiteUrl = siteUrl.replace(/\/$/, "");
  const icsPath = `/api/calendar/feed/${token}/schedule.ics`;
  const httpsUrl = `${cleanSiteUrl}${icsPath}`;
  const webcalUrl = httpsUrl.replace(/^https?:\/\//, "webcal://");
  const googleCalendarSubscribeUrl = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(webcalUrl);
      setCopied(true);
      toast.success("Đã sao chép link đăng ký lịch iCal/WebCal!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Không thể sao chép, vui lòng copy thủ công.");
    }
  };

  const handleRegenerate = async () => {
    if (
      !confirm(
        "Bạn có chắc muốn đổi mã đồng bộ? Link cũ đã kết nối trước đây trên Google Calendar của bạn sẽ ngừng hoạt động và bạn cần đăng ký lại link mới.",
      )
    ) {
      return;
    }

    setRegenerating(true);
    const result = await regenerateCalendarFeedTokenAction();
    setRegenerating(false);

    if (result.ok && result.feedToken) {
      setToken(result.feedToken);
      toast.success("Đã làm mới mã đồng bộ thành công!");
    } else {
      toast.error(result.error || "Không thể làm mới mã, vui lòng thử lại.");
    }
  };

  return (
    <Dialog defaultOpen={!!resultMessage}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Calendar className="h-4 w-4 text-primary" aria-hidden="true" />
          <span>Đồng bộ Google Calendar</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Đồng bộ với Google Calendar</DialogTitle>
              <DialogDescription className="mt-0.5">
                Hiển thị sự kiện từ Google trong Lịch chụp hoặc đăng ký xem lịch StudioCore trên Google.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {inbound ? (
            <div className="space-y-3 rounded-xl border border-border p-4">
              <div>
                <h4 className="font-semibold text-foreground">Google Calendar → Lịch chụp</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  Sự kiện tự cập nhật khoảng 15 giây một lần khi đang xem Lịch chụp.
                  Chỉ hiển thị để tham khảo, không tạo hợp đồng hoặc đặt chỗ.
                </p>
              </div>
              {resultMessage ? <p role="status" className="text-sm">{resultMessage}</p> : null}
              {inbound.connection ? (
                <p className="text-xs text-muted-foreground">
                  Đã kết nối cho chi nhánh {inbound.branches.find(({ id }) => id === inbound.connection?.branchId)?.name ?? "đã chọn"}.
                </p>
              ) : null}
              {!inbound.configured ? (
                <p className="text-sm text-muted-foreground">
                  StudioCore chưa được cấu hình để kết nối Google Calendar.
                </p>
              ) : inbound.branches.length === 0 ? (
                <p className="text-sm text-muted-foreground">Cần có ít nhất một chi nhánh để kết nối.</p>
              ) : (
                <form action={connectGoogleCalendarAction} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="google-calendar-id">Mã lịch Google (Calendar ID)</Label>
                    <Input
                      id="google-calendar-id"
                      name="calendarId"
                      required
                      maxLength={320}
                      defaultValue={inbound.connection?.calendarId ?? ""}
                      placeholder="…@group.calendar.google.com"
                      aria-describedby="google-calendar-id-help"
                    />
                    <p id="google-calendar-id-help" className="text-xs text-muted-foreground">
                      Nên dùng lịch riêng cho studio, do tài khoản Google kết nối sở hữu.
                      Lấy mã ở Google Calendar → Cài đặt lịch → Tích hợp lịch.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="google-calendar-branch">Chi nhánh được xem</Label>
                    <Select
                      id="google-calendar-branch"
                      name="branchId"
                      defaultValue={inbound.connection?.branchId ?? inbound.defaultBranchId}
                      required
                    >
                      {inbound.branches.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Nhân viên có quyền xem lịch tại chi nhánh này sẽ thấy tên và thời gian sự kiện.
                    </p>
                  </div>
                  <ConnectionSubmit connected={!!inbound.connection} />
                </form>
              )}
              {inbound.connection ? (
                <form action={disconnectGoogleCalendarAction}>
                  <Button type="submit" size="sm" variant="outline">Ngắt kết nối</Button>
                </form>
              ) : null}
            </div>
          ) : null}
          <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4 transition-colors hover:border-primary/40">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="mt-1.5 font-semibold text-foreground">
                  Lịch chụp → Google Calendar
                </h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  Đăng ký lịch StudioCore chỉ đọc. Google tự quyết định thời điểm cập nhật lịch đăng ký.
                </p>
              </div>
            </div>

            <div className="mt-3.5">
              <Button asChild className="w-full sm:w-auto gap-2" size="sm">
                <a
                  href={googleCalendarSubscribeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4" />
                  Mở và thêm vào Google Calendar ngay
                </a>
              </Button>
            </div>
          </div>

          {/* WebCal Subscription Link */}
          <div className="rounded-xl border border-border bg-surface-muted/40 p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Hoặc sao chép link đăng ký (WebCal / iCal)
            </h4>
            <div className="mt-2 flex gap-2">
              <Input
                readOnly
                value={webcalUrl}
                className="font-mono text-xs select-all bg-surface"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleCopy()}
                className="shrink-0 gap-1.5"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-600" />
                    Đã chép
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Sao chép
                  </>
                )}
              </Button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-1">
              <div className="flex items-center gap-1.5">
                <Laptop className="h-3.5 w-3.5 text-foreground/70" />
                <span>Google Calendar & Outlook</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Smartphone className="h-3.5 w-3.5 text-foreground/70" />
                <span>Apple Calendar (iPhone/Mac)</span>
              </div>
            </div>
          </div>

          {/* Download ICS file */}
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <a
              href={httpsUrl}
              download="studiocore-schedule.ics"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              📥 Tải file .ics để import thủ công
            </a>

            <button
              type="button"
              onClick={() => void handleRegenerate()}
              disabled={regenerating}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3 w-3 ${regenerating ? "animate-spin" : ""}`}
              />
              Làm mới mã feed
            </button>
          </div>
        </div>

        <DialogFooter className="sm:justify-end">
          <DialogClose asChild>
            <Button variant="outline" size="sm">
              Đóng
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
