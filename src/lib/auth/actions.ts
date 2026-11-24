"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getFormString, type ActionState } from "@/lib/actions/action-state";
import { writeAudit } from "@/lib/audit";
import { clearSessionCookie, getActorContext, requireActor } from "@/lib/auth/session";
import { changeOwnPassword } from "@/lib/auth/password-change-service";
import { revokeSessionById, setActiveBranch } from "@/lib/auth/session-core";
import { getDb } from "@/lib/db/client";
import { safeReturnTo } from "@/lib/utils";

export async function changePasswordAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActor();
  const result = changeOwnPassword(getDb(), actor, {
    currentPassword: getFormString(formData, "currentPassword"),
    newPassword: getFormString(formData, "newPassword"),
    confirmation: getFormString(formData, "confirmation"),
  });
  if (!result.ok) {
    return { status: "error", message: result.error };
  }

  await clearSessionCookie();
  redirect("/login?passwordChanged=1");
}

export async function logoutAction(): Promise<void> {
  const actor = await getActorContext();

  if (actor) {
    revokeSessionById(getDb(), actor.sessionId, actor.tenantId);
    writeAudit(getDb(), {
      tenantId: actor.tenantId,
      actorId: actor.staffId,
      action: "auth.logout",
      entity: "auth",
      metadata: {},
    });
  }

  await clearSessionCookie();
  redirect("/login");
}

export async function switchBranchAction(formData: FormData): Promise<void> {
  const actor = await getActorContext();
  if (!actor) {
    redirect("/login");
  }

  const branchValue = getFormString(formData, "branchId");
  const branchId = branchValue === "" ? null : branchValue;
  const returnTo = safeReturnTo(getFormString(formData, "returnTo"));

  setActiveBranch(getDb(), actor, branchId);

  writeAudit(getDb(), {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "auth.branch.switch",
    entity: "branch",
    entityId: branchId,
    metadata: { branchId },
  });

  revalidatePath("/manage", "layout");
  redirect(returnTo);
}
