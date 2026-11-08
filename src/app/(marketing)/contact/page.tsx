import Link from "next/link";
import { ContactForm } from "@/components/marketing/contact-form";
import { MARKETING_CONTACT } from "@/lib/marketing/content";
import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "Liên hệ tư vấn StudioCore",
  description:
    "Gửi yêu cầu tư vấn StudioCore: quản lý studio, CRM, lịch chụp, PhotoShare và tài chính. Form lưu yêu cầu trong hệ thống demo.",
  path: "/contact",
});

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const params = await searchParams;
  const plan = ["basic", "pro", "business"].includes(params.plan ?? "")
    ? params.plan
    : "";
  return (
    <>
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-[1240px] px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Liên hệ</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Liên hệ tư vấn giải pháp Studio.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
            Cho StudioCore biết quy mô studio, số chi nhánh và nhu cầu vận hành của bạn.
            Chuyên viên tư vấn sẽ liên hệ lại nhanh chóng để hỗ trợ tư vấn và demo giải pháp.
          </p>
        </div>
      </section>
      <div className="mx-auto grid max-w-[1240px] gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:px-8">
        <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <h2 className="text-xl font-semibold">Gửi yêu cầu tư vấn</h2>
          {plan ? (
            <p className="mt-2 rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">
              Bạn đang quan tâm gói <strong>{plan}</strong>.
            </p>
          ) : null}
          <div className="mt-4">
            <ContactForm source={plan ? `pricing-${plan}` : "contact"} />
          </div>
        </section>
        <aside className="space-y-4">
          <section className="rounded-xl border border-border bg-surface p-5 text-sm">
            <h2 className="text-lg font-semibold">Kênh hỗ trợ trực tiếp</h2>
            <dl className="mt-3 space-y-2 text-muted-foreground">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide">Hotline / Zalo</dt>
                <dd><a href={`tel:${MARKETING_CONTACT.phone.replace(/\s/g, "")}`} className="text-base font-semibold text-primary hover:underline">{MARKETING_CONTACT.phone}</a></dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide">Email</dt>
                <dd><a href={`mailto:${MARKETING_CONTACT.email}`} className="text-primary hover:underline">{MARKETING_CONTACT.email}</a></dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide">Địa chỉ</dt>
                <dd>{MARKETING_CONTACT.address}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">{MARKETING_CONTACT.note}</p>
          </section>
          <section className="rounded-xl border border-border bg-surface p-5 text-sm">
            <h2 className="text-lg font-semibold">Tự xem trước</h2>
            <p className="mt-2 text-muted-foreground">
              Demo read-only mở dashboard với dữ liệu synthetic; mọi thao tác ghi
              bị chặn ở server. Đăng ký để tạo tenant riêng.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/demo" className="font-medium text-primary hover:underline">Mở demo</Link>
              <Link href="/register" className="font-medium text-primary hover:underline">Đăng ký</Link>
              <Link href="/guide" className="font-medium text-primary hover:underline">Hướng dẫn</Link>
            </div>
          </section>
          <section className="rounded-xl border border-border bg-surface p-5 text-sm text-muted-foreground">
            <h2 className="text-lg font-semibold text-foreground">Bảo mật dữ liệu</h2>
            <p className="mt-2">
              Không nhập PII thật vào bản demo. Dữ liệu trong seed là hư cấu; ảnh
              demo là synthetic có nhãn. Xem thêm{" "}
              <Link href="/privacy" className="text-primary hover:underline">chính sách bảo mật</Link>.
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
