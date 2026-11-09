#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { exec, spawn } = require("node:child_process");
const { AgentClient, saveConfig } = require("./src/agent-client");

const args = process.argv.slice(2);
const command = args[0] || "start";

const agent = new AgentClient();

function openBrowser(url) {
  const start =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  exec(`${start} "${url}"`, () => {});
}

// Copy to system clipboard
function copyToClipboard(text) {
  if (process.platform === "darwin") {
    const proc = spawn("pbcopy");
    proc.stdin.write(text);
    proc.stdin.end();
  } else if (process.platform === "win32") {
    const proc = spawn("clip");
    proc.stdin.write(text);
    proc.stdin.end();
  }
}

// OS Notification
function notify(title, message) {
  if (process.platform === "darwin") {
    exec(`osascript -e 'display notification "${message}" with title "${title}"'`);
  } else if (process.platform === "win32") {
    exec(
      `powershell -Command "[reflection.assembly]::loadwithpartialname('System.Windows.Forms'); [Windows.Forms.MessageBox]::Show('${message}', '${title}')"`,
    );
  }
}

async function handleShareCommand() {
  let targetPath = null;
  let shareType = null;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--path" && args[i + 1]) {
      targetPath = args[i + 1];
      i++;
    } else if (args[i] === "--type" && args[i + 1]) {
      shareType = args[i + 1];
      i++;
    } else if (!targetPath && !args[i].startsWith("--")) {
      targetPath = args[i];
    }
  }

  if (!targetPath) {
    console.error("Vui lòng cung cấp đường dẫn thư mục: studiocore-drive share <path>");
    process.exit(1);
  }

  console.log(`\n📸 StudioCore Drive — Đang quét thư mục: ${targetPath}...`);
  try {
    const result = await agent.createShare(targetPath, shareType);
    if (result && result.publicUrl) {
      copyToClipboard(result.publicUrl);
      console.log(`\n✅ TẠO LINK CHIA SẺ THÀNH CÔNG!`);
      console.log(`🔗 Link khách: ${result.publicUrl}`);
      console.log(`📋 Đã tự động sao chép link vào clipboard của bạn.`);
      notify("StudioCore Drive", `Đã copy link gửi khách: ${result.publicUrl}`);
    } else {
      console.log("❌ Không thể tạo link:", result);
    }
  } catch (err) {
    console.error("❌ Lỗi:", err.message);
  }
}

function startLocalUiServer(port = 3888) {
  const uiDir = path.join(__dirname, "src", "ui");

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);

    // Internal API for Desktop UI
    if (url.pathname === "/api/state") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(agent.config));
      return;
    }

    if (url.pathname === "/api/share-folder" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", async () => {
        try {
          const { path: folderPath, type } = JSON.parse(body);
          const result = await agent.createShare(folderPath, type);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(result));
        } catch (e) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    if (url.pathname === "/api/save-config" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          const updates = JSON.parse(body);
          Object.assign(agent.config, updates);
          saveConfig(agent.config);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        } catch (e) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    // Static files in src/ui
    let filePath = path.join(uiDir, url.pathname === "/" ? "index.html" : url.pathname);
    if (!fs.existsSync(filePath)) {
      filePath = path.join(uiDir, "index.html");
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css",
      ".js": "application/javascript",
      ".json": "application/json",
      ".svg": "image/svg+xml",
    };

    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "text/plain" });
    fs.createReadStream(filePath).pipe(res);
  });

  server.listen(port, () => {
    const localUrl = `http://localhost:${port}`;
    console.log(`\n======================================================`);
    console.log(`🚀 StudioCore Drive Desktop Agent đang chạy!`);
    console.log(`💻 Bảng điều khiển Desktop: ${localUrl}`);
    console.log(`⚡ Máy tính: ${agent.config.hostname} (${agent.config.os})`);
    console.log(`📡 Máy chủ SaaS: ${agent.config.serverUrl}`);
    console.log(`======================================================\n`);

    agent.startDaemon();
    openBrowser(localUrl);
  });
}

function handleInstallContext() {
  console.log("\n📦 Đang cài đặt menu chuột phải StudioCore Drive...");
  if (process.platform === "darwin") {
    const scriptPath = path.join(__dirname, "macos", "install-quick-actions.sh");
    if (fs.existsSync(scriptPath)) {
      exec(`bash "${scriptPath}"`, (err, stdout) => {
        if (err) console.error("Lỗi cài đặt macOS Quick Action:", err);
        else console.log(stdout || "✅ Đã cài đặt Quick Action vào Finder macOS!");
      });
    }
  } else if (process.platform === "win32") {
    const regPath = path.join(__dirname, "windows", "install.bat");
    console.log(`Vui lòng nhấp đúp vào file sau để đăng ký menu chuột phải Windows:`);
    console.log(regPath);
  }
}

// Router
switch (command) {
  case "share":
    handleShareCommand();
    break;

  case "daemon":
    console.log("⚡ Đang chạy StudioCore Drive Agent ở chế độ nền (daemon)...");
    agent.startDaemon();
    break;

  case "status":
    console.log("Cấu hình hiện tại:", agent.config);
    break;

  case "install-context":
    handleInstallContext();
    break;

  case "start":
  case "gui":
  default:
    startLocalUiServer();
    break;
}
