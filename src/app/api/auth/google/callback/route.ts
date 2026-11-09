import { headers } from "next/headers";
import { NextResponse } from "next/server";
import {
  exchangeGoogleLoginCode,
  fetchGoogleUserProfile,
  findStaffByGoogleEmail,
  getGoogleLoginRedirectUri,
  isStudioOwnerOrManager,
  resolvePublicUrl,
  verifyGoogleLoginStateToken,
} from "@/lib/auth/google-auth-service";
import { registerTenant } from "@/lib/services/onboarding-service";
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
      resolvePublicUrl("/login?error=google_cancelled", request),
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      resolvePublicUrl("/login?error=invalid_request", request),
    );
  }

  const validState = await verifyGoogleLoginStateToken(state);
  if (!validState) {
    return NextResponse.redirect(
      resolvePublicUrl("/login?error=invalid_state", request),
    );
  }

  const redirectUri = getGoogleLoginRedirectUri(request);

  let tokens;
  try {
    tokens = await exchangeGoogleLoginCode(code, redirectUri);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Xác thực thất bại";
    return NextResponse.redirect(
      resolvePublicUrl(
        `/login?error=google_failed&message=${encodeURIComponent(msg)}`,
        request,
      ),
    );
  }

  let profile;
  try {
    profile = await fetchGoogleUserProfile(tokens.accessToken);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Không lấy được thông tin email";
    return NextResponse.redirect(
      resolvePublicUrl(
        `/login?error=google_failed&message=${encodeURIComponent(msg)}`,
        request,
      ),
    );
  }

  const db = getDb();
  let row = findStaffByGoogleEmail(db, profile.email);

  if (!row) {
    // Tự động khởi tạo Studio mới cho người dùng Google
    const cleanName = (profile.name || "").trim();
    const studioName = cleanName ? `Studio ${cleanName}` : "Studio Mới";
    const ownerName = cleanName || "Chủ Studio";
    const initialPassword = crypto.randomUUID();

    try {
      registerTenant(db, {
        studioName,
        ownerName,
        email: profile.email.toLowerCase().trim(),
        phone: "",
        password: initialPassword,
        branchName: `${studioName} — Cơ sở chính`,
        branchAddress: "Chưa cập nhật",
        branchPhone: "",
      });

      row = findStaffByGoogleEmail(db, profile.email);
    } catch {
      return NextResponse.redirect(
        resolvePublicUrl(
          `/login?error=user_not_found&email=${encodeURIComponent(profile.email)}`,
          request,
        ),
      );
    }
  }

  if (!row) {
    return NextResponse.redirect(
      resolvePublicUrl(
        `/login?error=user_not_found&email=${encodeURIComponent(profile.email)}`,
        request,
      ),
    );
  }

  if (!row.staff.active || row.staff.archivedAt !== null || row.tenant.status !== "active") {
    return NextResponse.redirect(
      resolvePublicUrl("/login?error=account_disabled", request),
    );
  }

  // Regular staff members must log in with employee code and PIN
  if (!isStudioOwnerOrManager(row.staff.role)) {
    return NextResponse.redirect(
      resolvePublicUrl(
        `/login?error=staff_pin_required&code=${encodeURIComponent(row.staff.code)}&name=${encodeURIComponent(row.staff.name)}`,
        request,
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
  const redirectResponse = NextResponse.redirect(resolvePublicUrl(destination, request));

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
