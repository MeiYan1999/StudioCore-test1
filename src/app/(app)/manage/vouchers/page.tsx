import { Ticket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { DateText } from "@/components/shared/date-time";
import { EmptyState } from "@/components/shared/empty-state";
import { ForbiddenState } from "@/components/shared/forbidden-state";
import { Money } from "@/components/shared/money";
import { VoucherSheet } from "@/components/catalog/voucher-sheet";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { VOUCHER_DISCOUNT_TYPE_LABELS } from "@/lib/catalog/constants";
import { getDb } from "@/lib/db/client";
import {
  isVoucherUsable,
  listVouchers,
  type VoucherItem,
} from "@/lib/services/catalog-service";

export const metadata = {
  title: "Voucher",
};

function voucherStatus(voucher: VoucherItem): {
  label: string;
  tone: "success" | "warning" | "neutral";
} {
  if (!voucher.active) return { label: "Tạm ngưng", tone: "neutral" };
  if (voucher.usageLimit !== null && voucher.usedCount >= voucher.usageLimit) {
    return { label: "Hết lượt", tone: "warning" };
  }
  if (!isVoucherUsable(voucher)) return { label: "Hết hạn", tone: "warning" };
  return { label: "Đang áp dụng", tone: "success" };
}

export default async function VouchersPage() {
  const actor = await requireActor();

  if (!hasPermission(actor.permissions, "orders.view")) {
    return <ForbiddenState description="Vai trò của bạn không có quyền xem voucher." />;
  }

  const vouchers = listVouchers(getDb(), actor);
  const canManage = hasPermission(actor.permissions, "catalog.manage");

  const columns: DataTableColumn<VoucherItem>[] = [
    {
      key: "code",
      header: "Voucher",
      cell: (row) => (
        <div>
          <p className="font-mono text-sm font-semibold text-foreground">{row.code}</p>
          <p className="text-xs text-muted-foreground">{row.name}</p>
        </div>
      ),
    },
    {
      key: "discount",
      header: "Giảm giá",
      cell: (row) => (
        <div className="text-sm">
          <p className="font-medium text-foreground">
            {row.discountType === "percent"
              ? `${row.value}%`
              : <Money value={row.value} />}
          </p>
          <p className="text-xs text-muted-foreground">
            {VOUCHER_DISCOUNT_TYPE_LABELS[row.discountType] ?? row.discountType}
            {row.maxDiscount !== null ? ` · tối đa ${row.maxDiscount.toLocaleString("vi-VN")}đ` : ""}
          </p>
        </div>
      ),
    },
    {
      key: "conditions",
      header: "Điều kiện",
      cell: (row) => (
        <div className="text-sm">
          <p>Đơn tối thiểu <Money value={row.minOrder} /></p>
          <p className="text-xs text-muted-foreground">
            {row.usedCount}/{row.usageLimit ?? "∞"} lượt · {row.branchName ?? "Toàn studio"}
          </p>
        </div>
      ),
    },
    {
      key: "validity",
      header: "Hiệu lực",
      cell: (row) => (
        <div className="text-sm">
          <p><DateText value={row.startsAt} /> → <DateText value={row.endsAt} /></p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (row) => {
        const status = voucherStatus(row);
        return <Badge tone={status.tone}>{status.label}</Badge>;
      },
    },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "",
            className: "text-right",
            cell: (row: VoucherItem) => (
              <VoucherSheet voucher={row} branches={actor.branches} />
            ),
          },
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader
        title="Voucher"
        description="Mã giảm giá được kiểm tra hạn dùng, đơn tối thiểu, giới hạn lượt và phạm vi chi nhánh ở server."
        actions={canManage ? <VoucherSheet branches={actor.branches} /> : null}
      />

      <DataTable
        columns={columns}
        rows={vouchers}
        getRowKey={(row) => row.id}
        caption="Danh sách voucher"
        empty={
          <EmptyState
            icon={<Ticket className="h-6 w-6" aria-hidden="true" />}
            title="Chưa có voucher"
            description="Tạo voucher đầu tiên để áp dụng khi tạo đơn hàng."
          />
        }
      />
    </div>
  );
}
