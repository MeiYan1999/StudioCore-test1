"use strict";

const APP_USER_MODEL_ID = "vn.io.studiocore.drive";

function setWindowsAppUserModelId(app, platform = process.platform) {
  if (platform === "win32") app.setAppUserModelId(APP_USER_MODEL_ID);
}

module.exports = { APP_USER_MODEL_ID, setWindowsAppUserModelId };
