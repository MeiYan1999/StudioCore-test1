import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/orders/print-button";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getTaxReport } from "@/lib/services/report-service";
import { getTenantSettings } from "@/lib/services/settings-service";
import { formatDate, formatVnd } from "@/lib/utils";

export const metadata = { title: "Báo cáo thuế demo" };

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
        <PrintButton label="In báo cáo thuế" />
      </div>
      <article className="space-y-4 text-slate-900">
        <header className="border-b-2 border-slate-900 pb-3">
          <h1 className="text-xl font-bold uppercase">
            {settings["studio.name"] ?? actor.tenantName}
          </h1>
          <p className="text-sm">MST: {settings["studio.taxCode"] ?? "Chưa cấu hình"}</p>
          <h2 className="mt-3 text-lg font-semibold">
            Báo cáo thuế GTGT mức demo
          </h2>
          <p className="text-sm">
            Kỳ {report.from} → {report.to} · Ngày in {formatDate(new Date())}
          </p>
        </header>
        <section className="grid grid-cols-3 gap-3 text-sm">
          <div className="rounded border border-slate-300 p-2">
            <p>Doanh thu trước VAT</p>
            <p className="font-semibold">{formatVnd(report.subtotal)}</p>
          </div>
          <div className="rounded border border-slate-300 p-2">
            <p>VAT đầu ra</p>
            <p className="font-semibold">{formatVnd(report.vatAmount)}</p>
          </div>
          <div className="rounded border border-slate-300 p-2">
            <p>Tổng hóa đơn</p>
            <p className="font-semibold">{formatVnd(report.total)}</p>
          </div>
        </section>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-400 text-left">
              <th className="py-2">Hóa đơn</th>
              <th className="py-2">Đơn</th>
              <th className="py-2">Khách</th>
              <th className="py-2 text-right">Trước VAT</th>
              <th className="py-2 text-right">VAT</th>
              <th className="py-2 text-right">Tổng</th>
              <th className="py-2">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => (
              <tr key={row.invoiceNo} className="border-b border-slate-200">
                <td className="py-1.5 font-mono">{row.invoiceNo}</td>
                <td className="py-1.5">{row.orderCode}</td>
                <td className="py-1.5">{row.customerName ?? "—"}</td>
                <td className="py-1.5 text-right">{formatVnd(row.subtotal)}</td>
                <td className="py-1.5 text-right">{formatVnd(row.vatAmount)}</td>
                <td className="py-1.5 text-right">{formatVnd(row.total)}</td>
                <td className="py-1.5">{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-slate-500">
          Báo cáo thuế mức demo, dùng để đối soát nội bộ; không phải tờ khai thuế
          điện tử hợp pháp.
        </p>
      </article>
    </div>
  );
}
