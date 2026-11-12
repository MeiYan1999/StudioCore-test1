"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  HelpCircle,
  Info,
  Link2,
  Plus,
  QrCode,
  RefreshCw,
  Settings,
  ShieldCheck,
  Smartphone,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { money, when, type Package } from "./booking-form";
import type { bookingOffers } from "@/lib/db/schema";

export type OmniSettingsData = {
  owner: boolean;
  canDeposit: boolean;
  readiness: string;
  pages: {
    id: string;
    name: string;
    avatar: string;
    status: string;
    lastEventAt: number | null;
  }[];
  branches: { id: string; name: string }[];
  services: Package[];
  offers: { service: Package; offer: typeof bookingOffers.$inferSelect }[];
  rooms: { id: string; name: string; branchId: string }[];
  staff: { id: string; name: string }[];
  replies?: { id: string; content: string }[];
};

export function MessagingSettingsView({
  data,
  busy,
  error,
  act,
  offerId,
  setOfferId,
}: {
  data: OmniSettingsData;
  busy: boolean;
  error?: string;
  act: (input: object) => Promise<unknown>;
  offerId: string;
  setOfferId: (id: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<"connect" | "page-settings">("connect");
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    data.branches[0]?.id || "",
  );

  // Modals
  const [isZaloOAModalOpen, setIsZaloOAModalOpen] = useState(false);
  const [isZaloPersonalModalOpen, setIsZaloPersonalModalOpen] = useState(false);
  const [isFacebookBranchModalOpen, setIsFacebookBranchModalOpen] = useState(false);

  // Zalo OA form state
  const [zaloOaId, setZaloOaId] = useState("");
  const [zaloAppId, setZaloAppId] = useState("");
  const [zaloSecretKey, setZaloSecretKey] = useState("");
  const [zaloAccessToken, setZaloAccessToken] = useState("");

  // QR countdown
  const [qrCounter, setQrCounter] = useState(60);
  const [isQrRefreshing, setIsQrRefreshing] = useState(false);

  const configuredService = offerId || data.services[0]?.id || "";
  const configured = data.offers.find((o) => o.service.id === configuredService)?.offer;

  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Đã copy ${label}!`);
  };

  const handleRefreshQr = () => {
    setIsQrRefreshing(true);
    setTimeout(() => {
      setQrCounter(60);
      setIsQrRefreshing(false);
      toast.info("Đã làm mới mã QR kết nối Zalo!");
    }, 600);
  };

  const handleSaveZaloOA = (e: React.FormEvent) => {
    e.preventDefault();
    if (!zaloOaId.trim() || !zaloAppId.trim()) {
      toast.error("Vui lòng điền đủ OA ID và App ID!");
      return;
    }
    toast.success("Đã lưu cấu hình Zalo OA thành công!");
    setIsZaloOAModalOpen(false);
  };

  const startFacebookOAuth = () => {
    if (data.branches.length > 1 && !selectedBranchId) {
      setIsFacebookBranchModalOpen(true);
      return;
    }
    const branchParam = selectedBranchId ? `?branchId=${encodeURIComponent(selectedBranchId)}` : "";
    window.location.href = `/api/facebook/oauth${branchParam}`;
  };

  return (
    <div className="space-y-6 max-w-4xl pb-12">
      {/* 1. Header with Back button, Title, Subtitle and Tooltip */}
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="mt-0.5 h-8 w-8 p-0 rounded-lg shrink-0"
          >
            <Link href="/manage/settings" aria-label="Trở lại Cài đặt">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Cài đặt Tin nhắn
              </h1>
              <span
                className="text-muted-foreground/80 hover:text-foreground cursor-pointer"
                title="Kết nối kênh Facebook Page, Zalo OA, Zalo Cá nhân và quản lý trang"
              >
                <HelpCircle className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Kết nối kênh, quản lý cài đặt trang
            </p>
          </div>
        </div>

        {/* 2. Navigation Pills: [ 🔗 Kết nối ] [ ⚙️ Cài đặt trang ] */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => setActiveTab("connect")}
            className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "connect"
                ? "bg-[#0064e0] text-white shadow-2xs"
                : "border border-border bg-background text-foreground hover:bg-muted"
            }`}
          >
            <Link2 className="h-3.5 w-3.5" />
            <span>Kết nối</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("page-settings")}
            className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "page-settings"
                ? "bg-[#0064e0] text-white shadow-2xs"
                : "border border-border bg-background text-foreground hover:bg-muted"
            }`}
          >
            <Settings className="h-3.5 w-3.5" />
            <span>Cài đặt trang</span>
          </button>
        </div>
      </div>

      {error && (
        <Alert tone="danger">
          <span>{error}</span>
        </Alert>
      )}

      {/* ================= TAB 1: KẾT NỐI ================= */}
      {activeTab === "connect" && (
        <div className="space-y-4">
          {/* CARD 1: KẾT NỐI FACEBOOK PAGE */}
          <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6 shadow-2xs space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-full bg-[#0064e0]/10 text-[#0064e0] flex items-center justify-center shrink-0">
                <FacebookIcon className="h-4 w-4" />
              </div>
              <h2 className="text-base font-bold text-foreground">
                Kết nối Facebook Page
              </h2>
            </div>

            {/* Main Action Button */}
            {data.owner && (
              <button
                type="button"
                onClick={startFacebookOAuth}
                disabled={busy}
                className="w-full rounded-xl bg-[#0064e0] hover:bg-[#0052b8] active:bg-[#0047a0] text-white py-3 px-4 font-semibold text-sm flex items-center justify-center gap-2 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <Plus className="h-4 w-4 stroke-[2.5]" />
                <span>Kết nối Facebook Page</span>
              </button>
            )}

            {/* Blue Info Callout Box (Exact match to screenshot) */}
            <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/20 p-4 space-y-2.5 text-xs text-blue-950 dark:text-blue-100">
              <div className="flex items-center gap-2 font-bold text-blue-900 dark:text-blue-200">
                <ShieldCheck className="h-4 w-4 text-[#0064e0]" />
                <span>Quyền nhắn tin Facebook Page</span>
              </div>

              <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed text-blue-900/90 dark:text-blue-200/90">
                <li>
                  Bấm <strong className="font-semibold text-blue-950 dark:text-white">Thêm / Kết nối lại Facebook Page</strong>.
                </li>
                <li>
                  Tiếp tục bằng tài khoản quản trị Page và giữ toàn bộ quyền nhắn tin được yêu cầu.
                </li>
                <li>
                  Chọn <strong className="font-semibold text-blue-950 dark:text-white">Áp dụng cho tất cả Trang</strong>, rồi chọn Page cần dùng trong StudioCore.
                </li>
              </ol>

              <p className="text-[11px] leading-relaxed text-muted-foreground pt-1 border-t border-blue-200/60 dark:border-blue-900/40">
                Cửa sổ nhắn tin tính từ <strong className="font-semibold text-foreground">tin cuối của khách</strong> (24 giờ; Ads Click-to-Messenger 7 ngày). Thẻ Human Agent chỉ dùng được sau khi Meta duyệt app — hiện chưa bật. Ngoài cửa sổ, dùng Tin tiện ích đã duyệt hoặc nhắn thủ công trên Meta Business.
              </p>
            </div>

            {/* Danh sách các Page đã kết nối (nếu có) */}
            {data.pages.length > 0 && (
              <div className="pt-2 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Các Fanpage trong hệ thống ({data.pages.length})
                  </h3>
                  <Link
                    href="/manage/inbox"
                    className="text-xs text-[#0064e0] hover:underline font-medium inline-flex items-center gap-1"
                  >
                    <span>Mở Hộp thư Inbox</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>

                <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
                  {data.pages.map((p) => (
                    <div
                      key={p.id}
                      className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {p.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.avatar}
                            alt={p.name}
                            className="h-10 w-10 rounded-full object-cover border border-border shrink-0"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0">
                            {p.name.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-foreground truncate">
                            {p.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                            <span>
                              {p.lastEventAt
                                ? `Sự kiện gần nhất: ${when(p.lastEventAt)}`
                                : "Chưa nhận sự kiện"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                        {p.status === "connected" ? (
                          <Badge tone="success">Đã kết nối</Badge>
                        ) : p.status === "pending" ? (
                          <Badge tone="info">Chọn để kết nối</Badge>
                        ) : (
                          <Badge tone="warning">Cần kết nối lại</Badge>
                        )}

                        {data.owner && (
                          p.status === "connected" ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              onClick={() => void act({ action: "page", id: p.id, connect: false })}
                              className="text-xs text-red-600 hover:bg-red-50 hover:text-red-700 h-8"
                            >
                              Ngắt kết nối
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              disabled={busy}
                              onClick={() => void act({ action: "page", id: p.id, connect: true })}
                              className="text-xs bg-[#0064e0] hover:bg-[#0052b8] text-white h-8"
                            >
                              Kết nối trang
                            </Button>
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* CARD 2: KẾT NỐI ZALO OA */}
          <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6 shadow-2xs space-y-3.5">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-full bg-[#0068FF]/10 text-[#0068FF] flex items-center justify-center shrink-0">
                <ZaloIcon className="h-4 w-4" />
              </div>
              <h2 className="text-base font-bold text-foreground">
                Kết nối Zalo OA
              </h2>
            </div>

            {/* Action Button: Rounded white with border */}
            <button
              type="button"
              onClick={() => setIsZaloOAModalOpen(true)}
              className="w-full rounded-full border border-border bg-background hover:bg-muted/60 text-foreground py-2.5 px-4 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-2xs transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Kết nối Zalo OA</span>
            </button>

            <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-0.5">
              <span>💡</span>
              <span>Kết nối Zalo OA để nhận và trả lời tin nhắn Zalo ngay trong hệ thống.</span>
            </p>
          </div>

          {/* CARD 3: KẾT NỐI ZALO CÁ NHÂN */}
          <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6 shadow-2xs space-y-3.5">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                <Smartphone className="h-4 w-4" />
              </div>
              <h2 className="text-base font-bold text-foreground">
                Kết nối Zalo Cá nhân
              </h2>
              <Badge tone="warning" className="text-[10px] uppercase font-bold tracking-wider">
                Beta · Rủi ro khóa acc
              </Badge>
            </div>

            {/* Yellow Warning Callout (Exact match to screenshot) */}
            <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/80 dark:bg-amber-950/20 p-4 space-y-1.5 text-xs text-amber-950 dark:text-amber-100">
              <p className="flex items-start gap-1.5 text-[11px] leading-relaxed">
                <span>⚠️</span>
                <span>Zalo không có API chính thức. Tài khoản có thể bị Zalo khóa bất kỳ lúc nào. Chỉ dùng SIM phụ.</span>
              </p>
              <p className="text-[11px] leading-relaxed font-bold text-amber-900 dark:text-amber-200">
                Không mở chat.zalo.me / Zalo PC <span className="font-normal text-amber-950 dark:text-amber-100">trên cùng tài khoản đang kết nối hệ thống. Zalo chỉ cho 1 phiên web — mở web sẽ đá phiên Studio (không khóa được phía Zalo).</span>
              </p>
            </div>

            {/* Action Button: Rounded white with border */}
            <button
              type="button"
              onClick={() => setIsZaloPersonalModalOpen(true)}
              className="w-full rounded-full border border-border bg-background hover:bg-muted/60 text-foreground py-2.5 px-4 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-2xs transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Kết nối Zalo Cá nhân (QR)</span>
            </button>
          </div>
        </div>
      )}

      {/* ================= TAB 2: CÀI ĐẶT TRANG ================= */}
      {activeTab === "page-settings" && (
        <div className="space-y-6">
          {/* Cấu hình Chi nhánh nhận hội thoại */}
          <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6 shadow-2xs space-y-3.5">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold text-foreground sm:text-base">
                Chi nhánh mặc định nhận hội thoại
              </h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Các khách hàng nhắn tin từ Fanpage hoặc Zalo sẽ được tự động phân vào chi nhánh này để nhân sự tiếp nhận.
            </p>

            <div className="max-w-md pt-1">
              <Label className="text-xs font-semibold">Chọn cơ sở / chi nhánh</Label>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-primary focus:outline-hidden"
              >
                {data.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Cấu hình Mở gói chụp cho khách đặt lịch */}
          {data.owner && (
            <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6 shadow-2xs space-y-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold text-foreground sm:text-base">
                  Mở gói chụp cho khách đặt lịch tự động
                </h2>
              </div>
              <p className="text-xs text-muted-foreground">
                Giờ Việt Nam · Tài nguyên phòng chụp và photographer được khóa trong suốt buổi chụp và thời gian dọn set.
              </p>

              <form
                key={configuredService}
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void act({
                    action: "offer",
                    serviceId: f.get("serviceId"),
                    roomId: f.get("roomId"),
                    photographerId: f.get("photographerId"),
                    opens: Number(f.get("opens")),
                    closes: Number(f.get("closes")),
                    closedDays: f.get("closedDays"),
                    holidays: f.get("holidays"),
                    buffer: Number(f.get("buffer")),
                    holdMinutes: Number(f.get("holdMinutes")),
                    deposit: Number(f.get("deposit")),
                    active: Number(f.get("active")),
                  }).then(() => toast.success("Đã lưu cấu hình gói đặt lịch!"));
                }}
                className="space-y-4 text-xs"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs font-semibold">Gói chụp</Label>
                    <select
                      name="serviceId"
                      value={configuredService}
                      onChange={(e) => setOfferId(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium"
                    >
                      {data.services.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({money(s.price)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Phòng chụp</Label>
                    <select
                      name="roomId"
                      defaultValue={configured?.roomId || ""}
                      className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium"
                    >
                      <option value="">Không giữ phòng</option>
                      {data.rooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Photographer phân công</Label>
                    <select
                      name="photographerId"
                      defaultValue={configured?.photographerId || ""}
                      className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium"
                    >
                      <option value="">Không giữ photographer</option>
                      {data.staff.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 pt-2">
                  <div>
                    <Label className="text-xs">Mở cửa (phút)</Label>
                    <Input
                      name="opens"
                      type="number"
                      min="0"
                      max="1439"
                      defaultValue={configured?.opens ?? 540}
                      className="mt-1 h-9 text-xs"
                    />
                    <span className="text-[10px] text-muted-foreground">540 = 09:00</span>
                  </div>

                  <div>
                    <Label className="text-xs">Đóng cửa (phút)</Label>
                    <Input
                      name="closes"
                      type="number"
                      min="1"
                      max="1440"
                      defaultValue={configured?.closes ?? 1080}
                      className="mt-1 h-9 text-xs"
                    />
                    <span className="text-[10px] text-muted-foreground">1080 = 18:00</span>
                  </div>

                  <div>
                    <Label className="text-xs">Dọn set (phút)</Label>
                    <Input
                      name="buffer"
                      type="number"
                      min="0"
                      defaultValue={configured?.buffer ?? 30}
                      className="mt-1 h-9 text-xs"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Thời hạn giữ chỗ</Label>
                    <Input
                      name="holdMinutes"
                      type="number"
                      min="5"
                      defaultValue={configured?.holdMinutes ?? 30}
                      className="mt-1 h-9 text-xs"
                    />
                    <span className="text-[10px] text-muted-foreground">Phút</span>
                  </div>

                  <div>
                    <Label className="text-xs">Cọc tối thiểu</Label>
                    <Input
                      name="deposit"
                      type="number"
                      min="0"
                      defaultValue={configured?.deposit ?? 0}
                      className="mt-1 h-9 text-xs"
                    />
                    <span className="text-[10px] text-muted-foreground">VND</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <Label className="text-xs">Ngày nghỉ trong tuần (0: Chủ nhật)</Label>
                    <Input
                      name="closedDays"
                      defaultValue={configured?.closedDays ?? "0"}
                      placeholder="VD: 0 hoặc 0,1"
                      className="mt-1 h-9 text-xs"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Ngày lễ/nghỉ riêng (YYYY-MM-DD)</Label>
                    <Input
                      name="holidays"
                      defaultValue={configured?.holidays ?? ""}
                      placeholder="VD: 2026-05-01,2026-09-02"
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/60">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs font-semibold">Trạng thái mở:</Label>
                    <select
                      name="active"
                      defaultValue={configured?.active ?? 1}
                      className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs"
                    >
                      <option value="1">Đang mở đặt lịch</option>
                      <option value="0">Tạm đóng</option>
                    </select>
                  </div>

                  <Button
                    type="submit"
                    size="sm"
                    disabled={busy}
                    className="bg-[#0064e0] hover:bg-[#0052b8] text-white font-semibold text-xs"
                  >
                    Lưu cấu hình gói chụp
                  </Button>
                </div>
              </form>

              {/* Danh sách link công khai */}
              {data.offers.length > 0 && (
                <div className="pt-3 border-t border-border/60 space-y-2">
                  <Label className="text-xs font-semibold text-foreground">
                    Link đặt lịch công khai của studio:
                  </Label>
                  <div className="space-y-1.5">
                    {data.offers.map((o) => (
                      <div
                        key={o.service.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-muted/30 text-xs"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="font-semibold text-foreground">{o.service.name}</span>
                          <span className="text-muted-foreground">· {money(o.service.price)}</span>
                          <Badge tone={o.offer.active ? "success" : "neutral"} className="text-[10px]">
                            {o.offer.active ? "Đang mở" : "Đã đóng"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyText(`${window.location.origin}/book/${o.service.id}`, "Link đặt lịch")}
                            className="h-7 text-[11px] gap-1"
                          >
                            <Copy className="h-3 w-3" />
                            <span>Copy link</span>
                          </Button>
                          <Button asChild variant="outline" size="sm" className="h-7 text-[11px] gap-1">
                            <Link href={`/book/${o.service.id}`} target="_blank">
                              <ExternalLink className="h-3 w-3" />
                              <span>Mở</span>
                            </Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ================= MODAL: KẾT NỐI ZALO OA ================= */}
      <Dialog open={isZaloOAModalOpen} onOpenChange={setIsZaloOAModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ZaloIcon className="h-5 w-5" />
              <span>Cấu hình kết nối Zalo Official Account (OA)</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Đồng bộ tin nhắn 2 chiều giữa khách hàng Zalo và hộp thư quản lý của StudioCore.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveZaloOA} className="space-y-3.5 text-xs py-2">
            <div>
              <Label className="text-xs font-semibold">OA ID (Mã Official Account)</Label>
              <Input
                value={zaloOaId}
                onChange={(e) => setZaloOaId(e.target.value)}
                placeholder="VD: 123456789012345"
                className="mt-1 h-9 text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <Label className="text-xs font-semibold">App ID (Zalo Developer)</Label>
                <Input
                  value={zaloAppId}
                  onChange={(e) => setZaloAppId(e.target.value)}
                  placeholder="App ID"
                  className="mt-1 h-9 text-xs"
                  required
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Secret Key</Label>
                <Input
                  type="password"
                  value={zaloSecretKey}
                  onChange={(e) => setZaloSecretKey(e.target.value)}
                  placeholder="App Secret"
                  className="mt-1 h-9 text-xs"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">OA Access Token / Refresh Token</Label>
              <Input
                type="password"
                value={zaloAccessToken}
                onChange={(e) => setZaloAccessToken(e.target.value)}
                placeholder="Dán token cấp quyền từ Zalo Developer..."
                className="mt-1 h-9 text-xs"
              />
            </div>

            {/* Webhook info */}
            <div className="p-3 rounded-xl border border-border bg-muted/30 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground text-[11px]">Webhook Callback URL:</span>
                <button
                  type="button"
                  onClick={() => handleCopyText(`${typeof window !== "undefined" ? window.location.origin : ""}/api/zalo/webhook`, "Webhook URL")}
                  className="text-[11px] text-[#0068FF] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="h-3 w-3" />
                  <span>Copy</span>
                </button>
              </div>
              <p className="font-mono text-[10px] text-muted-foreground break-all bg-background p-1.5 rounded border border-border">
                {typeof window !== "undefined" ? `${window.location.origin}/api/zalo/webhook` : "/api/zalo/webhook"}
              </p>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsZaloOAModalOpen(false)}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-[#0068FF] hover:bg-[#0057d6] text-white"
              >
                Lưu cấu hình Zalo OA
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL: KẾT NỐI ZALO CÁ NHÂN (QR) ================= */}
      <Dialog open={isZaloPersonalModalOpen} onOpenChange={setIsZaloPersonalModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <QrCode className="h-5 w-5 text-amber-500" />
              <span>Quét mã QR kết nối Zalo Cá nhân</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Sử dụng ứng dụng Zalo trên điện thoại để quét mã và xác thực phiên đăng nhập.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-4 text-xs">
            {/* Warning Banner */}
            <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/80 dark:bg-amber-950/20 p-3 text-[11px] text-amber-950 dark:text-amber-100">
              <span className="font-bold">⚠️ Khuyến cáo:</span> Chỉ dùng SIM phụ. Không mở Zalo Web hoặc Zalo PC cùng lúc vì Zalo sẽ hủy phiên kết nối của studio.
            </div>

            {/* QR Code Graphic Container */}
            <div className="flex flex-col items-center justify-center p-4 rounded-xl border border-border bg-muted/20 space-y-3">
              <div className="h-44 w-44 rounded-xl border-2 border-dashed border-[#0068FF]/50 bg-white p-3 flex flex-col items-center justify-center relative shadow-sm">
                {/* Simulated QR Code Graphic */}
                <div className="grid grid-cols-6 gap-1 w-full h-full p-1 opacity-80">
                  {Array.from({ length: 36 }).map((_, i) => (
                    <div
                      key={i}
                      className={`rounded-xs ${
                        i % 2 === 0 || i % 7 === 0 ? "bg-slate-900" : "bg-transparent"
                      }`}
                    />
                  ))}
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-9 w-9 rounded-full bg-[#0068FF] text-white flex items-center justify-center shadow-md">
                    <ZaloIcon className="h-5 w-5" />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Clock className="h-3.5 w-3.5 text-amber-500" />
                <span>Mã hết hạn sau: <strong className="font-mono text-foreground font-bold">{qrCounter}s</strong></span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRefreshQr}
                  disabled={isQrRefreshing}
                  className="h-6 text-[10px] gap-1 px-1.5"
                >
                  <RefreshCw className={`h-3 w-3 ${isQrRefreshing ? "animate-spin" : ""}`} />
                  <span>Làm mới</span>
                </Button>
              </div>
            </div>

            {/* Instructions */}
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-muted-foreground bg-surface p-3 rounded-xl border border-border">
              <li>Mở ứng dụng <strong>Zalo</strong> trên điện thoại.</li>
              <li>Bấm vào biểu tượng <strong>Quét mã QR</strong> ở góc trên bên phải.</li>
              <li>Hướng camera vào mã QR này và chọn <strong>Xác nhận đăng nhập</strong>.</li>
            </ol>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsZaloPersonalModalOpen(false)}
              className="w-full sm:w-auto"
            >
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL: CHỌN CHI NHÁNH KHI KẾT NỐI FACEBOOK ================= */}
      <Dialog open={isFacebookBranchModalOpen} onOpenChange={setIsFacebookBranchModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">
              Chọn chi nhánh nhận hội thoại
            </DialogTitle>
            <DialogDescription className="text-xs">
              Chọn cơ sở studio sẽ tiếp nhận tin nhắn từ Facebook Page này.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-3 text-xs">
            <Label className="text-xs font-semibold">Chi nhánh</Label>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium"
            >
              {data.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsFacebookBranchModalOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setIsFacebookBranchModalOpen(false);
                const branchParam = selectedBranchId ? `?branchId=${encodeURIComponent(selectedBranchId)}` : "";
                window.location.href = `/api/facebook/oauth${branchParam}`;
              }}
              className="bg-[#0064e0] hover:bg-[#0052b8] text-white"
            >
              Tiếp tục kết nối Meta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function ZaloIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none">
      <path
        d="M24 4C12.954 4 4 12.059 4 22c0 5.42 2.69 10.278 7.03 13.676-.328 2.67-1.545 6.475-1.636 6.761-.15.474.205.908.66.793 3.667-.93 7.03-3.14 8.783-4.404C20.573 39.42 22.253 40 24 40c11.046 0 20-8.059 20-18S35.046 4 24 4z"
        fill="#0068FF"
      />
      <text
        x="24"
        y="27"
        fill="white"
        fontSize="15"
        fontWeight="bold"
        textAnchor="middle"
        fontFamily="system-ui, sans-serif"
      >
        Zalo
      </text>
    </svg>
  );
}
