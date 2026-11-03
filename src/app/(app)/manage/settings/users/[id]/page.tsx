import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { ForbiddenState } from "@/components/shared/forbidden-state";
import { StaffEditForm } from "@/components/manage/staff-edit-form";
import { hasPermission } from "@/lib/auth/permissions";
import { ASSIGNABLE_ROLES, ROLE_LABELS } from "@/lib/auth/roles";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getStaffDetail } from "@/lib/services/staff-service";

export const metadata = {
  title: "Cập nhật nhân sự",
};

export default async function StaffDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireActor();

  if (!hasPermission(actor.permissions, "settings.manage")) {
    return (
      <ForbiddenState description="Chỉ chủ studio có quyền cập nhật người dùng." />
    );
  }

  const { id } = await params;
  const staff = getStaffDetail(getDb(), actor, id);

  if (!staff) {
    notFound();
  }

  const roleOptions = [
    ...(staff.role === "owner" ? [{ value: "owner", label: ROLE_LABELS.owner }] : []),
    ...ASSIGNABLE_ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] })),
  ];

  return (
    <div>
      <PageHeader
        title="Cập nhật nhân sự"
        description={`${staff.name} · ${staff.code} · ${staff.roleLabel}`}
        actions={
          <Button asChild variant="outline">
            <Link href="/manage/settings/users">Quay lại danh sách</Link>
          </Button>
        }
      />

      <StaffEditForm
        staff={staff}
        branches={actor.branches}
        roleOptions={roleOptions}
        isSelf={actor.staffId === staff.id}
      />
    </div>
  );
}
