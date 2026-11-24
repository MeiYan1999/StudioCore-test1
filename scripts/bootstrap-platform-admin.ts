import { bootstrapPlatformAdmin } from "../src/lib/auth/platform-admin";
import { getDb } from "../src/lib/db/client";

const login = process.env.PLATFORM_ADMIN_LOGIN;
const hash = process.env.PLATFORM_ADMIN_PASSWORD_HASH;

if (login && hash && bootstrapPlatformAdmin(getDb(), login, hash)) {
  console.log("[Platform Admin] Đã tạo tài khoản quản trị nền tảng.");
}
