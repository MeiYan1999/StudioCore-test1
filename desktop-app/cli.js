#!/usr/bin/env node
const fs = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { Store } = require("./src/store");
const { DesktopApp } = require("./src/gui");
const integration = require("./src/os-integration");

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if (["--no-tunnel", "--no-open"].includes(key)) {
      options[key === "--no-tunnel" ? "noTunnel" : "noOpen"] = true;
      continue;
    }
    if (
      !["--path", "--kind", "--title", "--customer", "--pin", "--max", "--days"].includes(key) ||
      args[index + 1] === undefined
    )
      throw new Error(`Tham số không hợp lệ: ${key}`);
    options[key.slice(2)] = args[++index];
  }
  return options;
}
async function running(store) {
  try {
    const { port } = store.read("gui.json", {});
    if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
    const token = (await fs.readFile(path.join(store.directory, "gui-token"), "utf8")).trim();
    const origin = `http://127.0.0.1:${port}`;
    const call = async (route, body) => {
      const response = await fetch(origin + route, {
        method: body === undefined ? "GET" : "POST",
        headers: { "X-SC-Token": token, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(3000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      return result;
    };
    if ((await call("/api/ping")).app !== "StudioCoreDrive") return null;
    return { origin, call };
  } catch {
    return null;
  }
}
async function main(args = process.argv.slice(2)) {
  const command = args.shift() || "gui";
  const store = new Store();
  const options = parseArgs(args);
  if (["install-context", "uninstall-context"].includes(command))
    return integration.contextMenu(command === "install-context");
  if (["autostart-on", "autostart-off"].includes(command)) {
    await integration.autoStart(command === "autostart-on");
    store.saveConfig({ ...store.loadConfig(), autoStart: command === "autostart-on" });
    return;
  }
  if (command === "status") {
    const config = store.loadConfig();
    console.log(
      JSON.stringify(
        {
          directory: store.directory,
          running: Boolean(await running(store)),
          serverUrl: config.serverUrl,
          deviceName: config.deviceName,
          connectKey: config.connectKey ? "Đã thiết lập" : "Chưa thiết lập",
          tunnelMode: config.tunnel.mode,
          autoStart: config.autoStart,
          shareCount: store.loadShares().length,
        },
        null,
        2,
      ),
    );
    return;
  }
  let existing = await running(store);
  if (command === "uninstall") {
    if (existing) await existing.call("/api/shutdown", {}).catch(() => {});
    await integration.contextMenu(false);
    await integration.autoStart(false);
    store.saveConfig({ ...store.loadConfig(), autoStart: false });
    return;
  }
  if (!["gui", "open", "daemon", "share"].includes(command))
    throw new Error("Lệnh: gui, open, daemon, status, share.");
  if (
    command === "share" &&
    (!options.path || !["album", "view", "folder", "video"].includes(options.kind))
  )
    throw new Error("Dùng share --path P --kind album|view|video|folder");
  if (!existing && command === "share") {
    const child = spawn(
      process.execPath,
      [__filename, "daemon", ...(options.noTunnel ? ["--no-tunnel"] : [])],
      { detached: true, stdio: "ignore", windowsHide: true },
    );
    child.unref();
    for (let tries = 0; tries < 100 && !existing; tries++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      existing = await running(store);
    }
    if (!existing)
      throw new Error(
        "Không khởi động được StudioCore Drive. Hãy chạy node cli.js gui để xem lỗi.",
      );
  }
  if (existing) {
    let hash = "";
    if (command === "share")
      hash = (
        await existing.call("/api/handoff", {
          path: path.resolve(options.path),
          kind: options.kind,
        })
      ).hash;
    if (command !== "daemon" && !options.noOpen)
      await integration.openPath(existing.origin + "/" + hash);
    return;
  }
  const app = new DesktopApp(store, { noTunnel: options.noTunnel });
  try {
    await app.start();
  } catch (error) {
    if (error.code === "EEXIST") {
      for (let tries = 0; tries < 50 && !existing; tries++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        existing = await running(store);
      }
      if (existing) {
        if (command !== "daemon" && !options.noOpen) await integration.openPath(existing.origin);
        return;
      }
    }
    throw error;
  }
  console.log(`StudioCore Drive GUI: http://127.0.0.1:${app.port}`);
  let stopping = false;
  const stop = async () => {
    if (!stopping) {
      stopping = true;
      await app.stop();
    }
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  if (command !== "daemon" && !options.noOpen)
    await integration
      .openPath(`http://127.0.0.1:${app.port}`)
      .catch((error) => console.error(error.message));
}
if (require.main === module)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
module.exports = { main, parseArgs, running };
