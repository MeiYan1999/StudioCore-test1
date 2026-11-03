import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, QrCode as QrIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { DateTimeText } from "@/components/shared/date-time";
import { ForbiddenState } from "@/components/shared/forbidden-state";
import { Money } from "@/components/shared/money";
import { QrCode } from "@/components/wardrobe/qr-code";
import { RentalSheet, ReturnRentalSheet } from "@/components/wardrobe/rental-sheets";
import { WardrobeItemSheet } from "@/components/wardrobe/wardrobe-item-sheet";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { addDaysToKey, getTodayKey } from "@/lib/scheduling/time";
import { listOrderOptions } from "@/lib/services/order-service";
import {
  getWardrobeItemDetail,
  type RentalView,
} from "@/lib/services/wardrobe-service";
import {
  RENTAL_CONDITION_LABELS,
  RENTAL_STATUS_LABELS,
  WARDROBE_STATUS_LABELS,
} from "@/lib/wardrobe/constants";

export const metadata = {
  title: "Chi tiết trang phục",
};

function statusTone(status: string): "success" | "warning" | "info" | "neutral" {
  if (status === "available") return "success";
  if (status === "rented") return "info";
  if (status === "cleaning") return "warning";
  return "neutral";
}

export default async function WardrobeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireActor();
  if (!hasPermission(actor.permissions, "schedule.view")) {
    return <ForbiddenState description="Vai trò của bạn không có quyền xem trang phục." />;
  }

  const { id } = await params;
  const item = getWardrobeItemDetail(getDb(), actor, id);
  if (!item) notFound();

  const canManage = hasPermission(actor.permissions, "schedule.manage");
  const canViewOrders = hasPermission(actor.permissions, "orders.view");
  const orders = canViewOrders ? listOrderOptions(getDb(), actor) : [];
  const activeRental = item.rentals.find((rental) => rental.status === "active") ?? null;
  const defaultDueAt = `${addDaysToKey(getTodayKey(), 7)}T18:00`;

  const rentalColumns: DataTableColumn<RentalView>[] = [
    {
      key: "order",
      header: "Đơn / khách",
      cell: (row) => (
        <div>
          <p className="font-mono text-xs text-foreground">{row.orderCode ?? "Không gắn đơn"}</p>
          <p className="text-sm text-muted-foreground">{row.customerName ?? "Không có khách"}</p>
        </div>
      ),
    },
    {
      key: "checkedOut",
      header: "Xuất kho",
      cell: (row) => <DateTimeText value={row.checkedOutAt} />,
    },
    {
      key: "due",
      header: "Hạn trả",
      cell: (row) => (
        <div>
          <DateTimeText value={row.dueAt} />
          {row.overdue ? <p className="text-xs text-[var(--danger)]">Quá hạn</p> : null}
        </div>
      ),
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (row) => (
        <Badge tone={row.status === "active" ? "info" : row.status === "returned" ? "success" : "neutral"}>
          {RENTAL_STATUS_LABELS[row.status] ?? row.status}
        </Badge>
      ),
    },
    {
      key: "fees",
      header: "Phí phát sinh",
      className: "text-right",
      cell: (row) => (
        <div className="text-sm">
          <Money value={row.cleaningFee + row.damageFee} />
          {row.conditionIn ? (
            <p className="text-xs text-muted-foreground">
              {RENTAL_CONDITION_LABELS[row.conditionIn] ?? row.conditionIn}
            </p>
          ) : null}
        </div>
      ),
    },
    ...(canManage && activeRental
      ? [
          {
            key: "actions",
            header: "",
            className: "text-right",
            cell: (row: RentalView) =>
              row.status === "active" ? <ReturnRentalSheet rental={row} /> : null,
          },
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader
        title={item.name}
        description={`${item.sku} · ${item.qrCode} · ${item.branchName}`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/manage/wardrobe">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Kho trang phục
              </Link>
            </Button>
            {canManage ? <WardrobeItemSheet item={item} branches={actor.branches} /> : null}
            {canManage && item.status === "available" ? (
              <RentalSheet item={item} orders={orders} defaultDueAt={defaultDueAt} />
            ) : null}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[0.7fr_1.3fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrIcon className="h-4 w-4" aria-hidden="true" />
                Mã QR
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-3">
              <QrCode value={item.qrCode} size={180} />
              <p className="text-center font-mono text-xs text-muted-foreground">{item.qrCode}</p>
              <p className="text-center text-xs text-muted-foreground">
                Dùng máy quét QR hoặc nhập mã vào ô tìm kiếm kho để xuất/nhận.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Thông tin</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Trạng thái</span>
                <Badge tone={statusTone(item.status)}>
                  {WARDROBE_STATUS_LABELS[item.status] ?? item.status}
                </Badge>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Size / màu</span>
                <span>{item.size} · {item.color}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Giá thuê</span>
                <Money value={item.rentalPrice} />
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Tiền cọc</span>
                <Money value={item.depositPrice} />
              </div>
              {item.notes ? (
                <p className="rounded-lg bg-surface-muted p-3 text-xs text-muted-foreground">
                  {item.notes}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {activeRental ? (
            <Card>
              <CardHeader className="flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle>Đang cho thuê</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {activeRental.customerName ?? "Không gắn khách"} ·{" "}
                    {activeRental.orderCode ?? "Không gắn đơn"}
                  </p>
                </div>
                {activeRental.overdue ? <Badge tone="danger">Quá hạn</Badge> : <Badge tone="info">Đang thuê</Badge>}
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Hạn trả</span>
                  <DateTimeText value={activeRental.dueAt} />
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Tiền cọc</span>
                  <Money value={activeRental.deposit} />
                </div>
                {canManage ? <ReturnRentalSheet rental={activeRental} /> : null}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Lịch sử thuê/trả</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={rentalColumns}
                rows={item.rentals}
                getRowKey={(row) => row.id}
                caption="Lịch sử thuê trả trang phục"
                empty={
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Chưa có lịch sử thuê/trả.
                  </p>
                }
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
