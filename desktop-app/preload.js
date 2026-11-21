"use strict";

const { contextBridge, ipcRenderer, webUtils } = require("electron");

const CHANNELS = [
  "state",
  "pair",
  "unpair",
  "pick-folder",
  "preview-folder",
  "create-share",
  "list-shares",
  "update-share",
  "delete-share",
  "rescan-share",
  "copy-picks",
  "copy-text",
  "open-folder",
  "open-link",
  "set-settings",
];

const api = {};
for (const channel of CHANNELS) {
  api[channel.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = (payload) => ipcRenderer.invoke(`drive:${channel}`, payload);
}
api.on = (event, handler) => {
  if (!["status", "submission", "share-request"].includes(event) || typeof handler !== "function") return;
  ipcRenderer.on(`drive:${event}`, (_e, payload) => handler(payload));
};

api.pathForFile = (file) => {
  try {
    return webUtils.getPathForFile(file) || null;
  } catch {
    return null;
  }
};

contextBridge.exposeInMainWorld("drive", Object.freeze(api));
