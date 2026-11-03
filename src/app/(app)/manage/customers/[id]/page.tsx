import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarClock,
  Cake,
  Mail,
  MapPin,
  Phone,
  ReceiptText,
  StickyNote,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { DateTimeText } from "@/components/shared/date-time";
import { EmptyState } from "@/components/shared/empty-state";
import { ForbiddenState } from "@/components/shared/forbidden-state";
import { Money } from "@/components/shared/money";
import { CustomerFormSheet } from "@/components/crm/customer-form-sheet";
import { CustomerInteractionForm } from "@/components/crm/customer-interaction-form";
import { CustomerTabs } from "@/components/crm/customer-tabs";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import {
  CUSTOMER_SOURCE_LABELS,
  CUSTOMER_STATUS_LABELS,
  CUSTOMER_TIER_LABELS,
  INTERACTION_TYPE_LABELS,
} from "@/lib/crm/constants";
import { getDb } from "@/lib/db/client";
import { ORDER_STATUS_META, isOrderStatus } from "@/lib/orders/status";
import {
  getCustomerDetail,
  type CustomerOrderSummary,
} from "@/lib/services/customer-service";
import { listStaffOptions } from "@/lib/services/staff-options";
import { getTasksForCustomer } from "@/lib/services/task-service";
import { TASK_STATUS_META, type TaskStatus } from "@/lib/tasks/constants";
import { formatDate } from "@/lib/utils";

export const metadata = {
  title: "Hồ sơ khách hàng",
};

function statusTone(status: string): "success" | "info" | "warning" | "neutral" {
  if (status === "active") return "success";
  if (status === "lead") return "info";
  if (status === "inactive") return "warning";
  return "neutral";
}

function tierTone(tier: string): "warning" | "info" | "neutral" {
  if (tier === "vvip") return "warning";
  if (tier === "vip") return "info";
  return "neutral";
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function DetailField({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 text-sm text-foreground">{value || "Chưa có"}</dd>
    </div>
  );
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireActor();

  if (!hasPermission(actor.permissions, "customers.view")) {
    return <ForbiddenState description="Vai trò của bạn không có quyền xem khách hàng." />;
  }

  const { id } = await params;
  const customer = getCustomerDetail(getDb(), actor, id);

  if (!customer) {
    notFound();
  }

  const canManage = hasPermission(actor.permissions, "customers.manage");
  const staffOptions = listStaffOptions(getDb(), actor, "customers.view");
  const customerTasks = hasPermission(actor.permissions, "tasks.view")
    ? getTasksForCustomer(getDb(), actor, customer.id)
    : [];
  const orderColumns: DataTableColumn<CustomerOrderSummary>[] = [
    {
      key: "code",
      header: "Mã đơn",
      cell: (row) => (
        <div>
          <Link
            href={`/manage/orders/${row.id}`}
            className="font-mono text-sm font-medium text-foreground hover:text-primary"
          >
            {row.code}
          </Link>
          <p className="text-xs text-muted-foreground">
            {formatDate(row.createdAt)}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (row) => {
        const meta = isOrderStatus(row.status)
          ? ORDER_STATUS_META[row.status]
          : { label: row.status, tone: "neutral" as const };
        return <Badge tone={meta.tone}>{meta.label}</Badge>;
      },
    },
    {
      key: "schedule",
      header: "Lịch chụp",
      cell: (row) => <DateTimeText value={row.scheduledAt} />,
    },
    {
      key: "total",
      header: "Tổng tiền",
      className: "text-right",
      cell: (row) => <Money value={row.total} />,
    },
    {
      key: "paid",
      header: "Đã thu",
      className: "text-right",
      cell: (row) => <Money value={row.paid} />,
    },
    {
      key: "remaining",
      header: "Còn lại",
      className: "text-right",
      cell: (row) => <Money value={row.remaining} />,
    },
    {
      key: "action",
      header: "",
      className: "text-right",
      cell: (row) => (
        <Button asChild variant="outline" size="sm">
          <Link href={`/manage/orders/${row.id}`}>Xem đơn</Link>
        </Button>
      ),
    },
  ];

  const measurements = [
    customer.measurements.heightCm ? `Cao ${customer.measurements.heightCm}cm` : null,
    customer.measurements.dressSize ? `Size ${customer.measurements.dressSize}` : null,
    customer.measurements.shoeSize ? `Giày ${customer.measurements.shoeSize}` : null,
  ].filter(Boolean);

  return (
    <div>
      <PageHeader
        title={customer.name}
        description={`Khách hàng từ ${formatDate(customer.createdAt)} · ${customer.branchName}`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`/manage/orders?q=${encodeURIComponent(customer.phone)}`}>
                <ReceiptText className="h-4 w-4" aria-hidden="true" />
                Xem đơn hàng
              </Link>
            </Button>
            {hasPermission(actor.permissions, "tasks.manage") ? (
              <Button asChild variant="outline">
                <Link href={`/manage/tasks?customerId=${customer.id}`}>
                  Tạo task chăm sóc
                </Link>
              </Button>
            ) : null}
            {canManage ? (
              <CustomerFormSheet
                mode="edit"
                customer={customer}
                branches={actor.branches}
                staffOptions={staffOptions}
                defaultBranchId={customer.branchId}
              />
            ) : null}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={tierTone(customer.tier)}>
          {CUSTOMER_TIER_LABELS[customer.tier] ?? customer.tier}
        </Badge>
        <Badge tone={statusTone(customer.status)}>
          {CUSTOMER_STATUS_LABELS[customer.status] ?? customer.status}
        </Badge>
        <Badge tone="neutral">
          {CUSTOMER_SOURCE_LABELS[customer.source] ?? customer.source}
        </Badge>
        {customer.tags.map((tag) => (
          <Badge key={tag} tone="neutral">
            {tag}
          </Badge>
        ))}
      </div>

      <section aria-label="Chỉ số khách hàng" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Giá trị đơn lũy kế"
          value={<Money value={customer.metrics.ltv} />}
          hint={`${customer.metrics.orderCount} đơn không tính hủy`}
        />
        <Metric
          label="Đã thu"
          value={<Money value={customer.metrics.totalPaid} />}
          hint="Tổng thanh toán ghi nhận"
        />
        <Metric
          label="Công nợ"
          value={<Money value={customer.metrics.debt} />}
          hint="Tổng còn lại của đơn chưa hủy"
        />
        <Metric
          label="Giá trị trung bình"
          value={<Money value={customer.metrics.averageOrderValue} />}
          hint={`Đơn gần nhất: ${formatDate(customer.metrics.lastOrderAt)}`}
        />
      </section>

      <div className="mt-6">
        <CustomerTabs
          overview={
            <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Thông tin khách hàng</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid gap-4 sm:grid-cols-2">
                    <DetailField
                      label="Số điện thoại"
                      value={
                        <a className="hover:text-primary" href={`tel:${customer.phone}`}>
                          {customer.phone}
                        </a>
                      }
                      icon={<Phone className="h-3.5 w-3.5" aria-hidden="true" />}
                    />
                    <DetailField
                      label="Email"
                      value={
                        customer.email ? (
                          <a className="hover:text-primary" href={`mailto:${customer.email}`}>
                            {customer.email}
                          </a>
                        ) : null
                      }
                      icon={<Mail className="h-3.5 w-3.5" aria-hidden="true" />}
                    />
                    <DetailField
                      label="Địa chỉ"
                      value={customer.address}
                      icon={<MapPin className="h-3.5 w-3.5" aria-hidden="true" />}
                    />
                    <DetailField
                      label="Ngày sinh"
                      value={customer.birthday ? formatDate(customer.birthday) : null}
                      icon={<Cake className="h-3.5 w-3.5" aria-hidden="true" />}
                    />
                    <DetailField
                      label="Người phụ trách"
                      value={customer.ownerName}
                      icon={<Users className="h-3.5 w-3.5" aria-hidden="true" />}
                    />
                    <DetailField
                      label="Follow-up tiếp theo"
                      value={
                        <span className="flex items-center gap-2">
                          <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                          <DateTimeText value={customer.followUpAt} />
                          {customer.followUpOverdue ? (
                            <Badge tone="warning">Quá hạn</Badge>
                          ) : null}
                        </span>
                      }
                    />
                    <DetailField
                      label="Liên hệ cuối"
                      value={<DateTimeText value={customer.lastContactAt} />}
                    />
                    <DetailField
                      label="Chi nhánh"
                      value={customer.branchName}
                    />
                  </dl>

                  <div className="mt-6 rounded-lg border border-border bg-surface-muted/50 p-4">
                    <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <StickyNote className="h-3.5 w-3.5" aria-hidden="true" />
                      Số đo & ghi chú phục vụ
                    </p>
                    <p className="mt-2 text-sm text-foreground">
                      {measurements.length > 0 ? measurements.join(" · ") : "Chưa có số đo"}
                    </p>
                    {customer.measurements.note ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {customer.measurements.note}
                      </p>
                    ) : null}
                  </div>

                  {customer.notes ? (
                    <div className="mt-4">
                      <p className="text-xs font-medium text-muted-foreground">Ghi chú nội bộ</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                        {customer.notes}
                      </p>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Tóm tắt chăm sóc</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Số đơn</span>
                    <span className="font-semibold tabular-nums">{customer.metrics.orderCount}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Đơn gần nhất</span>
                    <span className="font-medium">
                      {customer.metrics.lastOrderAt
                        ? formatDate(customer.metrics.lastOrderAt)
                        : "Chưa có"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Tương tác</span>
                    <span className="font-semibold tabular-nums">
                      {customer.interactions.length}
                    </span>
                  </div>
                  <div className="rounded-lg bg-surface-muted p-3 text-xs text-muted-foreground">
                    Dữ liệu hồ sơ được tính ở server từ đơn hàng và thanh toán. Không có lịch sử giả.
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Công việc chăm sóc</CardTitle>
                </CardHeader>
                <CardContent>
                  {customerTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Chưa có task.{" "}
                      <Link
                        href={`/manage/tasks?customerId=${customer.id}`}
                        className="text-primary hover:underline"
                      >
                        Tạo task
                      </Link>
                    </p>
                  ) : (
                    <ul className="space-y-2 text-sm">
                      {customerTasks.slice(0, 5).map((task) => (
                        <li key={task.id} className="flex items-start justify-between gap-2">
                          <div>
                            <Link
                              href={`/manage/tasks?customerId=${customer.id}`}
                              className="font-medium hover:text-primary"
                            >
                              {task.title}
                            </Link>
                            <p className="text-xs text-muted-foreground">
                              {task.assigneeName ?? "Chưa phân công"} · {task.overdue ? "Quá hạn" : "Đúng hạn"}
                            </p>
                          </div>
                          <Badge tone={TASK_STATUS_META[task.status as TaskStatus]?.tone ?? "neutral"}>
                            {TASK_STATUS_META[task.status as TaskStatus]?.label ?? task.status}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          }
          orders={
            <DataTable
              columns={orderColumns}
              rows={customer.orders}
              getRowKey={(row) => row.id}
              caption="Đơn hàng gần đây của khách"
              empty={
                <EmptyState
                  icon={<ReceiptText className="h-6 w-6" aria-hidden="true" />}
                  title="Chưa có đơn hàng"
                  description="Đơn hàng của khách sẽ xuất hiện tại đây sau khi được tạo."
                />
              }
            />
          }
          interactions={
            <div className="space-y-6">
              {canManage ? <CustomerInteractionForm customerId={customer.id} /> : null}
              {customer.interactions.length === 0 ? (
                <EmptyState
                  title="Chưa có tương tác"
                  description="Ghi nhận cuộc gọi, tin nhắn hoặc follow-up đầu tiên."
                />
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Lịch sử tương tác</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ol className="relative space-y-5 border-l border-border pl-5">
                      {customer.interactions.map((interaction) => (
                        <li key={interaction.id} className="relative">
                          <span className="absolute -left-[1.42rem] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone="info">
                              {INTERACTION_TYPE_LABELS[interaction.type] ?? interaction.type}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(interaction.occurredAt)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {interaction.createdByName ?? "Hệ thống"}
                            </span>
                          </div>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                            {interaction.content}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              )}
            </div>
          }
        />
      </div>
    </div>
  );
}
