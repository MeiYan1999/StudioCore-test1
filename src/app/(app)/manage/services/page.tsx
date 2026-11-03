import { Package, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { ForbiddenState } from "@/components/shared/forbidden-state";
import { Money } from "@/components/shared/money";
import { AddonSheet } from "@/components/catalog/addon-sheet";
import { ServiceSheet } from "@/components/catalog/service-sheet";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { SERVICE_CATEGORY_LABELS } from "@/lib/catalog/constants";
import { getDb } from "@/lib/db/client";
import {
  listServiceAddons,
  listServices,
  type AddonItem,
  type ServiceItem,
} from "@/lib/services/catalog-service";

export const metadata = {
  title: "Dịch vụ",
};

export default async function ServicesPage() {
  const actor = await requireActor();

  if (!hasPermission(actor.permissions, "orders.view")) {
    return <ForbiddenState description="Vai trò của bạn không có quyền xem dịch vụ." />;
  }

  const services = listServices(getDb(), actor);
  const addons = listServiceAddons(getDb(), actor);
  const canManage = hasPermission(actor.permissions, "catalog.manage");

  const serviceColumns: DataTableColumn<ServiceItem>[] = [
    {
      key: "name",
      header: "Dịch vụ",
      cell: (row) => (
        <div className="min-w-44">
          <p className="font-medium text-foreground">{row.name}</p>
          <p className="text-xs text-muted-foreground">
            {SERVICE_CATEGORY_LABELS[row.category] ?? row.category} · {row.branchName}
          </p>
        </div>
      ),
    },
    {
      key: "price",
      header: "Giá",
      className: "text-right",
      cell: (row) => <Money value={row.price} />,
    },
    {
      key: "duration",
      header: "Thời lượng",
      className: "text-right",
      cell: (row) => <span className="tabular-nums">{row.durationMinutes} phút</span>,
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (row) => (
        <Badge tone={row.active ? "success" : "neutral"}>
          {row.active ? "Đang bán" : "Ngừng bán"}
        </Badge>
      ),
    },
    {
      key: "description",
      header: "Mô tả",
      cell: (row) => (
        <span className="line-clamp-2 max-w-72 text-sm text-muted-foreground">
          {row.description ?? "Chưa có"}
        </span>
      ),
    },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "",
            className: "text-right",
            cell: (row: ServiceItem) => <ServiceSheet service={row} branches={actor.branches} />,
          },
        ]
      : []),
  ];

  const addonColumns: DataTableColumn<AddonItem>[] = [
    {
      key: "name",
      header: "Add-on",
      cell: (row) => (
        <div>
          <p className="font-medium text-foreground">{row.name}</p>
          <p className="text-xs text-muted-foreground">{row.serviceName}</p>
        </div>
      ),
    },
    {
      key: "price",
      header: "Giá",
      className: "text-right",
      cell: (row) => <Money value={row.price} />,
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (row) => (
        <Badge tone={row.active ? "success" : "neutral"}>
          {row.active ? "Đang bán" : "Ngừng bán"}
        </Badge>
      ),
    },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "",
            className: "text-right",
            cell: (row: AddonItem) => <AddonSheet addon={row} services={services} />,
          },
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader
        title="Dịch vụ & add-on"
        description="Giá và thời lượng lấy từ danh mục khi tạo đơn hàng. Thay đổi giá không làm thay đổi đơn đã tạo."
        actions={
          canManage ? (
            <>
              {services.length > 0 ? <AddonSheet services={services} /> : null}
              <ServiceSheet branches={actor.branches} />
            </>
          ) : null
        }
      />

      <section aria-labelledby="services-heading">
        <h2 id="services-heading" className="mb-3 text-lg font-semibold text-foreground">
          Dịch vụ
        </h2>
        <DataTable
          columns={serviceColumns}
          rows={services}
          getRowKey={(row) => row.id}
          caption="Danh sách dịch vụ"
          empty={
            <EmptyState
              icon={<Package className="h-6 w-6" aria-hidden="true" />}
              title="Chưa có dịch vụ"
              description="Thêm dịch vụ đầu tiên để có thể tạo đơn hàng."
            />
          }
        />
      </section>

      <section aria-labelledby="addons-heading" className="mt-8">
        <h2 id="addons-heading" className="mb-3 text-lg font-semibold text-foreground">
          Add-on
        </h2>
        <DataTable
          columns={addonColumns}
          rows={addons}
          getRowKey={(row) => row.id}
          caption="Danh sách add-on"
          empty={
            <EmptyState
              icon={<Wrench className="h-6 w-6" aria-hidden="true" />}
              title="Chưa có add-on"
              description="Add-on giúp cộng thêm makeup, album, di chuyển hoặc dịch vụ phụ vào đơn."
            />
          }
        />
      </section>
    </div>
  );
}
