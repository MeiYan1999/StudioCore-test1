import { getActorContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { writeAudit } from "@/lib/audit";
import {
  CUSTOMER_SOURCE_LABELS,
  CUSTOMER_STATUS_LABELS,
  CUSTOMER_TIER_LABELS,
} from "@/lib/crm/constants";
import { getDb } from "@/lib/db/client";
import { customerCsvRows } from "@/lib/services/customer-service";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

function csvCell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? "" : String(value);

  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function csvDate(value: Date | null | undefined): string {
  return value ? formatDate(value) : "";
}

export async function GET(request: Request): Promise<Response> {
  const actor = await getActorContext();
  if (!actor) {
    return new Response("Chưa đăng nhập.", { status: 401 });
  }

  if (!hasPermission(actor.permissions, "customers.view")) {
    return new Response("Không có quyền xuất dữ liệu khách hàng.", { status: 403 });
  }

  const url = new URL(request.url);
  const filters = {
    q: url.searchParams.get("q") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    tier: url.searchParams.get("tier") ?? undefined,
    source: url.searchParams.get("source") ?? undefined,
    ownerId: url.searchParams.get("ownerId") ?? undefined,
    branchId: url.searchParams.get("branchId") ?? undefined,
    segment: url.searchParams.get("segment") ?? undefined,
  };

  const rows = customerCsvRows(getDb(), actor, filters);
  const headers = [
    "Họ tên",
    "Số điện thoại",
    "Email",
    "Chi nhánh",
    "Hạng khách",
    "Trạng thái",
    "Nguồn khách",
    "Người phụ trách",
    "Tags",
    "Follow-up",
    "Liên hệ cuối",
    "Ngày tạo",
  ];

  const lines = [
    headers.map(csvCell).join(","),
    ...rows.map((row) =>
      [
        row.name,
        row.phone,
        row.email,
        row.branchName,
        CUSTOMER_TIER_LABELS[row.tier] ?? row.tier,
        CUSTOMER_STATUS_LABELS[row.status] ?? row.status,
        CUSTOMER_SOURCE_LABELS[row.source] ?? row.source,
        row.ownerName,
        row.tags.join(", "),
        csvDate(row.followUpAt),
        csvDate(row.lastContactAt),
        csvDate(row.createdAt),
      ]
        .map(csvCell)
        .join(","),
    ),
  ];

  writeAudit(getDb(), {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "customers.export",
    entity: "customer",
    metadata: { count: rows.length, filters },
  });

  const filename = `studiocore-khach-hang-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(`\uFEFF${lines.join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
