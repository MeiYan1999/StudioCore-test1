import crypto from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import type { AppDb } from "../db/client";
import { staff, tenants } from "../db/schema";
import { getEnv } from "../env";
import { AuthorizationError, ValidationError } from "../errors";
import type { Role } from "./roles";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const STATE_TTL_SECONDS = 10 * 60; // 10 minutes

export type GoogleLoginConfig = {
  configured: boolean;
  clientId: string;
  clientSecret: string;
};

export function getGoogleLoginConfig(): GoogleLoginConfig {
  const clientId =
    process.env.GOOGLE_CLIENT_ID?.trim() ||
    getEnv().GOOGLE_CLIENT_ID?.trim() ||
    "";
  const clientSecret =
    process.env.GOOGLE_CLIENT_SECRET?.trim() ||
    getEnv().GOOGLE_CLIENT_SECRET?.trim() ||
    "";
  return {
    configured: Boolean(clientId && clientSecret),
    clientId,
    clientSecret,
  };
}

export function getGoogleLoginRedirectUri(request?: Request): string {
  const env = getEnv();
  if (env.GOOGLE_AUTH_REDIRECT_URI?.trim()) {
    return env.GOOGLE_AUTH_REDIRECT_URI.trim();
  }
  if (request) {
    const url = new URL(request.url);
    const host =
      request.headers.get("x-forwarded-host") ||
      request.headers.get("host") ||
      url.host;
    const proto =
      request.headers.get("x-forwarded-proto") ||
      (host.includes("localhost") ? "http" : "https");
    return `${proto}://${host}/api/auth/google/callback`;
  }
  return `${env.NEXT_PUBLIC_SITE_URL}/api/auth/google/callback`;
}

function getStateSecret(): Uint8Array {
  return new TextEncoder().encode(getEnv().AUTH_SECRET);
}

export async function createGoogleLoginStateToken(nonce?: string): Promise<string> {
  return new SignJWT({
    purpose: "google_login",
    nonce: nonce ?? crypto.randomUUID(),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS)
    .sign(getStateSecret());
}

export async function verifyGoogleLoginStateToken(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, getStateSecret());
    return payload.purpose === "google_login";
  } catch {
    return false;
  }
}

export function buildGoogleLoginUrl(redirectUri: string, state: string): string {
  const config = getGoogleLoginConfig();
  if (!config.configured) {
    throw new ValidationError("Google OAuth chưa được cấu hình.");
  }
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    prompt: "select_account",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export type GoogleUserProfile = {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

export async function exchangeGoogleLoginCode(
  code: string,
  redirectUri: string,
): Promise<{ accessToken: string; idToken?: string }> {
  const config = getGoogleLoginConfig();
  if (!config.configured) {
    throw new ValidationError("Google OAuth chưa được cấu hình.");
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const payload = (await response.json()) as {
    access_token?: string;
    id_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !payload.access_token) {
    const message =
      payload.error_description || payload.error || "Không thể xác thực với Google.";
    throw new AuthorizationError(`Google OAuth thất bại: ${message}`);
  }

  return {
    accessToken: payload.access_token,
    idToken: payload.id_token,
  };
}

export async function fetchGoogleUserProfile(
  accessToken: string,
): Promise<GoogleUserProfile> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new AuthorizationError("Không thể lấy thông tin tài khoản Google.");
  }

  const profile = (await response.json()) as GoogleUserProfile;
  if (!profile.email) {
    throw new AuthorizationError("Tài khoản Google không có email hợp lệ.");
  }

  return profile;
}

export function findStaffByGoogleEmail(db: AppDb, email: string) {
  const normalized = email.trim().toLowerCase();
  const direct = db
    .select({ staff, tenant: tenants })
    .from(staff)
    .innerJoin(tenants, eq(staff.tenantId, tenants.id))
    .where(eq(staff.email, normalized))
    .get();

  if (direct) {
    return direct;
  }

  // Tự động liên kết email chính thức của Studio với tài khoản Chủ Studio
  if (normalized === "samstudio.hn@gmail.com") {
    const primaryOwner = db
      .select({ staff, tenant: tenants })
      .from(staff)
      .innerJoin(tenants, eq(staff.tenantId, tenants.id))
      .where(eq(staff.id, "staff-sc-owner"))
      .get();

    if (primaryOwner) {
      db.update(staff)
        .set({ email: normalized, updatedAt: new Date() })
        .where(eq(staff.id, "staff-sc-owner"))
        .run();

      return {
        ...primaryOwner,
        staff: {
          ...primaryOwner.staff,
          email: normalized,
        },
      };
    }
  }

  return null;
}

export function isStudioOwnerOrManager(role: Role): boolean {
  return role === "owner" || role === "manager" || role === "platform_admin";
}
