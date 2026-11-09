#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { exec, spawnSync } = require("node:child_process");
const { AgentClient, saveConfig } = require("./src/agent-client");

const args = process.argv.slice(2);
const command = args[0] || "start";

const agent = new AgentClient();

function openBrowser(url) {
  if (process.platform === "darwin") {
    exec(`open "${url}"`, () => {});
  } else if (process.platform === "win32") {
    // In Windows cmd, start requires empty title before URL when quoted: start "" "url"
    exec(`start "" "${url}"`, () => {});
  } else {
    exec(`xdg-open "${url}"`, () => {});
  }
}

// Copy to system clipboard synchronously
function copyToClipboard(text) {
  try {
    if (process.platform === "darwin") {
      spawnSync("pbcopy", { input: text });
    } else if (process.platform === "win32") {
      spawnSync("clip", { input: text });
    }
  } catch {
    // Ignore clipboard error
  }
}

// OS Native Dialog Box
function showDialog(title, message, isError = false) {
  if (process.platform === "win32") {
    const vbsPath = path.join(__dirname, "windows", "dialog.vbs");
    if (fs.existsSync(vbsPath)) {
      try {
        spawnSync("wscript.exe", [vbsPath, title, message, isError ? "error" : "info"], {
          stdio: "ignore",
          timeout: 60000,
        });
        return;
      } catch {
        // Fallback to PowerShell
      }
    }

    try {
      const icon = isError ? "Error" : "Information";
      const ps = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('${message.replace(/'/g, "''").replace(/\n/g, "`n")}', '${title.replace(/'/g, "''")}', [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::${icon})`;
      spawnSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", ps], {
        stdio: "ignore",
        timeout: 60000,
      });
    } catch {
      // Ignore
    }
  } else if (process.platform === "darwin") {
    try {
      const escaped = message.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      const script = `display dialog "${escaped}" with title "${title}" buttons {"OK"} default button "OK"${isError ? " with icon stop" : ""}`;
      spawnSync("osascript", ["-e", script], { stdio: "ignore", timeout: 60000 });
    } catch {
      // Ignore
    }
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
    const errMsg = "Vui lòng cung cấp đường dẫn thư mục: studiocore-drive share <path>";
    console.error(errMsg);
    showDialog("StudioCore Drive — Lỗi", errMsg, true);
    process.exit(1);
  }

  console.log(`\n📸 StudioCore Drive — Đang quét thư mục: ${targetPath}...`);
  try {
    const result = await agent.createShare(targetPath, shareType);
    if (result && (result.publicUrl || result.lanUrl)) {
      const chosenUrl = result.lanUrl || result.publicUrl;
      // 1. Sao chép link vào clipboard (ưu tiên LAN IP nếu localhost)
      copyToClipboard(chosenUrl);
      console.log(`\n✅ TẠO LINK CHIA SẺ THÀNH CÔNG!`);
      console.log(`🔗 Link máy này: ${result.publicUrl}`);
      if (result.lanUrl && result.lanUrl !== result.publicUrl) {
        console.log(`📱 Link cho điện thoại / máy khác (cùng Wi-Fi): ${result.lanUrl}`);
      }
      console.log(`📋 Đã tự động sao chép link vào clipboard của bạn.`);

      // 2. Tự động mở trình duyệt xem thử
      openBrowser(result.publicUrl);

      // 3. Hiện hộp thoại thông báo hoàn tất trên màn hình
      const title = result.title || path.basename(targetPath);
      let dialogMsg = `ĐÃ TẠO LINK CHIA SẺ THÀNH CÔNG!\n\nThư mục: ${title}\nLink: ${chosenUrl}`;
      if (result.lanUrl && result.lanUrl !== result.publicUrl) {
        dialogMsg += `\n\n📱 Link mở trên điện thoại / máy khác (cùng Wi-Fi):\n${result.lanUrl}`;
      }
      dialogMsg += `\n\n✓ Đã tự động copy link vào bộ nhớ tạm (Clipboard).\n✓ Lưu ý: Để gửi khách từ xa qua 4G/Internet, chỉ cần cài đặt Tên miền SaaS chính thức.`;
      showDialog("StudioCore Drive — Thành công", dialogMsg, false);
    } else {
      console.error("❌ Không thể tạo link:", result);
      showDialog(
        "StudioCore Drive — Lỗi",
        "Không thể tạo link chia sẻ cho thư mục này. Vui lòng kiểm tra lại quyền truy cập thư mục.",
        true,
      );
    }
  } catch (err) {
    console.error("❌ Lỗi:", err.message);
    showDialog(
      "StudioCore Drive — Lỗi",
      `Đã xảy ra lỗi khi tạo link chia sẻ:\n${err.message}`,
      true,
    );
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
