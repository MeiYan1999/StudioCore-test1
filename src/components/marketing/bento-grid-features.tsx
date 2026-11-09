"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  Copy,
  FileCheck2,
  Heart,
  QrCode,
  Receipt,
  Shirt,
  Users2,
} from "lucide-react";
import { SpotlightCard } from "@/components/marketing/spotlight-card";
import { Badge } from "@/components/ui/badge";

export function BentoGridFeatures() {
  const [bentoCopied, setBentoCopied] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard?.writeText("IMG_0124.CR3, IMG_0138.CR3, IMG_0189.CR3");
    setBentoCopied(true);
    setTimeout(() => setBentoCopied(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
      {/* Bento Card 1: PhotoShare Zero-Storage (Wide - 2 columns on lg) */}
      <SpotlightCard className="flex flex-col justify-between p-7 lg:col-span-2 bg-gradient-to-br from-surface via-surface to-primary/[0.04]">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/10 text-violet-600 dark:bg-violet-400/10 dark:text-violet-400">
                <Camera className="h-5 w-5" />
              </span>
              <Badge tone="info">Độc quyền StudioCore</Badge>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              0 GB Dung lượng Server
            </span>
          </div>

          <h3 className="mt-5 text-2xl font-bold tracking-tight text-foreground">
            PhotoShare™ Zero-Storage &amp; Lọc 500 ảnh RAW trong 30 giây
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Khách hàng xem album trực tiếp từ Google Drive hoặc Cloud trên điện thoại với 100% độ sắc nét.
            Khách thả tim và ghi chú ảnh cần sửa; studio chỉ cần bấm 1 nút chép mã là phần mềm tự động lọc
            file RAW gốc ngay trên máy tính mà không cần tải lên tải xuống.
          </p>

          {/* Interactive Mockup Container */}
          <div className="mt-6 rounded-2xl border border-border/80 bg-background/80 p-4 shadow-xs backdrop-blur-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-foreground">Album: Cưới Ngoại Cảnh Đà Lạt</span>
                <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  12/45 ảnh đã chọn
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyCode}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs transition-all hover:bg-primary-hover active:scale-95"
              >
                {bentoCopied ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Đã chép danh sách RAW</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Chép mã lọc file RAW</span>
                  </>
                )}
              </button>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2.5 sm:grid-cols-4">
              {[
                { id: "0124", selected: true, label: "IMG_0124" },
                { id: "0138", selected: true, label: "IMG_0138" },
                { id: "0189", selected: true, label: "IMG_0189" },
                { id: "0205", selected: false, label: "IMG_0205" },
              ].map((img) => (
                <div
                  key={img.id}
                  className={`relative flex flex-col items-center justify-center rounded-xl border p-2.5 text-center transition-all ${
                    img.selected
                      ? "border-primary/50 bg-primary/5 shadow-xs"
                      : "border-border/60 bg-surface/50 opacity-60"
                  }`}
                >
                  <span className="font-mono text-xs font-bold text-foreground">{img.label}</span>
                  <div className="mt-1.5 flex items-center gap-1 text-[10px]">
                    <Heart
                      className={`h-3 w-3 ${
                        img.selected ? "fill-rose-500 text-rose-500" : "text-muted-foreground"
                      }`}
                    />
                    <span className={img.selected ? "font-semibold text-rose-500" : "text-muted-foreground"}>
                      {img.selected ? "Đã duyệt" : "Xem"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-border/60 pt-4 text-xs text-muted-foreground">
          <span>Hỗ trợ Canon (.CR2/.CR3), Sony (.ARW), Nikon (.NEF)</span>
          <Link href="/share/demo-share-album-01" className="font-semibold text-primary hover:underline">
            Thử album demo →
          </Link>
        </div>
      </SpotlightCard>

      {/* Bento Card 2: Lịch chụp Chống trùng Ekip (Tall - 1 column) */}
      <SpotlightCard className="flex flex-col justify-between p-7">
        <div>
          <div className="flex items-center justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
              <CalendarDays className="h-5 w-5" />
            </span>
            <Badge tone="warning">Thông minh</Badge>
          </div>

          <h3 className="mt-5 text-xl font-bold tracking-tight text-foreground">
            Lịch chụp &amp; Chống trùng Ekip
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Cảnh báo tức thời nếu thợ ảnh, thợ trang điểm hoặc phòng concept bị xếp trùng giờ. Xem lịch
            dạng ngày, tuần, tháng và timeline chi tiết từng nhân sự.
          </p>

          <div className="mt-6 space-y-2.5 rounded-2xl border border-border/80 bg-background/60 p-3.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground">Lịch hôm nay (4 ca)</span>
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="h-3 w-3" /> 0 xung đột
              </span>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2.5 text-xs">
              <div className="flex justify-between font-semibold text-foreground">
                <span>08:30 - 11:30 • Cưới Phim trường</span>
                <span className="text-emerald-600 dark:text-emerald-400">Đang chụp</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Photo: Minh Tuấn · Makeup: Lan Anh
              </p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-2.5 text-xs">
              <div className="flex justify-between font-semibold text-foreground">
                <span>14:00 - 17:00 • Phóng sự gia đình</span>
                <span className="text-primary font-medium">Sắp tới</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Photo: Hoàng Long · Makeup: Tuyết Mai
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-border/60 pt-4 text-xs text-muted-foreground">
          Đồng bộ lịch cá nhân của nhân sự trên điện thoại.
        </div>
      </SpotlightCard>

      {/* Bento Card 3: Hợp đồng số & Ký tay cảm ứng (1 column) */}
      <SpotlightCard className="flex flex-col justify-between p-7">
        <div>
          <div className="flex items-center justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
              <FileCheck2 className="h-5 w-5" />
            </span>
            <Badge tone="info">Hợp đồng điện tử</Badge>
          </div>

          <h3 className="mt-5 text-xl font-bold tracking-tight text-foreground">
            Hợp đồng số Ký tay &amp; VietQR
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Khách hàng ký tên trực tiếp trên iPad hoặc điện thoại. Tự động gắn mã VietQR cọc tiền chuẩn xác
            kèm nội dung chuyển khoản để hệ thống tự động gạch nợ.
          </p>

          <div className="mt-6 rounded-2xl border border-border/80 bg-background/60 p-3.5">
            <div className="flex items-center justify-between border-b border-border/60 pb-2 text-xs">
              <span className="font-semibold text-foreground">HĐ #SC-2026-089</span>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-600 dark:text-emerald-400">
                Đã ký điện tử
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Tổng tiền:</span>
              <span className="font-bold text-foreground">18.500.000 ₫</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Đã cọc (VietQR):</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">5.000.000 ₫</span>
            </div>
            <div className="mt-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-2 text-center text-[11px] text-primary font-medium">
              Chữ ký: Nguyễn Văn An (24/10/2026)
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-border/60 pt-4 text-xs text-muted-foreground">
          Bảo mật pháp lý, xuất PDF có đóng dấu studio.
        </div>
      </SpotlightCard>

      {/* Bento Card 4: Kho Váy cưới & Trang phục QR (1 column) */}
      <SpotlightCard className="flex flex-col justify-between p-7">
        <div>
          <div className="flex items-center justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
              <Shirt className="h-5 w-5" />
            </span>
            <Badge tone="neutral">Mã vạch &amp; QR</Badge>
          </div>

          <h3 className="mt-5 text-xl font-bold tracking-tight text-foreground">
            Kho Áo cưới &amp; Báo hạn trả
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Quét mã QR để xem ảnh mẫu váy, lịch sử giặt ủi, thông số 3 vòng của khách và tự động cảnh báo
            khi khách quá hạn trả đồ thuê.
          </p>

          <div className="mt-6 rounded-2xl border border-border/80 bg-background/60 p-3.5 space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface border border-border text-foreground font-mono text-xs">
                <QrCode className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-foreground">Váy Cưới Đuôi Cá Hoàng Gia</p>
                <p className="text-[11px] text-muted-foreground">Mã: VC-042 · Size: M (84-66-92)</p>
              </div>
            </div>
            <div className="rounded-lg bg-amber-500/10 p-2 text-[11px] text-amber-700 dark:text-amber-300 font-medium">
              Khách thuê: Trần Thu Trang · Hạn trả: 18:00 Ngày mai
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-border/60 pt-4 text-xs text-muted-foreground">
          Chấm dứt tình trạng thất lạc hoặc nhầm phụ kiện.
        </div>
      </SpotlightCard>

      {/* Bento Card 5: Kế toán Thuế Hộ Kinh Doanh (1 column) */}
      <SpotlightCard className="flex flex-col justify-between p-7">
        <div>
          <div className="flex items-center justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <Receipt className="h-5 w-5" />
            </span>
            <Badge tone="success">Chuẩn Thuế HKD</Badge>
          </div>

          <h3 className="mt-5 text-xl font-bold tracking-tight text-foreground">
            Kế toán Thuế Hộ Kinh Doanh
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Tự động tính thuế VAT &amp; TNCN theo Thông tư của Bộ Tài Chính dành cho ngành nghề dịch vụ studio,
            theo dõi sổ quỹ tiền mặt và ngân hàng độc lập.
          </p>

          <div className="mt-6 rounded-2xl border border-border/80 bg-background/60 p-3.5 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Doanh thu chịu thuế tháng:</span>
              <span className="font-bold text-foreground">142.000.000 ₫</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Thuế VAT HKD (5%):</span>
              <span className="font-semibold text-foreground">7.100.000 ₫</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Thuế TNCN HKD (2%):</span>
              <span className="font-semibold text-foreground">2.840.000 ₫</span>
            </div>
            <div className="border-t border-border/60 pt-1.5 flex justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <span>Lợi nhuận ròng sau thuế:</span>
              <span>86.450.000 ₫</span>
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-border/60 pt-4 text-xs text-muted-foreground">
          Xuất báo cáo tài chính dạng Excel nộp thuế tức thì.
        </div>
      </SpotlightCard>

      {/* Bento Card 6: Tự động tính Hoa hồng & Lương Ekip (Wide - 2 columns on lg) */}
      <SpotlightCard className="flex flex-col justify-between p-7 lg:col-span-2 bg-gradient-to-br from-surface via-surface to-violet-500/[0.03]">
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-fuchsia-500/10 text-fuchsia-500">
                <Users2 className="h-5 w-5" />
              </span>
              <Badge tone="info">Minh bạch 100%</Badge>
            </div>
            <span className="text-xs font-semibold text-muted-foreground">
              Tự động hóa toàn diện
            </span>
          </div>

          <h3 className="mt-5 text-2xl font-bold tracking-tight text-foreground">
            Bảng tính Hoa hồng &amp; Lương Ekip Tự động theo Ca chụp
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Không còn tranh cãi hay nhầm lẫn ngày công cuối tháng. Thiết lập công thức hoa hồng linh hoạt
            theo gói chụp, % giá trị hợp đồng hoặc phụ cấp ngoại tỉnh. Nhân viên tra cứu thu nhập minh bạch
            trên giao diện tài khoản riêng.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              { role: "Thợ chụp chính", name: "Trần Minh Tuấn", amount: "12.800.000 ₫", shoots: "16 ca chụp" },
              { role: "Chuyên viên Makeup", name: "Nguyễn Lan Anh", amount: "9.600.000 ₫", shoots: "12 ca chụp" },
              { role: "Retoucher Photoshop", name: "Lê Văn Hùng", amount: "8.400.000 ₫", shoots: "280 ảnh sửa" },
            ].map((staff) => (
              <div
                key={staff.name}
                className="rounded-2xl border border-border/80 bg-background/70 p-3.5 shadow-xs"
              >
                <span className="text-[11px] font-semibold text-primary">{staff.role}</span>
                <p className="mt-1 text-xs font-bold text-foreground">{staff.name}</p>
                <p className="mt-2 text-base font-extrabold text-foreground">{staff.amount}</p>
                <p className="text-[10px] text-muted-foreground">{staff.shoots}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between border-t border-border/60 pt-4 text-xs text-muted-foreground">
          <span>Hỗ trợ duyệt phiếu lương hàng loạt chỉ với 1 click.</span>
          <Link href="/phan-mem-quan-ly-studio" className="font-semibold text-primary hover:underline">
            Xem toàn bộ 20+ tính năng →
          </Link>
        </div>
      </SpotlightCard>
    </div>
  );
}
