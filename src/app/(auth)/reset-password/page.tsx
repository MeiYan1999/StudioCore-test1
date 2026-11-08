import Link from "next/link";
import { ResetPasswordForm, ResetRequestForm } from "@/components/auth/reset-forms";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Đặt lại mật khẩu — StudioCore",
  description: "Khôi phục mật khẩu tài khoản quản trị và nhân sự StudioCore.",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params.token ?? "";
  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Khôi phục truy cập
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-8 text-foreground">
          {token ? "Đặt lại mật khẩu" : "Quên mật khẩu"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {token
            ? "Token chỉ dùng một lần, hết hạn sau 30 phút và sẽ thu hồi các phiên đăng nhập cũ."
            : "Nhập email tài khoản đã đăng ký để nhận liên kết khôi phục mật khẩu an toàn."}
        </p>
      </div>
      <div className="rounded-xl border border-border bg-surface p-5 shadow-sm sm:p-6">
        {token ? <ResetPasswordForm token={token} /> : <ResetRequestForm />}
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        <Link href="/" className="text-primary hover:underline">
          Về trang chủ
        </Link>
        {" · "}
        <Link href="/login" className="text-primary hover:underline">
          Đăng nhập
        </Link>
      </p>
    </div>
  );
}
