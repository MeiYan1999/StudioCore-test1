import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/orders/print-button";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { PAYMENT_METHOD_LABELS } from "@/lib/orders/constants";
import { getOrderDetail } from "@/lib/services/order-service";
import { getTenantSettings } from "@/lib/services/settings-service";
import { formatDate, formatDateTime, formatVnd } from "@/lib/utils";

export const metadata = {
  title: "Phiếu thu",
};

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireActor();
  if (!hasPermission(actor.permissions, "orders.view")) {
    return <div className="p-8 text-sm">Bạn không có quyền xem phiếu thu.</div>;
  }

  const { id } = await params;
  const order = getOrderDetail(getDb(), actor, id);
  if (!order) {
    notFound();
  }

  const settings = getTenantSettings(getDb(), actor.tenantId);
  const studioName = settings["studio.name"] ?? actor.tenantName;
  const studioAddress = settings["studio.address"] ?? "";
  const studioPhone = settings["studio.phone"] ?? "";

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 print:max-w-none print:px-0 print:py-0">
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost">
          <Link href={`/manage/orders/${order.id}`}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Quay lại đơn hàng
          </Link>
        </Button>
        <PrintButton label="In phiếu thu" />
      </div>

      <article className="space-y-5 text-slate-900">
        <header className="border-b-2 border-slate-900 pb-4">
          <h1 className="text-xl font-bold uppercase">{studioName}</h1>
          <p className="text-sm">{studioAddress}</p>
          <p className="text-sm">{studioPhone}</p>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-2xl font-bold uppercase">Phiếu thu / Biên nhận</h2>
              <p className="text-sm">Mã đơn: {order.code}</p>
            </div>
            <p className="text-sm">Ngày in: {formatDate(new Date())}</p>
          </div>
        </header>

        <section className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <p className="font-semibold">Khách hàng</p>
            <p>{order.customer.name}</p>
            <p>Điện thoại: {order.customer.phone}</p>
            <p>{order.customer.address ?? "Chưa có địa chỉ"}</p>
          </div>
          <div>
            <p className="font-semibold">Đơn hàng</p>
            <p>Chi nhánh: {order.branchName}</p>
            <p>Lịch chụp: {order.scheduledAt ? formatDateTime(order.scheduledAt) : "Chưa chốt"}</p>
            <p>Tạo lúc: {formatDateTime(order.createdAt)}</p>
          </div>
        </section>

        <section>
          <h2 className="text-base font-bold uppercase">Các khoản thanh toán</h2>
          <table className="mt-2 w-full border-collapse text-sm">
            <thead>
              <tr className="border-y border-slate-400 bg-slate-100 text-left">
                <th className="py-2 pr-2">Thời điểm</th>
                <th className="px-2 py-2">Phương thức</th>
                <th className="px-2 py-2">Tham chiếu</th>
                <th className="pl-2 py-2 text-right">Số tiền</th>
              </tr>
            </thead>
            <tbody>
              {order.payments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-slate-500">
                    Chưa có thanh toán được ghi nhận.
                  </td>
                </tr>
              ) : (
                order.payments.map((payment) => (
                  <tr key={payment.id} className="border-b border-slate-200">
                    <td className="py-2 pr-2">{formatDateTime(payment.paidAt)}</td>
                    <td className="px-2 py-2">
                      {PAYMENT_METHOD_LABELS[payment.method] ?? payment.method}
                    </td>
                    <td className="px-2 py-2">{payment.reference ?? "—"}</td>
                    <td className="pl-2 py-2 text-right">{formatVnd(payment.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="mt-3 ml-auto max-w-sm space-y-1 text-sm">
            <div className="flex justify-between gap-8">
              <span>Tổng giá trị đơn</span>
              <span>{formatVnd(order.total)}</span>
            </div>
            <div className="flex justify-between gap-8">
              <span>Đã thu</span>
              <span>{formatVnd(order.paid)}</span>
            </div>
            <div className="flex justify-between gap-8 border-t border-slate-400 pt-1 font-bold">
              <span>Còn lại</span>
              <span>{formatVnd(order.remaining)}</span>
            </div>
          </div>
        </section>

        <section className="pt-4 text-sm">
          <p>
            Phiếu thu được tạo từ dữ liệu thanh toán thực tế trong StudioCore. Không có khoản
            thanh toán nào được ghi khống.
          </p>
          <p className="mt-2 text-xs text-slate-600">
            Hệ thống không tuyên bố đây là hóa đơn VAT hay chứng từ ký số hợp pháp.
          </p>
        </section>

        <footer className="grid gap-12 pt-8 text-center text-sm sm:grid-cols-2">
          <div>
            <p className="font-semibold">Người lập phiếu</p>
            <p className="mt-16 border-t border-slate-400 pt-2">Ký, ghi rõ họ tên</p>
          </div>
          <div>
            <p className="font-semibold">Khách hàng</p>
            <p className="mt-16 border-t border-slate-400 pt-2">Ký, ghi rõ họ tên</p>
          </div>
        </footer>
      </article>
    </div>
  );
}
