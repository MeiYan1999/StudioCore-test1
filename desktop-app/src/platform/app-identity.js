"use strict";

const APP_USER_MODEL_ID = "vn.io.studiocore.drive";
const LEGACY_WINDOWS_LOGIN_ITEM_NAME = "electron.app.StudioCore Drive";

function setWindowsAppUserModelId(app, platform = process.platform) {
  if (platform === "win32") app.setAppUserModelId(APP_USER_MODEL_ID);
}

function applyLoginItem(app, enabled, platform = process.platform) {
  if (platform === "win32") {
    app.setLoginItemSettings({ openAtLogin: false, name: LEGACY_WINDOWS_LOGIN_ITEM_NAME });
    app.setLoginItemSettings({ openAtLogin: enabled, args: ["--hidden"], name: APP_USER_MODEL_ID });
    return;
  }
  app.setLoginItemSettings({ openAtLogin: enabled, args: ["--hidden"] });
}

module.exports = {
  APP_USER_MODEL_ID,
  LEGACY_WINDOWS_LOGIN_ITEM_NAME,
  applyLoginItem,
  setWindowsAppUserModelId,
};
