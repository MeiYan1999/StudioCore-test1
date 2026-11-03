import { Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { ForbiddenState } from "@/components/shared/forbidden-state";
import { Money } from "@/components/shared/money";
import { ProductSheet } from "@/components/catalog/product-sheet";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { PRODUCT_STATUS_LABELS } from "@/lib/catalog/constants";
import { getDb } from "@/lib/db/client";
import { listProducts, type ProductItem } from "@/lib/services/catalog-service";

export const metadata = {
  title: "Sản phẩm",
};

export default async function ProductsPage() {
  const actor = await requireActor();

  if (!hasPermission(actor.permissions, "orders.view")) {
    return <ForbiddenState description="Vai trò của bạn không có quyền xem sản phẩm." />;
  }

  const products = listProducts(getDb(), actor);
  const canManage = hasPermission(actor.permissions, "catalog.manage");

  const columns: DataTableColumn<ProductItem>[] = [
    {
      key: "sku",
      header: "Sản phẩm",
      cell: (row) => (
        <div>
          <p className="font-medium text-foreground">{row.name}</p>
          <p className="font-mono text-xs text-muted-foreground">{row.sku}</p>
        </div>
      ),
    },
    {
      key: "category",
      header: "Danh mục",
      cell: (row) => <Badge tone="neutral">{row.category}</Badge>,
    },
    {
      key: "price",
      header: "Giá",
      className: "text-right",
      cell: (row) => <Money value={row.price} />,
    },
    {
      key: "stock",
      header: "Tồn kho",
      className: "text-right",
      cell: (row) => <span className="tabular-nums">{row.stock}</span>,
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (row) => (
        <Badge tone={row.status === "active" ? "success" : "neutral"}>
          {PRODUCT_STATUS_LABELS[row.status] ?? row.status}
        </Badge>
      ),
    },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "",
            className: "text-right",
            cell: (row: ProductItem) => <ProductSheet product={row} />,
          },
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader
        title="Sản phẩm"
        description="Album, ảnh in, khung và vật phẩm bàn giao. Tồn kho ở mức cơ bản cho Phase 2."
        actions={canManage ? <ProductSheet /> : null}
      />

      <DataTable
        columns={columns}
        rows={products}
        getRowKey={(row) => row.id}
        caption="Danh sách sản phẩm"
        empty={
          <EmptyState
            icon={<Package className="h-6 w-6" aria-hidden="true" />}
            title="Chưa có sản phẩm"
            description="Thêm album, ảnh in hoặc vật phẩm bàn giao đầu tiên."
          />
        }
      />
    </div>
  );
}
