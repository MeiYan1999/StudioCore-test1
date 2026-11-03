import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/orders/print-button";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { INVOICE_STATUS_LABELS, type InvoiceStatus } from "@/lib/finance/constants";
import { getInvoiceDetail } from "@/lib/services/finance-service";
import { formatDate, formatVnd } from "@/lib/utils";

export const metadata = { title: "Hóa đơn" };

export default async function InvoicePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireActor();
  if (!hasPermission(actor.permissions, "finance.view")) {
    return <div className="p-8 text-sm">Bạn không có quyền xem hóa đơn.</div>;
  }
  const { id } = await params;
  let data;
  try {
    data = getInvoiceDetail(getDb(), actor, id);
  } catch {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 print:max-w-none print:px-0 print:py-0">
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost">
          <Link href="/manage/finance/invoices">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Quay lại hóa đơn
          </Link>
        </Button>
        <PrintButton label="In hóa đơn" />
      </div>
      <article className="space-y-5 text-slate-900">
        <header className="flex items-start justify-between gap-6 border-b-2 border-slate-900 pb-4">
          <div>
            <h1 className="text-xl font-bold uppercase">{data.studioName}</h1>
            <p className="text-sm">{data.branchAddress}</p>
            <p className="text-sm">MST: {data.studioTaxCode}</p>
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-bold uppercase">Hóa đơn</h2>
            <p className="font-mono text-sm">{data.invoice.invoiceNo}</p>
            <p className="text-sm">
              {INVOICE_STATUS_LABELS[data.invoice.status as InvoiceStatus] ??
                data.invoice.status}
            </p>
          </div>
        </header>

        <section className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <p className="font-semibold">Khách hàng</p>
            <p>{data.customerName ?? "—"}</p>
            <p>{data.customerPhone}</p>
            <p>{data.customerAddress ?? ""}</p>
          </div>
          <div>
            <p className="font-semibold">Thông tin</p>
            <p>Đơn hàng: {data.orderCode}</p>
            <p>Ngày phát hành: {data.invoice.issuedAt ? formatDate(data.invoice.issuedAt) : "—"}</p>
            <p>Chi nhánh: {data.branchName}</p>
          </div>
        </section>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-400 text-left">
              <th className="py-2">Nội dung</th>
              <th className="py-2 text-right">SL</th>
              <th className="py-2 text-right">Đơn giá</th>
              <th className="py-2 text-right">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, index) => (
              <tr key={index} className="border-b border-slate-200">
                <td className="py-2">{item.name}</td>
                <td className="py-2 text-right">{item.quantity}</td>
                <td className="py-2 text-right">{formatVnd(item.unitPrice)}</td>
                <td className="py-2 text-right">{formatVnd(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="ml-auto w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between">
            <span>Trước VAT</span>
            <span>{formatVnd(data.invoice.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>VAT {data.invoice.vatRate}%</span>
            <span>{formatVnd(data.invoice.vatAmount)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-400 pt-1 text-base font-bold">
            <span>Tổng cộng</span>
            <span>{formatVnd(data.invoice.total)}</span>
          </div>
        </section>

        {data.invoice.notes ? (
          <p className="text-sm text-slate-600">Ghi chú: {data.invoice.notes}</p>
        ) : null}
        <p className="text-xs text-slate-500">
          Hóa đơn demo phục vụ kiểm thử; không thay thế hóa đơn điện tử hợp pháp.
        </p>
      </article>
    </div>
  );
}
