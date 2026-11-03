import Link from "next/link";
import { ExternalLink, FileText } from "lucide-react";
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
import {
  DocumentLinkSheet,
  DocumentUploadSheet,
} from "@/components/documents/document-sheets";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_VISIBILITY_LABELS,
} from "@/lib/documents/constants";
import {
  listDocuments,
  type DocumentView,
} from "@/lib/services/document-service";

export const dynamic = "force-dynamic";

export const metadata = { title: "Tài liệu" };

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const actor = await requireActor();
  if (!hasPermission(actor.permissions, "tasks.view")) {
    return <ForbiddenState description="Vai trò của bạn không có quyền xem tài liệu." />;
  }
  const params = await searchParams;
  const rows = listDocuments(getDb(), actor, params);
  const canManage = hasPermission(actor.permissions, "tasks.manage");
  const defaultBranchId = actor.activeBranchId ?? actor.branches[0]?.id ?? "";

  const columns: DataTableColumn<DocumentView>[] = [
    {
      key: "name",
      header: "Tài liệu",
      cell: (row) => (
        <div>
          <p className="font-medium">{row.name}</p>
          <p className="text-xs text-muted-foreground">
            v{row.version} · {DOCUMENT_CATEGORY_LABELS[row.category] ?? row.category}
          </p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Loại",
      cell: (row) => (
        <Badge tone={row.storageKey ? "info" : "neutral"}>
          {row.storageKey ? "File nội bộ" : "Link"}
        </Badge>
      ),
    },
    {
      key: "visibility",
      header: "Phạm vi",
      cell: (row) => DOCUMENT_VISIBILITY_LABELS[row.visibility] ?? row.visibility,
    },
    {
      key: "owner",
      header: "Người tải",
      cell: (row) => row.uploadedByName ?? "—",
    },
    {
      key: "created",
      header: "Ngày",
      cell: (row) => <DateTimeText value={row.createdAt} />,
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (row) =>
        row.storageKey ? (
          <Button asChild variant="outline" size="sm">
            <a href={`/api/documents/${row.id}/download`}>Tải file</a>
          </Button>
        ) : row.url?.startsWith("/") ? (
          <Button asChild variant="outline" size="sm">
            <Link href={row.url}>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              Mở
            </Link>
          </Button>
        ) : (
          <Button asChild variant="outline" size="sm">
            <a href={row.url ?? "#"} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              Mở
            </a>
          </Button>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Tài liệu"
        description="Link hoặc file nội bộ có kiểm tra quyền; phiên bản tăng theo tên/danh mục."
        actions={
          canManage ? (
            <>
              <DocumentLinkSheet branches={actor.branches} defaultBranchId={defaultBranchId} />
              <DocumentUploadSheet branches={actor.branches} defaultBranchId={defaultBranchId} />
            </>
          ) : null
        }
      />
      <form method="get" className="mb-4 rounded-xl border border-border bg-surface p-4">
        <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
          <div>
            <Label htmlFor="doc-filter-q">Tìm kiếm</Label>
            <Input id="doc-filter-q" name="q" defaultValue={params.q ?? ""} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="doc-filter-category">Danh mục</Label>
            <Select id="doc-filter-category" name="category" defaultValue={params.category ?? ""} className="mt-1.5">
              <option value="">Tất cả</option>
              {DOCUMENT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {DOCUMENT_CATEGORY_LABELS[category]}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" size="sm">Lọc</Button>
        </div>
      </form>
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        caption="Danh sách tài liệu"
        empty={
          <EmptyState
            icon={<FileText className="h-6 w-6" aria-hidden />}
            title="Chưa có tài liệu"
            description="Thêm link hoặc tải file nội bộ có kiểm tra quyền."
          />
        }
      />
    </div>
  );
}
