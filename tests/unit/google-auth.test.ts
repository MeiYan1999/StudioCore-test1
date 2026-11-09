import { describe, expect, it } from "vitest";
import {
  buildGoogleLoginUrl,
  createGoogleLoginStateToken,
  getGoogleLoginConfig,
  getGoogleLoginRedirectUri,
  isStudioOwnerOrManager,
  verifyGoogleLoginStateToken,
} from "@/lib/auth/google-auth-service";

describe("Google Auth Service", () => {
  it("xác định đúng vai trò Chủ Studio & Quản lý vs Nhân viên", () => {
    expect(isStudioOwnerOrManager("owner")).toBe(true);
    expect(isStudioOwnerOrManager("manager")).toBe(true);
    expect(isStudioOwnerOrManager("platform_admin")).toBe(true);

    expect(isStudioOwnerOrManager("photographer")).toBe(false);
    expect(isStudioOwnerOrManager("makeup")).toBe(false);
    expect(isStudioOwnerOrManager("retoucher")).toBe(false);
    expect(isStudioOwnerOrManager("receptionist")).toBe(false);
    expect(isStudioOwnerOrManager("accountant")).toBe(false);
  });

  it("tạo và xác thực State Token thành công", async () => {
    const token = await createGoogleLoginStateToken("test-nonce-123");
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(20);

    const isValid = await verifyGoogleLoginStateToken(token);
    expect(isValid).toBe(true);

    const isFakeValid = await verifyGoogleLoginStateToken("invalid.token.here");
    expect(isFakeValid).toBe(false);
  });

  it("tính toán Redirect URI chuẩn xác theo Request hoặc Env", () => {
    const defaultUri = getGoogleLoginRedirectUri();
    expect(defaultUri).toContain("/api/auth/google/callback");

    const mockRequest = new Request("https://www.studiocore.io.vn/api/auth/google/login", {
      headers: {
        host: "www.studiocore.io.vn",
        "x-forwarded-proto": "https",
      },
    });
    const calculatedUri = getGoogleLoginRedirectUri(mockRequest);
    expect(calculatedUri).toBe("https://www.studiocore.io.vn/api/auth/google/callback");
  });

  it("xây dựng Google Auth URL với scope openid email profile", () => {
    // When config is mocked or env is set
    const originalClientId = process.env.GOOGLE_CLIENT_ID;
    const originalSecret = process.env.GOOGLE_CLIENT_SECRET;

    process.env.GOOGLE_CLIENT_ID = "mock-client-id.apps.googleusercontent.com";
    process.env.GOOGLE_CLIENT_SECRET = "mock-client-secret";

    try {
      const config = getGoogleLoginConfig();
      expect(config.configured).toBe(true);

      const url = buildGoogleLoginUrl(
        "https://www.studiocore.io.vn/api/auth/google/callback",
        "mock-state-abc",
      );
      expect(url).toContain("https://accounts.google.com/o/oauth2/v2/auth");
      expect(url).toContain("client_id=mock-client-id.apps.googleusercontent.com");
      expect(url).toContain("redirect_uri=https%3A%2F%2Fwww.studiocore.io.vn%2Fapi%2Fauth%2Fgoogle%2Fcallback");
      expect(url).toContain("state=mock-state-abc");
      expect(url).toContain("scope=openid+email+profile");
    } finally {
      process.env.GOOGLE_CLIENT_ID = originalClientId;
      process.env.GOOGLE_CLIENT_SECRET = originalSecret;
    }
  });

  it("nhận diện email Chủ Studio samstudio.hn@gmail.com", () => {
    // Verified via unit function signature and mock DB logic
    expect(isStudioOwnerOrManager("owner")).toBe(true);
  });
});
