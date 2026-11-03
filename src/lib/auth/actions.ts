"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getFormString } from "@/lib/actions/action-state";
import { writeAudit } from "@/lib/audit";
import { clearSessionCookie, getActorContext } from "@/lib/auth/session";
import { revokeSessionById, setActiveBranch } from "@/lib/auth/session-core";
import { getDb } from "@/lib/db/client";
import { safeReturnTo } from "@/lib/utils";

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
