import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  FileText,
  HandCoins,
  Percent,
  Scale,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { DateTimeText } from "@/components/shared/date-time";
import { EmptyState } from "@/components/shared/empty-state";
import { ForbiddenState } from "@/components/shared/forbidden-state";
import { Money } from "@/components/shared/money";
import {
  BudgetSheet,
  ExpenseSheet,
  RefundSheet,
  TransactionSheet,
} from "@/components/finance/finance-sheets";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import {
  EXPENSE_CATEGORY_LABELS,
  PAYMENT_METHOD_LABELS,
  TRANSACTION_CATEGORY_LABELS,
  TRANSACTION_TYPE_LABELS,
  type PaymentMethod,
  type TransactionType,
} from "@/lib/finance/constants";
import {
  getFinanceSummary,
  listBudgets,
  listDebtors,
  listExpenses,
  listFinanceOrderOptions,
  listTransactions,
  type ExpenseView,
  type TransactionView,
} from "@/lib/services/finance-service";
import { formatVnd } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sổ quỹ",
};

type SearchParams = {
  q?: string;
  type?: string;
  branchId?: string;
  from?: string;
  to?: string;
  page?: string;
};

function buildHref(params: SearchParams, override: Partial<SearchParams> = {}): string {
  const merged = { ...params, ...override };
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value && key !== "page") query.set(key, value);
  }
  if (merged.page) query.set("page", merged.page);
  const qs = query.toString();
  return qs ? `/manage/finance?${qs}` : "/manage/finance";
}

function currentPeriod(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
}

function SummaryCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className="text-primary">{icon}</span>
      </div>
      <p className="mt-2 text-xl font-semibold tabular-nums text-foreground">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const actor = await requireActor();
  if (!hasPermission(actor.permissions, "finance.view")) {
    return (
      <ForbiddenState description="Vai trò của bạn không có quyền xem sổ quỹ." />
    );
  }
  const params = await searchParams;
  const db = getDb();
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const filters = {
    q: params.q,
    type: params.type,
    branchId: params.branchId,
    from: params.from,
    to: params.to,
  };
  const summary = getFinanceSummary(db, actor, filters);
  const ledger = listTransactions(db, actor, { ...filters, page, pageSize: 20 });
  const expenses = listExpenses(db, actor, filters);
  const debt = listDebtors(db, actor, { branchId: params.branchId });
  const period = currentPeriod();
  const budgets = listBudgets(db, actor, period);
  const canManage = hasPermission(actor.permissions, "finance.manage");
  const orderOptions = canManage
    ? listFinanceOrderOptions(db, actor).filter((order) => order.paid > 0)
    : [];
  const defaultBranchId = actor.activeBranchId ?? actor.branches[0]?.id ?? "";
  const totalPages = Math.max(1, Math.ceil(ledger.total / ledger.pageSize));

  const transactionColumns: DataTableColumn<TransactionView>[] = [
    {
      key: "time",
      header: "Thời điểm",
      cell: (row) => <DateTimeText value={row.occurredAt} />,
    },
    {
      key: "type",
      header: "Loại",
      cell: (row) => (
        <Badge
          tone={
            row.type === "income" ? "success" : row.type === "refund" ? "warning" : "danger"
          }
        >
          {TRANSACTION_TYPE_LABELS[row.type as TransactionType] ?? row.type}
        </Badge>
      ),
    },
    {
      key: "category",
      header: "Danh mục",
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {TRANSACTION_CATEGORY_LABELS[row.category] ?? row.category}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Số tiền",
      className: "text-right",
      cell: (row) => (
        <Money
          value={row.amount}
          className={
            row.type === "income"
              ? "font-medium text-[var(--success)]"
              : "font-medium text-[var(--danger)]"
          }
        />
      ),
    },
    {
      key: "ref",
      header: "Đơn / khách",
      cell: (row) => (
        <div className="text-xs text-muted-foreground">
          <p className="font-mono">{row.orderCode ?? "—"}</p>
          <p>{row.customerName ?? row.branchName}</p>
        </div>
      ),
    },
    {
      key: "method",
      header: "Phương thức",
      cell: (row) => (
        <span className="text-sm">
          {PAYMENT_METHOD_LABELS[row.method as PaymentMethod] ?? row.method}
        </span>
      ),
    },
    {
      key: "description",
      header: "Diễn giải",
      cell: (row) => (
        <div className="max-w-64 text-sm">
          <p className="truncate text-foreground">{row.description ?? "—"}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.reference ?? ""} {row.createdByName ? `· ${row.createdByName}` : ""}
          </p>
        </div>
      ),
    },
  ];

  const expenseColumns: DataTableColumn<ExpenseView>[] = [
    {
      key: "date",
      header: "Thời điểm",
      cell: (row) => <DateTimeText value={row.occurredAt} />,
    },
    {
      key: "category",
      header: "Danh mục",
      cell: (row) => EXPENSE_CATEGORY_LABELS[row.category] ?? row.category,
    },
    { key: "vendor", header: "Nhà cung cấp", cell: (row) => row.vendor ?? "—" },
    {
      key: "amount",
      header: "Số tiền",
      className: "text-right",
      cell: (row) => <Money value={row.amount} className="text-[var(--danger)]" />,
    },
    {
      key: "description",
      header: "Diễn giải",
      cell: (row) => row.description ?? "—",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Sổ quỹ"
        description="Thu chi thật từ payments, giao dịch thủ công, hóa đơn, công nợ và ngân sách theo chi nhánh."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/manage/finance/invoices">
                <FileText className="h-4 w-4" aria-hidden />
                Hóa đơn
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/manage/finance/debts">
                <Scale className="h-4 w-4" aria-hidden />
                Công nợ
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/manage/finance/commissions">
                <Percent className="h-4 w-4" aria-hidden />
                Hoa hồng
              </Link>
            </Button>
            {canManage ? (
              <>
                <TransactionSheet branches={actor.branches} defaultBranchId={defaultBranchId} />
                <ExpenseSheet branches={actor.branches} defaultBranchId={defaultBranchId} />
                <BudgetSheet
                  branches={actor.branches}
                  defaultBranchId={defaultBranchId}
                  period={period}
                />
                <RefundSheet orders={orderOptions} />
              </>
            ) : null}
          </>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          label="Thu trong kỳ"
          value={formatVnd(summary.income)}
          hint={`${summary.transactionCount} giao dịch`}
          icon={<ArrowDownLeft className="h-5 w-5" aria-hidden />}
        />
        <SummaryCard
          label="Chi trong kỳ"
          value={formatVnd(summary.expense)}
          icon={<ArrowUpRight className="h-5 w-5" aria-hidden />}
        />
        <SummaryCard
          label="Hoàn tiền"
          value={formatVnd(summary.refund)}
          icon={<HandCoins className="h-5 w-5" aria-hidden />}
        />
        <SummaryCard
          label="Lợi nhuận tạm tính"
          value={formatVnd(summary.net)}
          hint="Thu − hoàn − chi"
          icon={<Wallet className="h-5 w-5" aria-hidden />}
        />
        <SummaryCard
          label="Công nợ hiện tại"
          value={formatVnd(debt.total)}
          hint={`${debt.rows.length} đơn còn nợ`}
          icon={<Scale className="h-5 w-5" aria-hidden />}
        />
      </section>

      <form method="get" className="my-5 rounded-xl border border-border bg-surface p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div>
            <Label htmlFor="finance-q">Tìm kiếm</Label>
            <Input
              id="finance-q"
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Mã đơn, khách, diễn giải..."
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="finance-type">Loại</Label>
            <Select id="finance-type" name="type" defaultValue={params.type ?? ""} className="mt-1.5">
              <option value="">Tất cả</option>
              <option value="income">Thu</option>
              <option value="expense">Chi</option>
              <option value="refund">Hoàn tiền</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="finance-branch">Chi nhánh</Label>
            <Select
              id="finance-branch"
              name="branchId"
              defaultValue={params.branchId ?? ""}
              className="mt-1.5"
            >
              <option value="">Tất cả được xem</option>
              {actor.branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="finance-from">Từ ngày</Label>
            <Input id="finance-from" name="from" type="date" defaultValue={params.from ?? ""} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="finance-to">Đến ngày</Label>
            <Input id="finance-to" name="to" type="date" defaultValue={params.to ?? ""} className="mt-1.5" />
          </div>
          <div className="flex items-end gap-2">
            <Button type="submit" size="sm">Lọc</Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/manage/finance">Xóa lọc</Link>
            </Button>
          </div>
        </div>
      </form>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0">
          <h2 className="mb-2 text-base font-semibold text-foreground">
            Giao dịch ({ledger.total})
          </h2>
          <DataTable
            columns={transactionColumns}
            rows={ledger.items}
            getRowKey={(row) => row.id}
            caption="Sổ quỹ giao dịch"
            empty={
              <EmptyState
                icon={<Wallet className="h-6 w-6" aria-hidden />}
                title="Chưa có giao dịch"
                description="Thanh toán đơn hàng hoặc ghi giao dịch thủ công để bắt đầu."
              />
            }
          />
          {totalPages > 1 ? (
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Trang {ledger.page}/{totalPages}
              </span>
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={buildHref(params, { page: String(ledger.page - 1) })}>Trước</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={buildHref(params, { page: String(ledger.page + 1) })}>Sau</Link>
                </Button>
              </div>
            </div>
          ) : null}

          <h2 className="mb-2 mt-6 text-base font-semibold text-foreground">
            Khoản chi ({expenses.length})
          </h2>
          <DataTable
            columns={expenseColumns}
            rows={expenses}
            getRowKey={(row) => row.id}
            caption="Danh sách khoản chi"
            empty={<p className="text-sm text-muted-foreground">Chưa có khoản chi.</p>}
          />
        </section>

        <aside className="space-y-4">
          <section className="rounded-xl border border-border bg-surface p-4">
            <h2 className="text-base font-semibold text-foreground">
              Ngân sách {period}
            </h2>
            {budgets.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Chưa thiết lập ngân sách kỳ này.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {budgets.map((budget) => {
                  const ratio =
                    budget.amount > 0
                      ? Math.min(100, Math.round((budget.spent / budget.amount) * 100))
                      : 0;
                  return (
                    <li key={budget.id}>
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="font-medium">
                          {EXPENSE_CATEGORY_LABELS[budget.category] ?? budget.category}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatVnd(budget.spent)} / {formatVnd(budget.amount)}
                        </span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-muted">
                        <div
                          className={
                            ratio >= 90
                              ? "h-full bg-[var(--danger)]"
                              : ratio >= 70
                                ? "h-full bg-[var(--warning)]"
                                : "h-full bg-primary"
                          }
                          style={{ width: `${ratio}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-border bg-surface p-4 text-sm">
            <h2 className="text-base font-semibold text-foreground">Công nợ theo tuổi</h2>
            <dl className="mt-2 space-y-1.5">
              {Object.entries(debt.buckets).map(([bucket, amount]) => (
                <div key={bucket} className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">{bucket} ngày</dt>
                  <dd>{formatVnd(amount)}</dd>
                </div>
              ))}
            </dl>
            <Button asChild variant="outline" size="sm" className="mt-3 w-full">
              <Link href="/manage/finance/debts">Xem chi tiết công nợ</Link>
            </Button>
          </section>
        </aside>
      </div>
    </div>
  );
}
