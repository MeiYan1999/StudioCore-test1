"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bell,
  BellOff,
  Calendar,
  Check,
  CheckSquare,
  Cog,
  Loader2,
  MessageSquare,
  Send,
  Share2,
  ShoppingCart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import type {
  PushCategories,
  PushCategoryKey,
  PushSettings,
} from "@/lib/services/push-settings-service";
import {
  togglePushEnabledAction,
  updatePushCategoryAction,
} from "@/lib/actions/push-settings-actions";

type Props = {
  initialSettings: PushSettings;
  tenantName: string;
};

export function WebPushSettingsView({ initialSettings, tenantName }: Props) {
  const [enabled, setEnabled] = useState(initialSettings.enabled);
  const [categories, setCategories] = useState<PushCategories>(
    initialSettings.categories,
  );
  const [browserPermission, setBrowserPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");
  const [userAgent, setUserAgent] = useState("");
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  const [isToggling, setIsToggling] = useState(false);
  const [togglingCategory, setTogglingCategory] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "danger";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setUserAgent(navigator.userAgent || "");
      const iosCheck = /iPad|iPhone|iPod/.test(navigator.userAgent || "");
      setIsIos(iosCheck);

      const standaloneCheck =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone ===
          true;
      setIsStandalone(Boolean(standaloneCheck));

      if ("Notification" in window) {
        setBrowserPermission(Notification.permission);
      } else {
        setBrowserPermission("unsupported");
      }
    }
  }, []);

  const handleToggleMainPush = async () => {
    setIsToggling(true);
    setFeedback(null);
    try {
      const nextState = !enabled;

      // If user is enabling, ask browser for permission
      if (nextState && typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission !== "granted") {
          const perm = await Notification.requestPermission();
          setBrowserPermission(perm);
          if (perm !== "granted") {
            setFeedback({
              tone: "danger",
              text: "Trình duyệt đã từ chối quyền thông báo. Vui lòng bấm vào biểu tượng ổ khóa trên thanh địa chỉ để cấp quyền.",
            });
            setIsToggling(false);
            return;
          }
        }
      }

      const res = await togglePushEnabledAction(nextState);
      if (res.ok) {
        setEnabled(nextState);
        setFeedback({ tone: "success", text: res.message });

        if (nextState && typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          new Notification("StudioCore - Đã bật thông báo đẩy", {
            body: "Thiết bị này đã sẵn sàng nhận thông báo khi có tin nhắn, đơn mới và lịch chụp.",
            icon: "/icon.svg",
          });
        }
      } else {
        setFeedback({ tone: "danger", text: res.message });
      }
    } catch (err) {
      setFeedback({
        tone: "danger",
        text: err instanceof Error ? err.message : "Lỗi chuyển trạng thái thông báo.",
      });
    } finally {
      setIsToggling(false);
    }
  };

  const handleToggleCategory = async (key: PushCategoryKey) => {
    setTogglingCategory(key);
    const nextVal = !categories[key];
    try {
      const res = await updatePushCategoryAction(key, nextVal);
      if (res.ok) {
        setCategories((prev) => ({ ...prev, [key]: nextVal }));
      }
    } catch (err) {
      console.warn("Failed to toggle category:", err);
    } finally {
      setTogglingCategory(null);
    }
  };

  const handleSendTestNotification = () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setFeedback({
        tone: "danger",
        text: "Trình duyệt này không hỗ trợ thông báo đẩy Web Push.",
      });
      return;
    }

    if (Notification.permission !== "granted") {
      setFeedback({
        tone: "danger",
        text: "Chưa cấp quyền thông báo trên trình duyệt. Vui lòng bấm 'Bật thông báo' trước.",
      });
      return;
    }

    new Notification("StudioCore - Thông báo thử nghiệm", {
      body: "Chúc mừng! Hệ thống Web Push đang hoạt động ổn định trên thiết bị này.",
      icon: "/icon.svg",
    });

    setFeedback({
      tone: "success",
      text: "Đã gửi thông báo thử nghiệm thành công lên màn hình của bạn!",
    });
  };

  const categoryList: {
    key: PushCategoryKey;
    title: string;
    description: string;
    icon: typeof MessageSquare;
  }[] = [
    {
      key: "messages",
      title: "Tin nhắn mới",
      description: "Inbox Facebook, Zalo, hội thoại CRM",
      icon: MessageSquare,
    },
    {
      key: "orders",
      title: "Đơn hàng mới",
      description: "Có đơn mới, đơn được giao cho bạn",
      icon: ShoppingCart,
    },
    {
      key: "approvals",
      title: "Lệnh chờ duyệt",
      description: "Phép, chi phí, mua sắm, social post chờ duyệt",
      icon: CheckSquare,
    },
    {
      key: "calendar",
      title: "Lịch chụp / công việc",
      description: "Sắp đến giờ, lịch mới được phân công",
      icon: Calendar,
    },
    {
      key: "social",
      title: "Mạng xã hội",
      description: "Bình luận mới, bài đăng đã lên sóng",
      icon: Share2,
    },
    {
      key: "system",
      title: "Hệ thống & thông báo nội bộ",
      description: "Thông báo nội bộ, cập nhật quan trọng",
      icon: Cog,
    },
  ];

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Top Header matching StudioBase */}
      <div className="flex items-center gap-3">
        <Button
          asChild
          variant="outline"
          size="sm"
          className="h-8 gap-1 rounded-lg text-xs font-medium"
        >
          <Link href="/manage/settings">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Trở lại</span>
          </Link>
        </Button>
        <span className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          {tenantName || "StudioCore"}
        </span>
      </div>

      {feedback ? (
        <Alert tone={feedback.tone} className="mt-2">
          {feedback.text}
        </Alert>
      ) : null}

      {/* Card 1: Thông báo đẩy (Web Push) */}
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-foreground" aria-hidden="true" />
            <h1 className="text-base font-semibold text-foreground">
              Thông báo đẩy (Web Push)
            </h1>
          </div>
          {enabled ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#16a34a] px-3 py-1 text-xs font-semibold text-white shadow-xs">
              <Check className="h-3.5 w-3.5" />
              Đã bật thông báo
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-semibold text-muted-foreground border border-border">
              Chưa bật thông báo
            </span>
          )}
        </div>

        <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Bật thông báo để nhận tin nhắn, đơn mới, lịch chụp... trực tiếp lên
          thiết bị, ngay cả khi không mở app.
        </p>

        {/* Action Button: Bật / Tắt */}
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            onClick={handleToggleMainPush}
            disabled={isToggling}
            className="rounded-xl bg-[#2563eb] hover:bg-blue-700 text-white px-5 py-2.5 text-sm font-medium gap-2 shadow-xs transition-colors"
          >
            {isToggling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : enabled ? (
              <BellOff className="h-4 w-4" />
            ) : (
              <Bell className="h-4 w-4" />
            )}
            <span>{enabled ? "Tắt thông báo" : "Bật thông báo"}</span>
          </Button>

          {enabled ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSendTestNotification}
              className="rounded-xl text-xs font-medium gap-1.5"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Gửi thử thông báo</span>
            </Button>
          ) : null}
        </div>

        {/* Device Information Line */}
        <div className="mt-5 border-t border-border/60 pt-3 text-[11px] sm:text-xs text-muted-foreground space-y-0.5 break-all">
          <p>
            <strong>Thiết bị:</strong> {userAgent || "Đang phát hiện trình duyệt..."}
          </p>
          <p>
            iOS: {String(isIos)} · Standalone PWA: {String(isStandalone)} · Quyền trình duyệt: {browserPermission}
          </p>
        </div>
      </section>

      {/* Card 2: Chọn loại thông báo muốn nhận */}
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-xs">
        <h2 className="text-base font-semibold text-foreground">
          Chọn loại thông báo muốn nhận
        </h2>

        <div className="mt-3 divide-y divide-border/60">
          {categoryList.map((item) => {
            const Icon = item.icon;
            const isChecked = categories[item.key];
            const isPending = togglingCategory === item.key;

            return (
              <div
                key={item.key}
                className="flex items-center justify-between py-3.5 first:pt-2 last:pb-1"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/40 text-foreground">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {item.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </div>

                {/* Accessible Switch Toggle matching Image */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={isChecked}
                  disabled={isPending}
                  onClick={() => handleToggleCategory(item.key)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    isChecked ? "bg-primary" : "bg-slate-300 dark:bg-slate-700"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                      isChecked ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-4 border-t border-border/60 pt-3 text-xs text-muted-foreground">
          Tắt một loại sẽ không gửi push cho loại đó, các loại khác vẫn nhận bình
          thường. Áp dụng cho tất cả thiết bị của bạn.
        </div>
      </section>
    </div>
  );
}
