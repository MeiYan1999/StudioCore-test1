#!/usr/bin/env node
const { Agent } = require("./src/agent");
const { Store } = require("./src/store");
const { kindLabels } = require("./src/labels");

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if (key === "--no-tunnel") {
      options.noTunnel = true;
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

async function main(args = process.argv.slice(2)) {
  const command = args.shift() || "status";
  const store = new Store();
  if (command === "status") {
    const config = store.loadConfig();
    console.log(
      JSON.stringify(
        {
          dataDirectory: store.directory,
          serverUrl: config.serverUrl,
          deviceName: config.deviceName,
          connectKey: config.connectKey ? "Đã thiết lập" : "Chưa thiết lập",
          tunnelMode: config.tunnel.mode,
          shares: store
            .loadShares()
            .map(({ id, kind, title, status, expiresAt, files }) => ({
              id,
              kind: kindLabels[kind],
              title,
              status,
              expiresAt,
              fileCount: Object.keys(files).length,
            })),
        },
        null,
        2,
      ),
    );
    return;
  }
  const options = parseArgs(args);
  const agent = new Agent(store);
  if (command === "share") {
    if (!options.path || !options.kind)
      throw new Error(
        "Dùng: node cli.js share --path P --kind album|view|video|folder [--title T --customer K --pin PIN --max N --days N]",
      );
    const result = await agent.createShare(options.path, options.kind, {
      title: options.title,
      customer: options.customer,
      pin: options.pin,
      maxSelect: options.max === undefined ? undefined : Number(options.max),
      expiresDays: options.days === undefined ? undefined : Number(options.days),
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (command !== "daemon")
    throw new Error("Lệnh hỗ trợ: daemon, status, share. GUI sẽ có ở phiên bản tiếp theo.");
  agent.on("media", ({ port }) => console.log(`Máy chủ media: http://127.0.0.1:${port}`));
  agent.on("tunnel", ({ status, origin, message }) =>
    console.log(`Tunnel: ${status}${origin ? ` ${origin}` : ""}${message ? ` — ${message}` : ""}`),
  );
  agent.on("warning", (message) => console.error(message));
  agent.on("finalized", ({ shareId }) => console.log(`Khách đã chốt lựa chọn: ${shareId}`));
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    await agent.stop();
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  await agent.start({ noTunnel: options.noTunnel });
  console.log("StudioCore Drive đang chạy. Nhấn Ctrl+C để dừng.");
}

if (require.main === module)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
module.exports = { main, parseArgs };
