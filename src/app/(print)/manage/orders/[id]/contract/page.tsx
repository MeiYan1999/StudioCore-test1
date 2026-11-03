import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { confirmContractAction } from "@/lib/actions/order-actions";
import { PrintButton } from "@/components/orders/print-button";
import { SubmitButton } from "@/components/shared/submit-button";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getOrderDetail } from "@/lib/services/order-service";
import { getTenantSettings } from "@/lib/services/settings-service";
import { formatDate, formatDateTime, formatVnd } from "@/lib/utils";

export const metadata = {
  title: "Hợp đồng dịch vụ",
};

export default async function ContractPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ confirmed?: string; error?: string }>;
}) {
  const actor = await requireActor();
  if (!hasPermission(actor.permissions, "orders.view")) {
    return <div className="p-8 text-sm">Bạn không có quyền xem hợp đồng.</div>;
  }

  const { id } = await params;
  const query = await searchParams;
  const order = getOrderDetail(getDb(), actor, id);
  if (!order) {
    notFound();
  }

  const settings = getTenantSettings(getDb(), actor.tenantId);
  const canConfirm = hasPermission(actor.permissions, "orders.manage");
  const studioName = settings["studio.name"] ?? actor.tenantName;
  const studioAddress = settings["studio.address"] ?? "";
  const studioPhone = settings["studio.phone"] ?? "";
  const studioEmail = settings["studio.email"] ?? "";
  const taxCode = settings["studio.taxCode"] ?? "";
  const bankName = settings["payment.bankName"] ?? "";
  const bankAccount = settings["payment.bankAccountNumber"] ?? "";
  const bankHolder = settings["payment.bankAccountName"] ?? "";

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 print:max-w-none print:px-0 print:py-0">
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost">
          <Link href={`/manage/orders/${order.id}`}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Quay lại đơn hàng
          </Link>
        </Button>
        <div className="flex gap-2">
          <PrintButton label="In hợp đồng" />
          {!order.contractConfirmedAt && canConfirm ? (
            <form action={confirmContractAction}>
              <input type="hidden" name="orderId" value={order.id} />
              <SubmitButton pendingLabel="Đang xác nhận...">
                Xác nhận nội bộ
              </SubmitButton>
            </form>
          ) : null}
        </div>
      </div>

      {query.confirmed ? (
        <Alert tone="success" className="no-print mb-4">
          Đã xác nhận hợp đồng nội bộ và ghi audit.
        </Alert>
      ) : null}
      {query.error ? (
        <Alert tone="danger" className="no-print mb-4">
          {query.error}
        </Alert>
      ) : null}

      <article className="space-y-6 leading-6 text-slate-900">
        <header className="border-b-2 border-slate-900 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold uppercase">{studioName}</h1>
              <p className="mt-1 text-sm">{studioAddress}</p>
              <p className="text-sm">
                {studioPhone} {studioEmail ? `· ${studioEmail}` : ""}
              </p>
              {taxCode ? <p className="text-sm">MST: {taxCode}</p> : null}
            </div>
            <div className="text-right text-sm">
              <p className="font-semibold">HỢP ĐỒNG DỊCH VỤ CHỤP ẢNH</p>
              <p>Mã đơn: {order.code}</p>
              <p>Ngày lập: {formatDate(order.createdAt)}</p>
            </div>
          </div>
        </header>

        <section>
          <h2 className="text-base font-bold uppercase">Thông tin các bên</h2>
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="font-semibold">Bên cung cấp dịch vụ</p>
              <p>{studioName}</p>
              <p>{studioAddress}</p>
              <p>Điện thoại: {studioPhone}</p>
            </div>
            <div>
              <p className="font-semibold">Bên sử dụng dịch vụ</p>
              <p>{order.customer.name}</p>
              <p>Điện thoại: {order.customer.phone}</p>
              <p>{order.customer.email ?? "Chưa có email"}</p>
              <p>{order.customer.address ?? "Chưa có địa chỉ"}</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-base font-bold uppercase">Nội dung dịch vụ</h2>
          <table className="mt-2 w-full border-collapse text-sm">
            <thead>
              <tr className="border-y border-slate-400 bg-slate-100 text-left">
                <th className="py-2 pr-2">Nội dung</th>
                <th className="px-2 py-2 text-right">SL</th>
                <th className="px-2 py-2 text-right">Đơn giá</th>
                <th className="pl-2 py-2 text-right">Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id} className="border-b border-slate-200">
                  <td className="py-2 pr-2">{item.name}</td>
                  <td className="px-2 py-2 text-right">{item.quantity}</td>
                  <td className="px-2 py-2 text-right">{formatVnd(item.unitPrice)}</td>
                  <td className="pl-2 py-2 text-right">{formatVnd(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-3 ml-auto max-w-sm space-y-1 text-sm">
            <div className="flex justify-between gap-8">
              <span>Tạm tính</span>
              <span>{formatVnd(order.subtotal)}</span>
            </div>
            <div className="flex justify-between gap-8">
              <span>Phụ thu</span>
              <span>{formatVnd(order.surcharge)}</span>
            </div>
            <div className="flex justify-between gap-8">
              <span>Giảm giá</span>
              <span>{formatVnd(order.discount)}</span>
            </div>
            <div className="flex justify-between gap-8">
              <span>Voucher {order.voucherCode ? `(${order.voucherCode})` : ""}</span>
              <span>{formatVnd(order.voucherDiscount)}</span>
            </div>
            <div className="flex justify-between gap-8 border-t border-slate-400 pt-1 font-bold">
              <span>Tổng giá trị</span>
              <span>{formatVnd(order.total)}</span>
            </div>
            <div className="flex justify-between gap-8">
              <span>Đã thu</span>
              <span>{formatVnd(order.paid)}</span>
            </div>
            <div className="flex justify-between gap-8 font-semibold">
              <span>Còn lại</span>
              <span>{formatVnd(order.remaining)}</span>
            </div>
          </div>
        </section>

        <section className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <h2 className="text-base font-bold uppercase">Lịch &amp; địa điểm</h2>
            <p>Lịch chụp: {order.scheduledAt ? formatDateTime(order.scheduledAt) : "Chưa chốt"}</p>
            <p>Địa điểm: {order.location ?? "Chưa có"}</p>
            <p>Chi nhánh: {order.branchName}</p>
          </div>
          <div>
            <h2 className="text-base font-bold uppercase">Thanh toán</h2>
            {bankName ? <p>Ngân hàng: {bankName}</p> : null}
            {bankAccount ? <p>Số tài khoản: {bankAccount}</p> : null}
            {bankHolder ? <p>Chủ tài khoản: {bankHolder}</p> : null}
            {!bankName && !bankAccount ? <p>Thông tin ngân hàng chưa được cấu hình.</p> : null}
          </div>
        </section>

        <section className="text-sm">
          <h2 className="text-base font-bold uppercase">Điều khoản cơ bản</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Thời gian giao ảnh và số lượng ảnh chỉnh sửa theo gói dịch vụ hai bên đã thống nhất.</li>
            <li>Khách hàng thanh toán cọc theo thỏa thuận; phần còn lại thanh toán khi nhận ảnh hoặc theo kế hoạch thanh toán.</li>
            <li>Thời gian, địa điểm và nhân sự thực hiện có thể thay đổi nếu hai bên xác nhận lại.</li>
            <li>Hợp đồng này được xác nhận điện tử nội bộ trong StudioCore, không phải chữ ký số hợp pháp theo quy định CA.</li>
          </ol>
        </section>

        <section className="border-t border-slate-400 pt-4 text-sm">
          <p>
            Trạng thái xác nhận:{" "}
            <strong>
              {order.contractConfirmedAt
                ? `Đã xác nhận nội bộ bởi ${order.contractConfirmedBy ?? "nhân sự"} lúc ${formatDateTime(order.contractConfirmedAt)}`
                : "Chưa xác nhận nội bộ"}
            </strong>
          </p>
          {!order.contractConfirmedAt && canConfirm ? (
            <p className="no-print mt-2 text-xs text-slate-600">
              Dùng nút “Xác nhận nội bộ” phía trên để ghi nhận xác nhận và audit. Sau đó có thể in hợp đồng.
            </p>
          ) : null}
        </section>

        <footer className="grid gap-12 pt-8 text-center text-sm sm:grid-cols-2">
          <div>
            <p className="font-semibold">Đại diện studio</p>
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
