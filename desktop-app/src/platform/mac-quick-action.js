"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { CONTEXT_ACTIONS } = require("./context-actions");

const LEGACY_QUICK_ACTION_NAME = "Chia sẻ bằng StudioCore Drive";
const QUICK_ACTION_PREFIX = "StudioCore Drive – ";
const APP_BUNDLE_ID = "vn.io.studiocore.drive";

function quickActionName(action) {
  return `${QUICK_ACTION_PREFIX}${action.label}`;
}

function xmlEscape(value) {
  return value.replace(/[&<>]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
  })[character]);
}

function stableUuid(value) {
  const chars = crypto.createHash("sha256").update(value).digest("hex").slice(0, 32).toUpperCase().split("");
  chars[12] = "5";
  chars[16] = ((parseInt(chars[16], 16) & 0x3) | 0x8).toString(16).toUpperCase();
  const hex = chars.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function replacePlistString(xml, key, value) {
  const pattern = new RegExp(`(<key>${key}</key>\\s*<string>)[^<]*(</string>)`);
  return xml.replace(pattern, `$1${xmlEscape(value)}$2`);
}

function quickActionTemplates(templates, action) {
  const name = quickActionName(action);
  const bundleId = `${APP_BUNDLE_ID}.context.${action.id}`;
  const info = templates.info
    .replace("vn.io.studiocore.drive.share-folder", bundleId)
    .replaceAll(LEGACY_QUICK_ACTION_NAME, xmlEscape(name));
  let workflow = templates.workflow;
  for (const key of ["InputUUID", "OutputUUID", "UUID"]) {
    workflow = replacePlistString(workflow, key, stableUuid(`${action.id}:${key}`));
  }
  workflow = replacePlistString(
    workflow,
    "COMMAND_STRING",
    `open -b ${APP_BUNDLE_ID} --args --action=${action.id} --share="$@"`,
  );
  return { "Info.plist": Buffer.from(info), "document.wflow": Buffer.from(workflow) };
}

function updateServices(execFileImpl) {
  return new Promise((resolve) => {
    try {
      execFileImpl("/System/Library/CoreServices/pbs", ["-update"], { timeout: 15000 }, () => resolve());
    } catch {
      resolve();
    }
  });
}

async function writeChangedFiles(contentsDir, files) {
  await fs.promises.mkdir(contentsDir, { recursive: true });
  let changed = false;
  for (const [fileName, content] of Object.entries(files)) {
    const destination = path.join(contentsDir, fileName);
    let current = null;
    try {
      current = await fs.promises.readFile(destination);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (current && current.equals(content)) continue;
    await fs.promises.writeFile(destination, content);
    changed = true;
  }
  return changed;
}

async function removeBundle(bundlePath) {
  try {
    await fs.promises.lstat(bundlePath);
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
  await fs.promises.rm(bundlePath, { recursive: true, force: true });
  return true;
}

async function installMacQuickActions({
  templateDir,
  servicesDir = path.join(os.homedir(), "Library", "Services"),
  execFileImpl = execFile,
}) {
  const [info, workflow] = await Promise.all([
    fs.promises.readFile(path.join(templateDir, "Info.plist"), "utf8"),
    fs.promises.readFile(path.join(templateDir, "document.wflow"), "utf8"),
  ]);
  const templates = { info, workflow };
  let changed = await removeBundle(path.join(servicesDir, `${LEGACY_QUICK_ACTION_NAME}.workflow`));
  await fs.promises.mkdir(servicesDir, { recursive: true });
  for (const action of CONTEXT_ACTIONS) {
    const contentsDir = path.join(servicesDir, `${quickActionName(action)}.workflow`, "Contents");
    changed = (await writeChangedFiles(contentsDir, quickActionTemplates(templates, action))) || changed;
  }
  if (changed) await updateServices(execFileImpl);
  return { changed };
}

async function removeMacQuickActions({
  servicesDir = path.join(os.homedir(), "Library", "Services"),
  execFileImpl = execFile,
}) {
  let changed = false;
  for (const name of [
    LEGACY_QUICK_ACTION_NAME,
    ...CONTEXT_ACTIONS.map(quickActionName),
  ]) {
    changed = (await removeBundle(path.join(servicesDir, `${name}.workflow`))) || changed;
  }
  if (changed) await updateServices(execFileImpl);
}

module.exports = {
  LEGACY_QUICK_ACTION_NAME,
  QUICK_ACTION_PREFIX,
  quickActionName,
  installMacQuickActions,
  removeMacQuickActions,
};
