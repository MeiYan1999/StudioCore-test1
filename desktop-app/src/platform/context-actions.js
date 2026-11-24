"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

const CONTEXT_ACTIONS = Object.freeze([
  { id: "select", label: "Tạo album chọn ảnh cho khách" },
  { id: "view", label: "Tạo album xem & tải (không chọn)" },
  { id: "folder", label: "Chia sẻ thư mục cho khách tải về" },
  { id: "copylink", label: "Copy link đã chia sẻ" },
  { id: "picks", label: "Lọc ảnh khách chọn" },
  { id: "rescan", label: "Đồng bộ ngay với thư mục" },
  { id: "toggle", label: "Bật / tắt chia sẻ" },
  { id: "open", label: "Mở StudioCore Drive" },
]);

const ACTION_IDS = new Set(CONTEXT_ACTIONS.map(({ id }) => id));

function contextActionFromArgv(argv) {
  const argument = argv.find((item) => typeof item === "string" && item.startsWith("--action="));
  if (!argument) return null;
  const action = argument.slice("--action=".length);
  return ACTION_IDS.has(action) ? action : "open";
}

function contextActionRouteFromArgv(argv) {
  const argument = argv.find((item) => typeof item === "string" && item.startsWith("--action="));
  if (argument && ACTION_IDS.has(argument.slice("--action=".length))) return "context";
  return argv.includes("--hidden") ? "hidden" : "show";
}

function shareOptionsForAction(action) {
  if (action === "select") return { kind: "select", allowOriginal: false, includeAllFiles: false };
  if (action === "view") return { kind: "deliver", allowOriginal: true, includeAllFiles: false };
  if (action === "folder") return { kind: "deliver", allowOriginal: true, includeAllFiles: true };
  return null;
}

function sharesWithPicks(shares) {
  return shares
    .filter((share) => share && typeof share.pickedCount === "number" && share.pickedCount > 0)
    .sort(
      (a, b) =>
        Number(b.submittedAt != null) - Number(a.submittedAt != null) ||
        (b.createdAt || 0) - (a.createdAt || 0),
    );
}

const NO_PICKS_MESSAGE = "Khách chưa chọn ảnh nào.";

async function copyFirstAvailablePicks(shares, copy) {
  let onlyMissing = false;
  for (const share of sharesWithPicks(shares)) {
    let result;
    try {
      result = await copy(share.id);
    } catch (error) {
      if (error.message !== NO_PICKS_MESSAGE) throw error;
      continue;
    }
    if (result.codes.length > 0) return { status: "copied", result };
    onlyMissing = true;
  }
  return { status: onlyMissing ? "missing" : "none" };
}

async function findSharesForFolder(shares, folder, platform = process.platform, realpath = fs.realpath) {
  if (typeof folder !== "string" || !folder) return [];
  let target;
  try {
    target = await realpath(folder);
  } catch {
    return [];
  }
  const normalize = (value) => {
    const normalized = platform === "win32" ? path.win32.normalize(value) : path.normalize(value);
    return platform === "win32" ? normalized.toLowerCase() : normalized;
  };
  const targetPath = normalize(target);
  const matches = [];
  for (const share of shares) {
    if (!share || typeof share.folder !== "string") continue;
    let real;
    try {
      real = await realpath(share.folder);
    } catch {
      continue;
    }
    if (normalize(real) === targetPath) matches.push(share);
  }
  return matches;
}

module.exports = {
  CONTEXT_ACTIONS,
  contextActionFromArgv,
  contextActionRouteFromArgv,
  copyFirstAvailablePicks,
  findSharesForFolder,
  shareOptionsForAction,
  sharesWithPicks,
};
