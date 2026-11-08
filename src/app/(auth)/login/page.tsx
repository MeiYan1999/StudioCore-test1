import Link from "next/link";
import { redirect } from "next/navigation";
import { getActorContext } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { DEMO_ACCOUNTS, DEMO_PLATFORM_ACCOUNT } from "@/lib/demo-accounts";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Đăng nhập",
};

export default async function LoginPage() {
  const actor = await getActorContext();
  if (actor) {
    redirect(actor.role === "platform_admin" ? "/platform" : "/manage/dashboard");
  }

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
          Dùng email và mật khẩu cho quản trị/kế toán, hoặc mã nhân viên và PIN
          để vào nhanh.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface p-5 shadow-sm sm:p-6">
        <LoginForm />
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
              Mật khẩu: <span className="font-mono">Demo@123</span>. PIN dùng
              ở tab “Mã nhân viên &amp; PIN”.
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
