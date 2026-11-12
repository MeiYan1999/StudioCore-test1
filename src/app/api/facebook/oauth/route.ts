import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/session";
import { getDb, facebookOauth } from "@/lib/db/client";
import { digest, metaConfig } from "@/lib/omnichannel/meta";
import { assertBranchAccess } from "@/lib/auth/permissions";
export async function GET(request: Request) {
  const actor = await requireActor();
  if (actor.role !== "owner" || actor.readOnly)
    return NextResponse.json(
      { error: "Chỉ chủ studio được kết nối." },
      { status: 403 },
    );
  try {
    const config = metaConfig();
    const branchId =
      new URL(request.url).searchParams.get("branchId") ||
      actor.activeBranchId ||
      actor.branches[0]?.id;
    assertBranchAccess(actor, branchId);
    const state = randomBytes(32).toString("hex");
    getDb()
      .insert(facebookOauth)
      .values({
        state: digest(state),
        tenantId: actor.tenantId,
        sessionId: actor.sessionId,
        branchId,
        expiresAt: Date.now() + 600000,
      })
      .run();
    const url = new URL(
      `https://www.facebook.com/${config.version}/dialog/oauth`,
    );
    url.search = new URLSearchParams({
      client_id: config.appId,
      redirect_uri: config.redirect,
      state,
      scope:
        "pages_show_list,pages_messaging,pages_manage_metadata,pages_read_engagement",
      response_type: "code",
    }).toString();
    return NextResponse.redirect(url);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }
}
