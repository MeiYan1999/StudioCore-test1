import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { updateRolePermissionsAction } from "@/lib/actions/staff-actions";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { ForbiddenState } from "@/components/shared/forbidden-state";
import { SubmitButton } from "@/components/shared/submit-button";
import { hasPermission } from "@/lib/auth/permissions";
import {
  isRole,
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  ROLE_LABELS,
} from "@/lib/auth/roles";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { listRoleMatrix } from "@/lib/services/staff-service";

export const metadata = {
  title: "Vai trò & quyền",
};

const TENANT_PERMISSION_GROUPS = PERMISSION_GROUPS.map((group) => ({
  ...group,
  permissions: group.permissions.filter((permission) => permission !== "tenants.manage"),
})).filter((group) => group.permissions.length > 0);

export default async function RolesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const actor = await requireActor();

  if (!hasPermission(actor.permissions, "settings.manage")) {
    return (
      <ForbiddenState description="Chỉ chủ studio có quyền chỉnh sửa vai trò và quyền." />
    );
  }

  const { saved, error } = await searchParams;
  const roles = listRoleMatrix(getDb(), actor);

  return (
    <div>
      <PageHeader
        title="Vai trò & quyền"
        description="Quyền được lưu theo tenant và kiểm tra lại ở server cho mọi thao tác. Vai trò chủ studio và quản trị nền tảng không chỉnh sửa tại đây."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/manage/settings">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Cài đặt
            </Link>
          </Button>
        }
      />

      {saved ? (
        <Alert tone="success" className="mb-4">
          Đã cập nhật quyền cho{" "}
          {isRole(saved) ? ROLE_LABELS[saved] : "vai trò đã chọn"}.
        </Alert>
      ) : null}
      {error ? (
        <Alert tone="danger" className="mb-4">
          {error}
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        {roles.map((role) => (
          <Card key={role.role}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>{role.label}</CardTitle>
                <Badge tone={role.readOnly ? "neutral" : "info"}>
                  {role.readOnly ? "Cố định" : `${role.permissions.length} quyền`}
                </Badge>
              </div>
              <CardDescription>{role.description}</CardDescription>
            </CardHeader>
            <CardContent>
              {role.readOnly ? (
                <div className="rounded-lg bg-surface-muted p-4 text-sm text-muted-foreground">
                  {role.role === "owner"
                    ? "Chủ studio có toàn bộ quyền nghiệp vụ trong tenant, trừ quản trị nền tảng. Vai trò này không thể chỉnh sửa."
                    : "Quản trị nền tảng chỉ quản lý vòng đời tenant và gói dịch vụ. Không truy cập dữ liệu nghiệp vụ mặc định."}
                </div>
              ) : (
                <form action={updateRolePermissionsAction} className="space-y-5">
                  <input type="hidden" name="role" value={role.role} />
                  {TENANT_PERMISSION_GROUPS.map((group) => (
                    <fieldset key={group.label}>
                      <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {group.label}
                      </legend>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {group.permissions.map((permission) => {
                          const id = `${role.role}-${permission}`;
                          return (
                            <label
                              key={permission}
                              htmlFor={id}
                              className="flex cursor-pointer items-start gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                            >
                              <input
                                id={id}
                                type="checkbox"
                                name="permissions"
                                value={permission}
                                defaultChecked={role.permissions.includes(permission)}
                                className="mt-1 h-4 w-4 rounded border-[var(--input-border)]"
                              />
                              <span>
                                <span className="block text-foreground">
                                  {PERMISSION_LABELS[permission]}
                                </span>
                                <span className="block font-mono text-[11px] text-muted-foreground">
                                  {permission}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                  ))}
                  <div className="flex justify-end">
                    <SubmitButton pendingLabel="Đang lưu quyền...">
                      Lưu quyền
                    </SubmitButton>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
