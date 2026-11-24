import { bootstrapPlatformAdmin, PlatformAdminConflictError } from "../src/lib/auth/platform-admin";
import { getDb } from "../src/lib/db/client";

const login = process.env.PLATFORM_ADMIN_LOGIN;
const hash = process.env.PLATFORM_ADMIN_PASSWORD_HASH;

if (login && hash) {
  try {
    if (bootstrapPlatformAdmin(getDb(), login, hash)) {
      console.log("[Platform Admin] Đã tạo tài khoản quản trị nền tảng.");
    }
  } catch (error) {
    if (!(error instanceof PlatformAdminConflictError)) throw error;
    console.error(`[Platform Admin] Bỏ qua khởi tạo: ${error.message}`);
  }
}
