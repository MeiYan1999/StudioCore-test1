import Link from "next/link";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { Alert } from "@/components/ui/alert";
import { requireActor } from "@/lib/auth/session";

export const metadata = {
  title: "Đổi mật khẩu — StudioCore",
  robots: { index: false, follow: false },
};

export default async function ChangePasswordPage() {
  const actor = await requireActor();
  const backUrl = actor.role === "platform_admin" ? "/platform" : "/manage/dashboard";

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">Đổi mật khẩu</h1>
      {actor.canChangePassword ? (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            Sau khi đổi mật khẩu, bạn sẽ được đăng xuất trên tất cả thiết bị.
          </p>
          <div className="mt-6 rounded-xl border border-border bg-surface p-5 shadow-sm sm:p-6">
            <ChangePasswordForm />
          </div>
        </>
      ) : (
        <Alert tone="warning" className="mt-6">
          {actor.readOnly
            ? "Không thể đổi mật khẩu trong phiên demo chỉ xem."
            : "Tài khoản hoặc phiên đăng nhập hiện tại không hỗ trợ đổi mật khẩu."}
        </Alert>
      )}
      <Link href={backUrl} className="mt-4 inline-block text-sm text-primary hover:underline">
        Quay lại
      </Link>
    </div>
  );
}
