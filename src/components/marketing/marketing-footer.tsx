import Link from "next/link";
import { MARKETING_CONTACT } from "@/lib/marketing/content";

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto grid w-full max-w-[1240px] gap-8 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-base font-bold text-primary-foreground">
              S
            </span>
            <span className="text-base font-semibold">StudioCore</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Nền tảng quản lý studio chụp ảnh &amp; áo cưới hàng đầu Việt Nam: CRM, đơn hàng, lịch chụp, hợp đồng số, PhotoShare và quản trị tài chính toàn diện.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            © 2026 StudioCore. Bản quyền thuộc về StudioCore. Hotline hỗ trợ: {MARKETING_CONTACT.phone}.
          </p>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Sản phẩm</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link href="/phan-mem-quan-ly-studio" className="hover:text-primary">Quản lý studio</Link></li>
            <li><Link href="/crm-studio-chup-anh" className="hover:text-primary">CRM studio</Link></li>
            <li><Link href="/#features" className="hover:text-primary">Tính năng</Link></li>
            <li><Link href="/pricing" className="hover:text-primary">Bảng giá</Link></li>
            <li><Link href="/demo" className="hover:text-primary">Xem trải nghiệm</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Hỗ trợ</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link href="/guide" className="hover:text-primary">Hướng dẫn</Link></li>
            <li><Link href="/blog" className="hover:text-primary">Blog</Link></li>
            <li><Link href="/register" className="hover:text-primary">Đăng ký dùng thử</Link></li>
            <li><Link href="/login" className="hover:text-primary">Đăng nhập</Link></li>
            <li><Link href="/contact" className="hover:text-primary">Liên hệ</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Pháp lý & liên hệ</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link href="/terms" className="hover:text-primary">Điều khoản sử dụng</Link></li>
            <li><Link href="/privacy" className="hover:text-primary">Chính sách bảo mật</Link></li>
            <li><a href={`mailto:${MARKETING_CONTACT.email}`} className="hover:text-primary">{MARKETING_CONTACT.email}</a></li>
            <li><a href={`tel:${MARKETING_CONTACT.phone.replace(/\s/g, "")}`} className="hover:text-primary">{MARKETING_CONTACT.phone}</a></li>
            <li>{MARKETING_CONTACT.address}</li>
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">{MARKETING_CONTACT.note}</p>
        </div>
      </div>
    </footer>
  );
}
