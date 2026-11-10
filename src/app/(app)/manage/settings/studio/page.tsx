import Link from "next/link";
import { ArrowLeft, Building2, CalendarClock, Percent, ShieldCheck, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { ForbiddenState } from "@/components/shared/forbidden-state";
import { StudioSettingsForm } from "@/components/settings/studio-settings-form";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getTenantSettings } from "@/lib/services/settings-service";

export const dynamic = "force-dynamic";

export const metadata = { title: "Cài đặt studio" };

export default async function StudioSettingsPage() {
  const actor = await requireActor();
  if (!hasPermission(actor.permissions, "settings.manage")) {
    return <ForbiddenState description="Chỉ chủ studio được sửa cấu hình studio." />;
  }
  const settings = getTenantSettings(getDb(), actor.tenantId);

  return (
    <div>
      <PageHeader
        title="Cài đặt studio"
        description="Thông tin studio, ngân hàng/VietQR, giờ làm và mẫu thông báo. Các mục khác liên kết bên dưới."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/manage/settings">
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Cài đặt
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/manage/settings/branches">
                <Building2 className="h-4 w-4" aria-hidden />
                Chi nhánh
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/manage/settings/users">
                <Users className="h-4 w-4" aria-hidden />
                Người dùng
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/manage/settings/roles">
                <ShieldCheck className="h-4 w-4" aria-hidden />
                Quyền
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/manage/settings/payments/sandbox">
                <Percent className="h-4 w-4" aria-hidden />
                Sandbox
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/manage/settings/ai">
                <Sparkles className="h-4 w-4" aria-hidden />
                AI Hub
              </Link>
            </Button>
          </>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <StudioSettingsForm settings={settings} />
        <aside className="space-y-4">
          <section className="rounded-xl border border-border bg-surface p-4 text-sm">
            <h2 className="text-base font-semibold">Danh mục liên quan</h2>
            <ul className="mt-2 space-y-2">
              <li>
                <Link href="/manage/settings/rooms" className="flex items-center gap-2 text-primary hover:underline">
                  <Building2 className="h-4 w-4" aria-hidden /> Phòng chụp
                </Link>
              </li>
              <li>
                <Link href="/manage/services" className="flex items-center gap-2 text-primary hover:underline">
                  <CalendarClock className="h-4 w-4" aria-hidden /> Dịch vụ
                </Link>
              </li>
              <li>
                <Link href="/manage/vouchers" className="flex items-center gap-2 text-primary hover:underline">
                  <Percent className="h-4 w-4" aria-hidden /> Voucher
                </Link>
              </li>
              <li>
                <Link href="/manage/settings/integrations" className="flex items-center gap-2 text-primary hover:underline">
                  <Sparkles className="h-4 w-4" aria-hidden /> Tích hợp Drive/AI/Payment
                </Link>
              </li>
              <li>
                <Link href="/manage/activity-log" className="flex items-center gap-2 text-primary hover:underline">
                  <ShieldCheck className="h-4 w-4" aria-hidden /> Nhật ký hoạt động
                </Link>
              </li>
            </ul>
          </section>
          <section className="rounded-xl border border-border bg-surface p-4 text-xs text-muted-foreground">
            <h2 className="text-base font-semibold text-foreground">Thanh toán VietQR</h2>
            <p className="mt-2">
              Vui lòng cấu hình đúng số tài khoản ngân hàng và mã BIN ngân hàng của studio để mã VietQR trên hợp đồng và hóa đơn thanh toán chuẩn xác.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
