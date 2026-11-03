import { NextResponse } from "next/server";
import { and, count, eq, gte } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { sessions } from "@/lib/db/schema";
import { createSession } from "@/lib/auth/session-core";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { findTenantDemoOwner } from "@/lib/services/onboarding-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEMO_TTL_MINUTES = 30;
const DEMO_WINDOW_MINUTES = 60;
const MAX_DEMO_SESSIONS_PER_IP = 5;

export async function GET(request: Request): Promise<Response> {
  const db = getDb();
  const owner = findTenantDemoOwner(db);
  if (!owner) {
    return NextResponse.redirect(
      new URL("/register?reason=demo-unavailable", request.url),
    );
  }
  const headerStore = request.headers;
  const forwardedFor = headerStore.get("x-forwarded-for");
  const ip =
    forwardedFor?.split(",")[0]?.trim() ||
    headerStore.get("x-real-ip") ||
    "127.0.0.1";
  const since = new Date(Date.now() - DEMO_WINDOW_MINUTES * 60 * 1000);
  const recent =
    db
      .select({ value: count() })
      .from(sessions)
      .where(
        and(
          eq(sessions.tenantId, owner.tenantId),
          eq(sessions.ip, ip),
          eq(sessions.readOnly, true),
          gte(sessions.createdAt, since),
        ),
      )
      .get()?.value ?? 0;
  if (recent >= MAX_DEMO_SESSIONS_PER_IP) {
    return new Response(
      "Bạn đã mở quá nhiều phiên demo. Vui lòng thử lại sau ít phút.",
      { status: 429 },
    );
  }
  const session = await createSession(db, {
    tenantId: owner.tenantId,
    staffId: owner.staffId,
    activeBranchId: null,
    ip,
    userAgent: headerStore.get("user-agent") ?? "demo",
    readOnly: true,
    ttlMinutes: DEMO_TTL_MINUTES,
  });
  const response = NextResponse.redirect(
    new URL("/manage/dashboard?demo=1", request.url),
  );
  response.cookies.set({
    name: SESSION_COOKIE,
    value: session.token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: session.expiresAt,
  });
  return response;
}
