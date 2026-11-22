"use strict";

const path = require("node:path");
const { execFile } = require("node:child_process");

function macBundlePath(execPath) {
  const bundlePath = path.resolve(execPath, "../../..");
  return bundlePath.endsWith(".app") ? bundlePath : null;
}

function removeMacLoginItems(bundlePath, execFileImpl = execFile) {
  return new Promise((resolve) => {
    const finish = (error) => {
      if (error) resolve({ ok: false, error: error.message || String(error) });
      else resolve({ ok: true });
    };

    try {
      execFileImpl(
        "osascript",
        [
          "-e",
          "on run argv",
          "-e",
          'tell application "System Events" to delete (every login item whose path is (item 1 of argv))',
          "-e",
          "end run",
          bundlePath,
        ],
        { timeout: 30000 },
        finish,
      );
    } catch (error) {
      finish(error);
    }
  });
}

module.exports = { macBundlePath, removeMacLoginItems };
