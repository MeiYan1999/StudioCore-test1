import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { ChevronRight, FileText, Printer, ReceiptText } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { DateTimeText } from "@/components/shared/date-time";
import { ForbiddenState } from "@/components/shared/forbidden-state";
import { Money } from "@/components/shared/money";
import { CancelOrderDialog, OrderStatusForm } from "@/components/orders/order-status";
import { PaymentSheet } from "@/components/orders/payment-sheet";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import {
  albums,
  invoices,
  tasks,
  transactions,
} from "@/lib/db/schema";
import {
  ORDER_ITEM_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/orders/constants";
import {
  ORDER_STATUS_META,
  isOrderStatus,
  nextOrderStatuses,
} from "@/lib/orders/status";
import {
  canRecordPayment,
  getOrderDetail,
} from "@/lib/services/order-service";
import { formatDateTime } from "@/lib/utils";

export const metadata = {
  title: "Chi tiết đơn hàng",
};

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; statusUpdated?: string; payment?: string }>;
}) {
  const actor = await requireActor();

  if (!hasPermission(actor.permissions, "orders.view")) {
    return <ForbiddenState description="Vai trò của bạn không có quyền xem đơn hàng." />;
  }

  const { id } = await params;
  const messages = await searchParams;
  const db = getDb();
  const order = getOrderDetail(db, actor, id);

  if (!order) {
    notFound();
  }

  const linkedAlbums = db
    .select({ id: albums.id, title: albums.title, status: albums.status })
    .from(albums)
    .where(and(eq(albums.orderId, order.id), eq(albums.tenantId, actor.tenantId)))
    .all();
  const linkedTasks = db
    .select({ id: tasks.id, title: tasks.title, status: tasks.status })
    .from(tasks)
    .where(and(eq(tasks.orderId, order.id), eq(tasks.tenantId, actor.tenantId)))
    .all();
  const linkedInvoices = hasPermission(actor.permissions, "finance.view")
    ? db
        .select({ id: invoices.id, invoiceNo: invoices.invoiceNo, status: invoices.status })
        .from(invoices)
        .where(and(eq(invoices.orderId, order.id), eq(invoices.tenantId, actor.tenantId)))
        .all()
    : [];
  const linkedTransactions = hasPermission(actor.permissions, "finance.view")
    ? db
        .select({
          id: transactions.id,
          type: transactions.type,
          amount: transactions.amount,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.orderId, order.id),
            eq(transactions.tenantId, actor.tenantId),
          ),
        )
        .orderBy(desc(transactions.occurredAt))
        .limit(5)
        .all()
    : [];

  const canManage = hasPermission(actor.permissions, "orders.manage");
  const canPay = canRecordPayment(actor);
  const transitions = nextOrderStatuses(order.status);
  const normalTransitions = transitions.filter((status) => status !== "cancelled");
  const canCancel = transitions.includes("cancelled");
  const statusMeta = isOrderStatus(order.status)
    ? ORDER_STATUS_META[order.status]
    : { label: order.status, tone: "neutral" as const };

  return (
    <div>
      <PageHeader
        title={order.code}
        description={`${order.customer.name} · ${order.branchName} · Tạo ${formatDateTime(order.createdAt)}`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`/manage/orders/${order.id}/contract`}>
                <FileText className="h-4 w-4" aria-hidden="true" />
                Hợp đồng
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/manage/orders/${order.id}/receipt`}>
                <ReceiptText className="h-4 w-4" aria-hidden="true" />
                Phiếu thu
              </Link>
            </Button>
          </>
        }
      />

      {messages.error ? (
        <Alert tone="danger" className="mb-4">{messages.error}</Alert>
      ) : null}
      {messages.statusUpdated ? (
        <Alert tone="success" className="mb-4">Đã cập nhật trạng thái đơn hàng.</Alert>
      ) : null}
      {messages.payment ? (
        <Alert tone="success" className="mb-4">Đã ghi nhận thanh toán.</Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.55fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Thông tin đơn hàng</CardTitle>
              <CardDescription>Thông tin sản xuất, phân công và ghi chú.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Khách hàng</p>
                <Link
                  href={`/manage/customers/${order.customer.id}`}
                  className="mt-1 block font-medium text-foreground hover:text-primary"
                >
                  {order.customer.name}
                </Link>
                <p className="text-sm tabular-nums text-muted-foreground">
                  {order.customer.phone}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Chi nhánh</p>
                <p className="mt-1 text-sm font-medium text-foreground">{order.branchName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Lịch chụp</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <DateTimeText value={order.scheduledAt} />
                  {order.scheduleOverdue ? (
                    <Badge tone="danger">Lịch đã qua</Badge>
                  ) : null}
                  {order.upcoming ? <Badge tone="warning">Sắp tới</Badge> : null}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Địa điểm</p>
                <p className="mt-1 text-sm text-foreground">{order.location ?? "Chưa có"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Photographer</p>
                <p className="mt-1 text-sm text-foreground">{order.photographer?.name ?? "Chưa phân công"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Retoucher / Editor</p>
                <p className="mt-1 text-sm text-foreground">{order.editor?.name ?? "Chưa phân công"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Makeup</p>
                <p className="mt-1 text-sm text-foreground">{order.makeup?.name ?? "Chưa phân công"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Người tạo</p>
                <p className="mt-1 text-sm text-foreground">{order.createdByName ?? "Không xác định"}</p>
              </div>
              {order.notes ? (
                <div className="sm:col-span-2">
                  <p className="text-xs text-muted-foreground">Ghi chú</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{order.notes}</p>
                </div>
              ) : null}
              {order.cancelReason ? (
                <div className="sm:col-span-2 rounded-lg bg-red-50 p-3 text-sm text-[var(--danger)] dark:bg-red-950/30">
                  <p className="font-medium">Lý do hủy</p>
                  <p className="mt-1">{order.cancelReason}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dịch vụ &amp; sản phẩm</CardTitle>
              <CardDescription>Giá được chốt tại thời điểm tạo đơn.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-surface-muted text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-3 py-2 text-left">Item</th>
                      <th scope="col" className="px-3 py-2 text-right">SL</th>
                      <th scope="col" className="px-3 py-2 text-right">Đơn giá</th>
                      <th scope="col" className="px-3 py-2 text-right">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {order.items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-3 py-2">
                          <p className="font-medium text-foreground">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {ORDER_ITEM_TYPE_LABELS[item.itemType] ?? item.itemType}
                          </p>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{item.quantity}</td>
                        <td className="px-3 py-2 text-right"><Money value={item.unitPrice} /></td>
                        <td className="px-3 py-2 text-right"><Money value={item.total} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <dl className="mt-4 ml-auto max-w-sm space-y-1.5 text-sm">
                <div className="flex justify-between gap-8">
                  <dt className="text-muted-foreground">Tạm tính</dt>
                  <dd><Money value={order.subtotal} /></dd>
                </div>
                <div className="flex justify-between gap-8">
                  <dt className="text-muted-foreground">Phụ thu</dt>
                  <dd><Money value={order.surcharge} /></dd>
                </div>
                <div className="flex justify-between gap-8">
                  <dt className="text-muted-foreground">Giảm giá</dt>
                  <dd><Money value={order.discount} /></dd>
                </div>
                <div className="flex justify-between gap-8">
                  <dt className="text-muted-foreground">Voucher {order.voucherCode ? `(${order.voucherCode})` : ""}</dt>
                  <dd><Money value={order.voucherDiscount} /></dd>
                </div>
                <div className="flex justify-between gap-8 border-t border-border pt-2 text-base font-semibold">
                  <dt>Tổng cộng</dt>
                  <dd><Money value={order.total} /></dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div>
                <CardTitle>Thanh toán</CardTitle>
                <CardDescription>Theo dõi cọc, đã thu và công nợ còn lại.</CardDescription>
              </div>
              {canPay && order.remaining > 0 && order.status !== "cancelled" ? (
                <PaymentSheet orderId={order.id} remaining={order.remaining} />
              ) : null}
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-surface-muted p-3">
                  <p className="text-xs text-muted-foreground">Tổng đơn</p>
                  <p className="mt-1 text-lg font-semibold"><Money value={order.total} /></p>
                </div>
                <div className="rounded-lg bg-surface-muted p-3">
                  <p className="text-xs text-muted-foreground">Đã thu</p>
                  <p className="mt-1 text-lg font-semibold"><Money value={order.paid} /></p>
                </div>
                <div className="rounded-lg bg-surface-muted p-3">
                  <p className="text-xs text-muted-foreground">Còn lại</p>
                  <p className="mt-1 text-lg font-semibold text-[var(--warning)]">
                    <Money value={order.remaining} />
                  </p>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-surface-muted text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-3 py-2 text-left">Thời điểm</th>
                      <th scope="col" className="px-3 py-2 text-left">Phương thức</th>
                      <th scope="col" className="px-3 py-2 text-left">Tham chiếu</th>
                      <th scope="col" className="px-3 py-2 text-left">Người ghi</th>
                      <th scope="col" className="px-3 py-2 text-right">Số tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {order.payments.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-sm text-muted-foreground">
                          Chưa ghi nhận thanh toán.
                        </td>
                      </tr>
                    ) : (
                      order.payments.map((payment) => (
                        <tr key={payment.id}>
                          <td className="px-3 py-2"><DateTimeText value={payment.paidAt} /></td>
                          <td className="px-3 py-2">{PAYMENT_METHOD_LABELS[payment.method] ?? payment.method}</td>
                          <td className="px-3 py-2 text-muted-foreground">{payment.reference ?? "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{payment.createdByName ?? "—"}</td>
                          <td className="px-3 py-2 text-right"><Money value={payment.amount} /></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline trạng thái</CardTitle>
              <CardDescription>Ai đổi, khi nào và ghi chú.</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-4 border-l border-border pl-5">
                {order.history.map((entry) => (
                  <li key={entry.id} className="relative">
                    <span className="absolute -left-[1.42rem] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={ORDER_STATUS_META[entry.toStatus].tone}>
                        {ORDER_STATUS_META[entry.toStatus].label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(entry.createdAt)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {entry.changedByName ?? "Hệ thống"}
                      </span>
                    </div>
                    {entry.note ? (
                      <p className="mt-1 text-sm text-foreground">{entry.note}</p>
                    ) : null}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Trạng thái</CardTitle>
              <CardDescription>Cập nhật trạng thái sản xuất có kiểm tra transition.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                {order.remaining > 0 ? <Badge tone="warning">Còn công nợ</Badge> : null}
                {order.scheduleOverdue ? <Badge tone="danger">Lịch đã qua</Badge> : null}
                {order.upcoming ? <Badge tone="warning">Sắp tới</Badge> : null}
              </div>
              {canManage ? (
                <>
                  <OrderStatusForm
                    orderId={order.id}
                    nextStatuses={normalTransitions}
                  />
                  {canCancel ? <CancelOrderDialog orderId={order.id} /> : null}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Bạn chỉ có quyền xem trạng thái đơn hàng.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Khách hàng</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Link
                href={`/manage/customers/${order.customer.id}`}
                className="font-medium text-foreground hover:text-primary"
              >
                {order.customer.name}
              </Link>
              <p className="tabular-nums text-muted-foreground">{order.customer.phone}</p>
              <p className="text-muted-foreground">{order.customer.email ?? "Chưa có email"}</p>
              <p className="text-muted-foreground">{order.customer.address ?? "Chưa có địa chỉ"}</p>
              <Button asChild variant="outline" size="sm" className="mt-2">
                <Link href={`/manage/customers/${order.customer.id}`}>
                  Mở hồ sơ khách
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Hợp đồng &amp; phiếu thu</CardTitle>
              <CardDescription>In bằng trình duyệt; xác nhận hợp đồng nội bộ.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                {order.contractConfirmedAt
                  ? `Đã xác nhận nội bộ bởi ${order.contractConfirmedBy ?? "nhân sự"} lúc ${formatDateTime(order.contractConfirmedAt)}.`
                  : "Hợp đồng chưa được xác nhận nội bộ."}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/manage/orders/${order.id}/contract`}>
                    <Printer className="h-4 w-4" aria-hidden="true" />
                    In hợp đồng
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/manage/orders/${order.id}/receipt`}>In phiếu thu</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Liên kết vận hành</CardTitle>
              <CardDescription>Album, task, hóa đơn và giao dịch của đơn.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Album</p>
                {linkedAlbums.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Chưa có album.</p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {linkedAlbums.map((album) => (
                      <li key={album.id}>
                        <Link href={`/manage/albums/${album.id}`} className="text-primary hover:underline">
                          {album.title}
                        </Link>{" "}
                        <span className="text-xs text-muted-foreground">({album.status})</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Task</p>
                {linkedTasks.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Chưa có task.</p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {linkedTasks.map((task) => (
                      <li key={task.id}>
                        <Link
                          href={`/manage/tasks?q=${encodeURIComponent(task.title)}`}
                          className="text-primary hover:underline"
                        >
                          {task.title}
                        </Link>{" "}
                        <span className="text-xs text-muted-foreground">({task.status})</span>
                      </li>
                    ))}
                  </ul>
                )}
                {hasPermission(actor.permissions, "tasks.manage") ? (
                  <Link
                    href={`/manage/tasks?customerId=${order.customer.id}`}
                    className="mt-1 inline-block text-xs text-primary hover:underline"
                  >
                    + Tạo task cho khách
                  </Link>
                ) : null}
              </div>
              {hasPermission(actor.permissions, "finance.view") ? (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Hóa đơn / giao dịch</p>
                  {linkedInvoices.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Chưa có hóa đơn.</p>
                  ) : (
                    <ul className="mt-1 space-y-1">
                      {linkedInvoices.map((invoice) => (
                        <li key={invoice.id}>
                          <Link
                            href={`/manage/reports/invoices/${invoice.id}/print`}
                            className="font-mono text-primary hover:underline"
                          >
                            {invoice.invoiceNo}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {linkedTransactions.length} giao dịch gần nhất
                  </p>
                  <Link href="/manage/finance" className="text-xs text-primary hover:underline">
                    Mở sổ quỹ
                  </Link>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
