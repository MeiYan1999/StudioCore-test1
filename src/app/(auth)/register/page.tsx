import Link from "next/link";
import { redirect } from "next/navigation";
import { getActorContext } from "@/lib/auth/session";
import { RegisterForm } from "@/components/auth/register-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Đăng ký dùng thử 30 ngày — StudioCore",
  description:
    "Đăng ký tài khoản StudioCore — Trải nghiệm miễn phí 30 ngày giải pháp quản lý Studio ảnh cưới & sự kiện chuyên nghiệp.",
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
          Bắt đầu trong 30 giây
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-8 text-foreground">
          Đăng ký dùng thử StudioCore
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Khởi tạo studio, thiết lập chi nhánh đầu tiên và bắt đầu dùng thử 30 ngày miễn phí. Không cần thẻ tín dụng.
        </p>
      </div>
      <div className="rounded-xl border border-border bg-surface p-5 shadow-sm sm:p-6">
        <RegisterForm />
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        Bằng việc đăng ký, bạn đồng ý với{" "}
        <Link href="/terms" className="text-primary hover:underline">
          Điều khoản
        </Link>{" "}
        &amp;{" "}
        <Link href="/privacy" className="text-primary hover:underline">
          Chính sách bảo mật
        </Link>{" "}
        của StudioCore.{" "}
        <Link href="/" className="text-primary hover:underline">
          Về trang chủ
        </Link>
      </p>
    </div>
  );
}
