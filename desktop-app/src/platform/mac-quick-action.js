"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFile } = require("node:child_process");

const QUICK_ACTION_NAME = "Chia sẻ bằng StudioCore Drive";

function updateServices(execFileImpl) {
  return new Promise((resolve) => {
    try {
      execFileImpl("/System/Library/CoreServices/pbs", ["-update"], { timeout: 15000 }, () => resolve());
    } catch {
      resolve();
    }
  });
}

async function installMacQuickAction({
  templateDir,
  servicesDir = path.join(os.homedir(), "Library", "Services"),
  execFileImpl = execFile,
}) {
  const contentsDir = path.join(servicesDir, `${QUICK_ACTION_NAME}.workflow`, "Contents");
  const templates = await Promise.all(
    ["Info.plist", "document.wflow"].map(async (fileName) => ({
      fileName,
      content: await fs.promises.readFile(path.join(templateDir, fileName)),
    })),
  );
  await fs.promises.mkdir(contentsDir, { recursive: true });

  let changed = false;
  try {
    for (const { fileName, content } of templates) {
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
  } finally {
    if (changed) await updateServices(execFileImpl);
  }

  return { changed };
}

async function removeMacQuickAction({
  servicesDir = path.join(os.homedir(), "Library", "Services"),
  execFileImpl = execFile,
}) {
  const bundlePath = path.join(servicesDir, `${QUICK_ACTION_NAME}.workflow`);
  let existed = true;
  try {
    await fs.promises.lstat(bundlePath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    existed = false;
  }
  await fs.promises.rm(bundlePath, { recursive: true, force: true });
  if (existed) await updateServices(execFileImpl);
}

module.exports = { QUICK_ACTION_NAME, installMacQuickAction, removeMacQuickAction };
