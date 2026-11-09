"use client";

import { useState } from "react";
import {
  Calendar,
  Check,
  Copy,
  ExternalLink,
  Laptop,
  RefreshCw,
  Smartphone,
  Sparkles,
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
import { regenerateCalendarFeedTokenAction } from "@/lib/actions/scheduling-actions";

export function GoogleCalendarSyncDialog({
  feedToken: initialFeedToken,
  siteUrl,
}: {
  feedToken: string;
  siteUrl: string;
}) {
  const [token, setToken] = useState(initialFeedToken);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

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
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Calendar className="h-4 w-4 text-primary" aria-hidden="true" />
          <span>Đồng bộ Google Calendar</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Đồng bộ với Google Calendar</DialogTitle>
              <DialogDescription className="mt-0.5">
                Xem và nhận thông báo lịch chụp tự động trên điện thoại & máy tính.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Quick 1-Click Action */}
          <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4 transition-colors hover:border-primary/40">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                  <Sparkles className="h-3 w-3" /> Khuyên dùng
                </span>
                <h4 className="mt-1.5 font-semibold text-foreground">
                  Thêm nhanh 1 chạm vào Google Calendar
                </h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  Bấm nút bên dưới để mở Google Calendar, sau đó bấm <strong>&ldquo;Add&rdquo; (Thêm)</strong>. Lịch sẽ tự động đồng bộ 24/7!
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
