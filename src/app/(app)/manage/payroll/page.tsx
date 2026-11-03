import Link from "next/link";
import { Lock, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { ForbiddenState } from "@/components/shared/forbidden-state";
import { Money } from "@/components/shared/money";
import {
  GeneratePayrollButton,
  PayrollEditSheet,
  PayrollStatusAction,
} from "@/components/finance/payroll-controls";
import { hasPermission } from "@/lib/auth/permissions";
import { ROLE_LABELS, type Role } from "@/lib/auth/roles";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import {
  listPayrolls,
  type PayrollView,
} from "@/lib/services/commission-payroll-service";
import { formatVnd } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Bảng lương" };

function currentPeriod(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
}

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const actor = await requireActor();
  if (!hasPermission(actor.permissions, "payroll.view")) {
    return (
      <ForbiddenState description="Chỉ chủ studio hoặc kế toán được xem bảng lương." />
    );
  }
  const params = await searchParams;
  const period = params.period || currentPeriod();
  const rows = listPayrolls(getDb(), actor, period);
  const canManage = hasPermission(actor.permissions, "payroll.manage");
  const totalNet = rows.reduce((sum, row) => sum + row.net, 0);
  const locked = rows.some((row) => row.status === "approved" || row.status === "paid");

  const columns: DataTableColumn<PayrollView>[] = [
    {
      key: "staff",
      header: "Nhân sự",
      cell: (row) => (
        <div>
          <p className="font-medium">{row.staffName}</p>
          <p className="text-xs text-muted-foreground">
            {row.staffCode} · {ROLE_LABELS[row.role as Role] ?? row.role}
          </p>
        </div>
      ),
    },
    {
      key: "base",
      header: "Lương cơ bản",
      className: "text-right",
      cell: (row) => <Money value={row.baseSalary} />,
    },
    {
      key: "days",
      header: "Ngày công",
      className: "text-right",
      cell: (row) => row.workDays,
    },
    {
      key: "commission",
      header: "Hoa hồng",
      className: "text-right",
      cell: (row) => <Money value={row.commissionAmount} />,
    },
    {
      key: "bonus",
      header: "Thưởng / khấu trừ",
      className: "text-right",
      cell: (row) => (
        <span className="text-xs text-muted-foreground">
          +{formatVnd(row.bonus)} / −{formatVnd(row.deduction)}
        </span>
      ),
    },
    {
      key: "net",
      header: "Thực nhận",
      className: "text-right",
      cell: (row) => <Money value={row.net} className="font-semibold" />,
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (row) => (
        <Badge
          tone={
            row.status === "paid"
              ? "success"
              : row.status === "approved"
                ? "info"
                : row.status === "pending"
                  ? "warning"
                  : "neutral"
          }
        >
          {row.status}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (row) =>
        canManage ? (
          <div className="flex flex-wrap items-center justify-end gap-1">
            {row.status === "draft" ? (
              <PayrollEditSheet
                payroll={{
                  id: row.id,
                  staffName: row.staffName,
                  period: row.period,
                  baseSalary: row.baseSalary,
                  commissionAmount: row.commissionAmount,
                  bonus: row.bonus,
                  deduction: row.deduction,
                  net: row.net,
                }}
              />
            ) : null}
            <PayrollStatusAction payrollId={row.id} status={row.status} />
          </div>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Bảng lương"
        description="Lương cơ bản + hoa hồng snapshot + thưởng/khấu trừ; duyệt và chi trả sẽ khóa kỳ."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/manage/finance/commissions">Hoa hồng</Link>
            </Button>
            {canManage ? <GeneratePayrollButton period={period} /> : null}
          </>
        }
      />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border border-border bg-surface p-4">
        <div>
          <Label htmlFor="payroll-period">Kỳ lương</Label>
          <Input id="payroll-period" name="period" type="month" defaultValue={period} className="mt-1.5" />
        </div>
        <Button type="submit" size="sm">Xem</Button>
        <Badge tone={locked ? "warning" : "info"} className="ml-auto">
          {locked ? (
            <>
              <Lock className="h-3 w-3" aria-hidden /> Kỳ đã duyệt/khóa
            </>
          ) : (
            "Kỳ đang mở"
          )}
        </Badge>
        <Badge tone="success">Tổng thực nhận: {formatVnd(totalNet)}</Badge>
      </form>

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        caption="Bảng lương theo kỳ"
        empty={
          <EmptyState
            icon={<Wallet className="h-6 w-6" aria-hidden />}
            title="Chưa có bảng lương kỳ này"
            description="Tạo bảng lương để snapshot lương cơ bản, ngày công và commission đã duyệt."
            action={
              canManage ? <GeneratePayrollButton period={period} /> : null
            }
          />
        }
      />

      <p className="mt-3 text-xs text-muted-foreground">
        Ngày công lấy từ bản ghi chấm công trong kỳ. Commission đã duyệt được gắn
        vào bảng lương một lần; chi trả tạo transaction lương và khóa kỳ.
      </p>
    </div>
  );
}
