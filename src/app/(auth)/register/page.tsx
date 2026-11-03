import Link from "next/link";
import { redirect } from "next/navigation";
import { getActorContext } from "@/lib/auth/session";
import { RegisterForm } from "@/components/auth/register-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Đăng ký dùng thử",
  description:
    "Tạo studio demo trên StudioCore: quản lý khách, đơn, lịch chụp, album và tài chính.",
  robots: { index: true, follow: true },
};

export default async function RegisterPage() {
  const actor = await getActorContext();
  if (actor) {
    redirect("/manage/dashboard");
  }
  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Bắt đầu trong vài phút
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-8 text-foreground">
          Đăng ký dùng thử StudioCore
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tạo tenant, chi nhánh đầu tiên và tài khoản owner thật trong một giao
          dịch. Gói trial, không cần thẻ.
        </p>
      </div>
      <div className="rounded-xl border border-border bg-surface p-5 shadow-sm sm:p-6">
        <RegisterForm />
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        Bằng việc đăng ký, dữ liệu demo được tạo trong môi trường local của bạn.{" "}
        <Link href="/" className="text-primary hover:underline">
          Về trang chủ
        </Link>
      </p>
    </div>
  );
}
