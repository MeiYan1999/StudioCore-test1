"use strict";

const { execFile } = require("node:child_process");

const CONTEXT_MENU_KEY = "HKCU\\Software\\Classes\\Directory\\shell\\StudioCoreDrive";
const WINDOWS_RUN_KEY = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
const KEYS = [CONTEXT_MENU_KEY];

function reg(args) {
  return new Promise((resolve, reject) => {
    execFile("reg.exe", args, { windowsHide: true }, (error) => (error ? reject(error) : resolve()));
  });
}

/**
 * Windows: thêm/gỡ mục "Chia sẻ bằng StudioCore Drive" khi chuột phải thư mục (chỉ cho người dùng hiện tại,
 * không cần quyền quản trị). macOS dùng "Mở bằng → StudioCore Drive" khai báo sẵn trong Info.plist.
 * Tham số được truyền qua execFile dạng mảng nên tên thư mục không bao giờ đi qua shell.
 */
async function setWindowsContextMenu(enabled, exePath) {
  if (process.platform !== "win32") return false;
  for (const key of KEYS) {
    if (enabled) {
      await reg(["add", key, "/ve", "/d", "Chia sẻ bằng StudioCore Drive", "/f"]);
      await reg(["add", key, "/v", "Icon", "/d", `"${exePath}"`, "/f"]);
      await reg(["add", `${key}\\command`, "/ve", "/d", `"${exePath}" --share "%1"`, "/f"]);
    } else {
      await reg(["delete", key, "/f"]).catch(() => undefined);
    }
  }
  return true;
}

/** Lấy thư mục cần chia sẻ từ tham số dòng lệnh (`--share <đường dẫn>`). */
function sharePathFromArgv(argv) {
  const inlineArg = argv.find((arg) => typeof arg === "string" && arg.startsWith("--share="));
  if (inlineArg) return inlineArg.slice("--share=".length) || null;
  const index = argv.indexOf("--share");
  if (index < 0 || index + 1 >= argv.length) return null;
  const value = argv[index + 1];
  return typeof value === "string" && value.length > 0 && !value.startsWith("--") ? value : null;
}

module.exports = { CONTEXT_MENU_KEY, WINDOWS_RUN_KEY, setWindowsContextMenu, sharePathFromArgv };
