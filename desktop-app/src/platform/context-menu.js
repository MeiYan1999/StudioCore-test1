"use strict";

const { execFile } = require("node:child_process");
const path = require("node:path");
const { CONTEXT_ACTIONS } = require("./context-actions");

const CONTEXT_MENU_KEY = "HKCU\\Software\\Classes\\Directory\\shell\\StudioCoreDrive";
const WINDOWS_RUN_KEY = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
const APP_DIRECTORY = path.resolve(__dirname, "../..");

function reg(args) {
  return new Promise((resolve, reject) => {
    execFile("reg.exe", args, { windowsHide: true }, (error) => (error ? reject(error) : resolve()));
  });
}

function buildContextMenuCommand(exePath, actionId) {
  const action = CONTEXT_ACTIONS.some((item) => item.id === actionId) ? actionId : "open";
  return `"${exePath}" --action=${action} --share="%1"`;
}

function buildContextMenuRegistryEntries(exePath) {
  const entries = [
    { key: CONTEXT_MENU_KEY, value: "MUIVerb", type: "REG_SZ", data: "StudioCore Drive" },
    { key: CONTEXT_MENU_KEY, value: "Icon", type: "REG_SZ", data: `"${exePath}"` },
    { key: CONTEXT_MENU_KEY, value: "SubCommands", type: "REG_SZ", data: "" },
  ];
  CONTEXT_ACTIONS.forEach(({ id, label }, index) => {
    const itemKey = `${CONTEXT_MENU_KEY}\\shell\\${String(index + 1).padStart(2, "0")}${id}`;
    entries.push({ key: itemKey, value: "MUIVerb", type: "REG_SZ", data: label });
    if (id === "folder") {
      entries.push({ key: itemKey, value: "CommandFlags", type: "REG_DWORD", data: "0x40" });
    }
    entries.push({
      key: `${itemKey}\\command`,
      value: "",
      type: "REG_SZ",
      data: buildContextMenuCommand(exePath, id),
    });
  });
  return entries;
}

/**
 * Thêm/gỡ menu phân tầng StudioCore Drive cho thư mục trong Explorer.
 * Các lệnh dùng execFile với mảng đối số, không qua shell.
 */
async function setWindowsContextMenu(enabled, exePath) {
  if (process.platform !== "win32") return false;
  await reg(["delete", CONTEXT_MENU_KEY, "/f"]).catch(() => undefined);
  if (!enabled) return true;

  for (const entry of buildContextMenuRegistryEntries(exePath)) {
    const valueArgs = entry.value ? ["/v", entry.value] : ["/ve"];
    await reg(["add", entry.key, ...valueArgs, "/t", entry.type, "/d", entry.data, "/f"]);
  }
  return true;
}

function isApplicationArgument(argv, index) {
  if (index === 0) return true;
  if (index !== 1 || typeof argv[index] !== "string") return false;
  return argv[index] === "." || path.resolve(argv[index]) === APP_DIRECTORY;
}

/** Lấy thư mục cần chia sẻ từ tham số dòng lệnh (`--share <đường dẫn>`). */
function sharePathFromArgv(argv) {
  const inlineArg = argv.find((arg) => typeof arg === "string" && arg.startsWith("--share="));
  if (inlineArg) {
    const value = inlineArg.slice("--share=".length);
    if (value) return value;
  }

  const index = argv.indexOf("--share");
  if (index < 0) return null;

  const value = argv[index + 1];
  if (
    typeof value === "string" &&
    value.length > 0 &&
    !value.startsWith("--") &&
    !isApplicationArgument(argv, index + 1)
  ) {
    return value;
  }

  const candidates = argv.filter(
    (arg, argIndex) =>
      typeof arg === "string" &&
      arg.length > 0 &&
      !arg.startsWith("--") &&
      !isApplicationArgument(argv, argIndex),
  );
  return candidates.length > 0 ? candidates[candidates.length - 1] : null;
}

module.exports = {
  CONTEXT_MENU_KEY,
  WINDOWS_RUN_KEY,
  buildContextMenuRegistryEntries,
  buildContextMenuCommand,
  setWindowsContextMenu,
  sharePathFromArgv,
};
