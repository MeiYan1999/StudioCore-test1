import Link from "next/link";
import { redirect } from "next/navigation";
import { getActorContext } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { DEMO_ACCOUNTS, DEMO_PLATFORM_ACCOUNT } from "@/lib/demo-accounts";
import { Alert } from "@/components/ui/alert";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Đăng nhập",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{
    error?: string;
    email?: string;
    code?: string;
    name?: string;
    message?: string;
  }>;
}) {
  const actor = await getActorContext();
  if (actor) {
    redirect(actor.role === "platform_admin" ? "/platform" : "/manage/dashboard");
  }

  const query = searchParams ? await searchParams : {};
  const isPinTab = query.error === "staff_pin_required" || Boolean(query.code);

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Chào mừng trở lại
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-8 text-foreground">
          Đăng nhập StudioCore
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Chủ Studio đăng nhập nhanh bằng Google hoặc Email; Nhân viên dùng Mã NV &amp; PIN để vào ca làm.
        </p>
      </div>

      {query.error === "google_not_configured" ? (
        <Alert tone="warning" className="mb-4">
          Tính năng Đăng nhập Google chưa được cấu hình. Vui lòng thêm{" "}
          <code className="font-mono text-xs">GOOGLE_CLIENT_ID</code> &amp;{" "}
          <code className="font-mono text-xs">GOOGLE_CLIENT_SECRET</code> trên Render
          hoặc đăng nhập bằng Email &amp; Mật khẩu bên dưới.
        </Alert>
      ) : null}

      {query.error === "user_not_found" ? (
        <Alert tone="warning" className="mb-4">
          <div className="space-y-1.5">
            <p>
              Không tìm thấy tài khoản Chủ Studio nào liên kết với email{" "}
              <strong>{query.email}</strong>.
            </p>
            <p className="text-xs">
              Nếu bạn là chủ studio mới, hãy{" "}
              <Link
                href={`/register?email=${encodeURIComponent(query.email || "")}`}
                className="font-semibold underline hover:text-foreground"
              >
                Đăng ký dùng thử 30 ngày tại đây
              </Link>
              .
            </p>
          </div>
        </Alert>
      ) : null}

      {query.error === "staff_pin_required" ? (
        <Alert tone="info" className="mb-4">
          Tài khoản {query.name ? <strong>{query.name} </strong> : null}(
          <code className="font-mono text-xs">{query.code}</code>) là Nhân viên
          studio. Vui lòng đăng nhập bằng Mã nhân viên &amp; PIN tại tab &quot;Nhân
          viên&quot;.
        </Alert>
      ) : null}

      {query.error === "account_disabled" ? (
        <Alert tone="danger" className="mb-4">
          Tài khoản hoặc Studio của bạn đã bị tạm khóa. Vui lòng liên hệ quản trị
          viên.
        </Alert>
      ) : null}

      {query.error === "invalid_state" ? (
        <Alert tone="warning" className="mb-4">
          Phiên xác thực Google đã hết hạn hoặc không hợp lệ. Vui lòng thử lại.
        </Alert>
      ) : null}

      {query.error === "google_cancelled" ? (
        <Alert tone="info" className="mb-4">
          Bạn đã hủy quá trình đăng nhập bằng Google.
        </Alert>
      ) : null}

      {query.error === "google_failed" ? (
        <Alert tone="danger" className="mb-4">
          Đăng nhập Google thất bại: {query.message || "Vui lòng thử lại."}
        </Alert>
      ) : null}

      <div className="rounded-xl border border-border bg-surface p-5 shadow-sm sm:p-6">
        <LoginForm
          initialTab={isPinTab ? "pin" : "owner"}
          initialCode={query.code ?? ""}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <Link href="/reset-password" className="text-primary hover:underline">
          Quên mật khẩu?
        </Link>
        <Link href="/register" className="text-primary hover:underline">
          Chưa có tài khoản? Đăng ký dùng thử
        </Link>
      </div>

      {process.env.NODE_ENV !== "production" ? (
        <details className="mt-5 rounded-xl border border-dashed border-border bg-surface p-4 text-sm">
          <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
            Tài khoản kiểm thử nhanh (Developer Helper)
          </summary>
          <div className="mt-3 space-y-3">
            <p className="text-xs text-muted-foreground">
              Chủ studio: Mật khẩu <span className="font-mono">Demo@123</span> hoặc
              Google OAuth. Nhân viên: Mã &amp; PIN ở tab “Nhân viên”.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="py-1.5 pr-3 font-medium">Vai trò</th>
                    <th className="py-1.5 pr-3 font-medium">Email</th>
                    <th className="py-1.5 pr-3 font-medium">Mã</th>
                    <th className="py-1.5 font-medium">PIN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[...DEMO_ACCOUNTS, DEMO_PLATFORM_ACCOUNT].map((account) => (
                    <tr key={account.code}>
                      <td className="py-2 pr-3 text-foreground">
                        {ROLE_LABELS[account.role]}
                      </td>
                      <td className="py-2 pr-3 font-mono text-[11px] text-muted-foreground">
                        {account.email}
                      </td>
                      <td className="py-2 pr-3 font-mono text-[11px] text-muted-foreground">
                        {account.code}
                      </td>
                      <td className="py-2 font-mono text-[11px] text-muted-foreground">
                        {account.pin}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </details>
      ) : null}

      <p className="mt-5 text-center text-xs text-muted-foreground">
        StudioCore · Nền tảng quản lý studio chuyên nghiệp
      </p>
    </div>
  );
}
