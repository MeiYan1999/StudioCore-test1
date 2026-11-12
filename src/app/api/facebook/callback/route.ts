import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/session";
import { getDb, facebookOauth, facebookPages } from "@/lib/db/client";
import { digest, graph, metaConfig, seal } from "@/lib/omnichannel/meta";
import { writeAudit } from "@/lib/audit";
export async function GET(request: Request) {
  const actor = await requireActor();
  const db = getDb();
  try {
    if (actor.role !== "owner" || actor.readOnly)
      throw new Error("Chỉ chủ studio được kết nối.");
    const params = new URL(request.url).searchParams;
    const state = digest(params.get("state") ?? "");
    const record = db
      .delete(facebookOauth)
      .where(
        and(
          eq(facebookOauth.state, state),
          eq(facebookOauth.sessionId, actor.sessionId),
          eq(facebookOauth.tenantId, actor.tenantId),
        ),
      )
      .returning()
      .get();
    if (!record || record.expiresAt <= Date.now() || !params.get("code"))
      throw new Error("Phiên kết nối hết hạn hoặc đã bị từ chối.");
    const config = metaConfig();
    const response = await fetch(
      `https://graph.facebook.com/${config.version}/oauth/access_token`,
      {
        method: "POST",
        body: new URLSearchParams({
          client_id: config.appId,
          client_secret: config.secret,
          redirect_uri: config.redirect,
          code: params.get("code")!,
        }),
        signal: AbortSignal.timeout(15000),
      },
    );
    const token = await response.json();
    if (!response.ok || !token.access_token)
      throw new Error("Facebook từ chối mã đăng nhập. Hãy kết nối lại.");
    let after = "";
    do {
      const pages = await graph<{
        data: {
          id: string;
          name: string;
          access_token?: string;
          picture?: { data?: { url?: string } };
        }[];
        paging?: { next?: string; cursors?: { after: string } };
      }>(
        `me/accounts?fields=id,name,access_token,picture&limit=100${after ? `&after=${encodeURIComponent(after)}` : ""}`,
        token.access_token,
      );
      for (const page of pages.data) {
        if (!page.access_token) continue;
        const existing = db
          .select()
          .from(facebookPages)
          .where(eq(facebookPages.id, page.id))
          .get();
        if (existing && existing.tenantId !== actor.tenantId) continue;
        db.insert(facebookPages)
          .values({
            id: page.id,
            tenantId: actor.tenantId,
            branchId: record.branchId,
            name: page.name,
            avatar: page.picture?.data?.url,
            token: seal(page.access_token),
            status: "pending",
          })
          .onConflictDoUpdate({
            target: facebookPages.id,
            set: {
              token: seal(page.access_token),
              name: page.name,
              avatar: page.picture?.data?.url,
              status: "pending",
            },
            setWhere: eq(facebookPages.tenantId, actor.tenantId),
          })
          .run();
      }
      after = pages.paging?.next ? (pages.paging.cursors?.after ?? "") : "";
    } while (after);
    writeAudit(db, {
      tenantId: actor.tenantId,
      actorId: actor.staffId,
      action: "facebook.oauth",
      entity: "integration",
    });
    return NextResponse.redirect(
      new URL("/manage/settings/facebook", request.url),
    );
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }
}
