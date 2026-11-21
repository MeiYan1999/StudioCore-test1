#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { exec, execFile, spawnSync } = require("node:child_process");
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
    process.exitCode = 1;
    return;
  }

  console.log(`\n📸 StudioCore Drive — Đang quét thư mục: ${targetPath}...`);
  try {
    const result = await agent.createShare(targetPath, shareType);
    if (result && (result.publicUrl || result.lanUrl)) {
      const isLocalhost = (result.publicUrl || "").includes("localhost") || (result.publicUrl || "").includes("127.0.0.1");
      const chosenUrl = isLocalhost ? (result.lanUrl || result.publicUrl) : result.publicUrl;

      // 1. Sao chép link vào clipboard
      copyToClipboard(chosenUrl);
      console.log(`\n✅ TẠO LINK CHIA SẺ THÀNH CÔNG!`);
      console.log(`🔗 Link gửi khách: ${chosenUrl}`);
      if (isLocalhost && result.lanUrl && result.lanUrl !== result.publicUrl) {
        console.log(`📱 Link nội bộ cùng Wi-Fi: ${result.lanUrl}`);
      }
      console.log(`📋 Đã tự động sao chép link vào clipboard của bạn.`);

      // 2. Tự động mở trình duyệt xem thử
      openBrowser(chosenUrl);

      // 3. Hiện hộp thoại thông báo hoàn tất trên màn hình
      const title = result.title || path.basename(targetPath);
      let dialogMsg = `ĐÃ TẠO LINK CHIA SẺ THÀNH CÔNG!\n\nThư mục: ${title}\nLink: ${chosenUrl}`;
      if (isLocalhost && result.lanUrl && result.lanUrl !== result.publicUrl) {
        dialogMsg += `\n\n📱 Link mở trên điện thoại / máy khác (cùng Wi-Fi):\n${result.lanUrl}`;
      }
      dialogMsg += `\n\n✓ Đã tự động copy link vào bộ nhớ tạm (Clipboard).\n✓ Bạn có thể nhấn Ctrl + V để dán ngay vào Zalo hoặc Messenger gửi cho khách!`;
      showDialog("StudioCore Drive — Thành công", dialogMsg, false);
    } else {
      console.error("❌ Không thể tạo link:", result);
      process.exitCode = 1;
      showDialog(
        "StudioCore Drive — Lỗi",
        "Không thể tạo link chia sẻ cho thư mục này. Vui lòng kiểm tra lại quyền truy cập thư mục.",
        true,
      );
    }
  } catch (err) {
    console.error("❌ Lỗi:", err.message);
    process.exitCode = 1;
    showDialog(
      "StudioCore Drive — Lỗi",
      `Đã xảy ra lỗi khi tạo link chia sẻ:\n${err.message}`,
      true,
    );
  }
}

function runFileDialog(file, fileArgs) {
  return new Promise((resolve) => {
    execFile(file, fileArgs, { windowsHide: true, timeout: 10 * 60 * 1000 }, (err, stdout) => {
      if (err) {
        resolve({ error: err });
        return;
      }
      resolve({ path: String(stdout).trim() || null });
    });
  });
}

// Native folder picker: browsers cannot expose absolute folder paths to the local UI.
async function pickFolder() {
  const prompt = "Chọn thư mục ảnh/video cần chia sẻ";
  let result;
  if (process.platform === "darwin") {
    result = await runFileDialog("osascript", [
      "-e",
      `POSIX path of (choose folder with prompt "${prompt}")`,
    ]);
  } else if (process.platform === "win32") {
    const ps = [
      "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
      "Add-Type -AssemblyName System.Windows.Forms",
      "$owner = New-Object System.Windows.Forms.Form -Property @{TopMost = $true}",
      "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
      `$dialog.Description = '${prompt}'`,
      "if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dialog.SelectedPath }",
    ].join("; ");
    result = await runFileDialog("powershell", ["-NoProfile", "-NonInteractive", "-STA", "-Command", ps]);
  } else {
    result = await runFileDialog("zenity", ["--file-selection", "--directory", `--title=${prompt}`]);
    if (result.error && result.error.code === "ENOENT") {
      return { unsupported: true };
    }
  }
  if (result.path) return { path: result.path };
  return { cancelled: true };
}

const MAX_BODY_BYTES = 64 * 1024;
const CONFIG_FIELDS = {
  serverUrl: "string",
  connectKey: "string",
  autoFilterRaw: "boolean",
  chimeSound: "boolean",
};

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(data));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY_BYTES) {
        reject(new Error("Dữ liệu gửi lên quá lớn."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Dữ liệu JSON không hợp lệ."));
      }
    });
    req.on("error", reject);
  });
}

function pickConfigUpdates(updates) {
  const picked = {};
  for (const [key, type] of Object.entries(CONFIG_FIELDS)) {
    if (updates && typeof updates[key] === type) {
      picked[key] = type === "string" ? updates[key].trim() : updates[key];
    }
  }
  if (picked.serverUrl !== undefined) {
    const parsed = new URL(picked.serverUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Server URL phải bắt đầu bằng http:// hoặc https://");
    }
  }
  return picked;
}

const API_ROUTES = {
  "POST /api/share-folder": async (body) => {
    if (typeof body.path !== "string" || !body.path.trim()) {
      throw new Error("Thiếu đường dẫn thư mục cần chia sẻ.");
    }
    return agent.createShare(body.path, body.type || null);
  },
  "POST /api/pick-folder": async () => pickFolder(),
  "POST /api/delete-share": async (body) => agent.deleteShare(body.shareId),
  "POST /api/toggle-share": async (body) => agent.toggleShareStatus(body.shareId),
  "POST /api/save-config": async (body) => {
    Object.assign(agent.config, pickConfigUpdates(body));
    saveConfig(agent.config);
    agent.ping().catch(() => {});
    return { success: true };
  },
};

function agentState() {
  const cfg = agent.reloadConfig();
  return {
    hostname: cfg.hostname,
    os: cfg.os,
    serverUrl: cfg.serverUrl,
    connectKey: cfg.connectKey,
    autoFilterRaw: cfg.autoFilterRaw,
    chimeSound: cfg.chimeSound,
    shares: cfg.shares || [],
    connection: agent.connection,
  };
}

function startLocalUiServer(port = 3888) {
  const uiDir = path.join(__dirname, "src", "ui");
  const host = "127.0.0.1";
  const allowedHosts = new Set([`localhost:${port}`, `127.0.0.1:${port}`]);
  const allowedOrigins = new Set([...allowedHosts].map((h) => `http://${h}`));
  const localUrl = `http://localhost:${port}`;

  const server = http.createServer(async (req, res) => {
    // Chặn DNS rebinding: chỉ phục vụ request gửi tới localhost
    if (!allowedHosts.has(String(req.headers.host || "").toLowerCase())) {
      sendJson(res, 403, { error: "Host không được phép." });
      return;
    }

    const url = new URL(req.url, localUrl);

    if (url.pathname === "/api/state" && req.method === "GET") {
      sendJson(res, 200, agentState());
      return;
    }

    const route = API_ROUTES[`${req.method} ${url.pathname}`];
    if (route) {
      // Chặn CSRF: chỉ nhận POST JSON từ chính giao diện localhost
      const contentType = String(req.headers["content-type"] || "");
      if (!allowedOrigins.has(req.headers.origin) || !contentType.startsWith("application/json")) {
        sendJson(res, 403, { error: "Yêu cầu không hợp lệ." });
        return;
      }
      try {
        const body = await readJsonBody(req);
        agent.reloadConfig();
        sendJson(res, 200, await route(body));
      } catch (e) {
        sendJson(res, e.statusCode === 401 || e.statusCode === 403 ? 401 : 500, { error: e.message });
      }
      return;
    }

    if (url.pathname.startsWith("/api/")) {
      sendJson(res, 404, { error: "Không tìm thấy API." });
      return;
    }

    // Static files in src/ui
    let filePath = path.resolve(uiDir, `.${url.pathname === "/" ? "/index.html" : url.pathname}`);
    if (!filePath.startsWith(uiDir + path.sep) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
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

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.log(`\nℹ️  StudioCore Drive đã chạy sẵn tại ${localUrl} — mở lại bảng điều khiển.`);
      openBrowser(localUrl);
      return;
    }
    console.error("❌ Không thể khởi động giao diện StudioCore Drive:", err.message);
    process.exitCode = 1;
  });

  server.listen(port, host, () => {
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
