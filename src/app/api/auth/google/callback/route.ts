import { headers } from "next/headers";
import { NextResponse } from "next/server";
import {
  exchangeGoogleLoginCode,
  fetchGoogleUserProfile,
  findStaffByGoogleEmail,
  getGoogleLoginRedirectUri,
  isStudioOwnerOrManager,
  verifyGoogleLoginStateToken,
} from "@/lib/auth/google-auth-service";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { createSession, getAllowedBranches } from "@/lib/auth/session-core";
import { writeAudit } from "@/lib/audit";
import { getDb } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL("/login?error=google_cancelled", request.url),
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/login?error=invalid_request", request.url),
    );
  }

  const validState = await verifyGoogleLoginStateToken(state);
  if (!validState) {
    return NextResponse.redirect(
      new URL("/login?error=invalid_state", request.url),
    );
  }

  const redirectUri = getGoogleLoginRedirectUri(request);

  let tokens;
  try {
    tokens = await exchangeGoogleLoginCode(code, redirectUri);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Xác thực thất bại";
    return NextResponse.redirect(
      new URL(`/login?error=google_failed&message=${encodeURIComponent(msg)}`, request.url),
    );
  }

  let profile;
  try {
    profile = await fetchGoogleUserProfile(tokens.accessToken);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Không lấy được thông tin email";
    return NextResponse.redirect(
      new URL(`/login?error=google_failed&message=${encodeURIComponent(msg)}`, request.url),
    );
  }

  const db = getDb();
  const row = findStaffByGoogleEmail(db, profile.email);

  if (!row) {
    return NextResponse.redirect(
      new URL(
        `/login?error=user_not_found&email=${encodeURIComponent(profile.email)}`,
        request.url,
      ),
    );
  }

  if (!row.staff.active || row.staff.archivedAt !== null || row.tenant.status !== "active") {
    return NextResponse.redirect(
      new URL("/login?error=account_disabled", request.url),
    );
  }

  // Regular staff members must log in with employee code and PIN
  if (!isStudioOwnerOrManager(row.staff.role)) {
    return NextResponse.redirect(
      new URL(
        `/login?error=staff_pin_required&code=${encodeURIComponent(row.staff.code)}&name=${encodeURIComponent(row.staff.name)}`,
        request.url,
      ),
    );
  }

  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for");
  const ip =
    forwardedFor?.split(",")[0]?.trim() ||
    headerStore.get("x-real-ip") ||
    "127.0.0.1";
  const userAgent = (headerStore.get("user-agent") ?? "").slice(0, 500);

  const branches = getAllowedBranches(db, row.staff.id, row.tenant.id, row.staff.role);
  const activeBranchId = row.staff.role === "owner" ? null : branches[0]?.id ?? null;

  const session = await createSession(db, {
    tenantId: row.tenant.id,
    staffId: row.staff.id,
    activeBranchId,
    ip,
    userAgent,
  });

  writeAudit(db, {
    tenantId: row.tenant.id,
    actorId: row.staff.id,
    action: "auth.login.google.success",
    entity: "auth",
    metadata: { email: profile.email, role: row.staff.role, ip },
  });

  const destination = row.staff.role === "platform_admin" ? "/platform" : "/manage/dashboard";
  const redirectResponse = NextResponse.redirect(new URL(destination, request.url));

  redirectResponse.cookies.set({
    name: SESSION_COOKIE,
    value: session.token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: session.expiresAt,
  });

  return redirectResponse;
}
