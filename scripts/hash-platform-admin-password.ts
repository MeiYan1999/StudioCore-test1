import { readFileSync } from "node:fs";
import { hashSecret } from "../src/lib/auth/password";
import { newStaffPasswordSchema } from "../src/lib/validators/staff";

const password = newStaffPasswordSchema.safeParse(readFileSync(0, "utf8"));
if (password.success) {
  console.log(hashSecret(password.data));
} else {
  console.error("Mật khẩu phải có từ 8 đến 128 ký tự.");
  process.exitCode = 1;
}
