import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HouseholdLedger } from "@/components/finance/household-ledger";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getTaxReport } from "@/lib/services/report-service";
import { getTenantSettings } from "@/lib/services/settings-service";


export const metadata = { title: "Sổ doanh thu hộ kinh doanh" };

export default async function TaxPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; branchId?: string }>;
}) {
  const actor = await requireActor();
  if (!hasPermission(actor.permissions, "reports.view")) {
    return <div className="p-8 text-sm">Bạn không có quyền xem báo cáo thuế.</div>;
  }
  const params = await searchParams;
  const report = getTaxReport(getDb(), actor, params);
  const settings = getTenantSettings(getDb(), actor.tenantId);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 print:max-w-none print:px-0 print:py-0">
      <div className="no-print mb-5 flex items-center justify-between gap-3">
        <Button asChild variant="ghost">
          <Link href="/manage/reports">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Về báo cáo
          </Link>
        </Button>
      </div>
      <HouseholdLedger report={report} name={settings["studio.name"] ?? actor.tenantName}
        address={settings["studio.address"] ?? ""} taxCode={settings["studio.taxCode"] ?? ""}
        location={actor.branches.find(b=>b.id===(actor.activeBranchId??params.branchId))?.name ?? ""} />
    </div>
  );
}
