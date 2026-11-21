const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const run = promisify(execFile);
const cli = path.resolve(__dirname, "..", "cli.js");
const launcher = path.resolve(__dirname, "..", "windows", "hidden.vbs");
const actions = [
  ["album", "Tạo album chọn ảnh"],
  ["view", "Tạo album chỉ xem"],
  ["folder", "Chia sẻ thư mục tải về"],
  ["video", "Chia sẻ video"],
];
const xml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char],
  );
const shellQuote = (value) => "'" + String(value).replace(/'/g, "'\\''") + "'";
const winQuote = (value) =>
  '"' +
  String(value)
    .replace(/(\\*)"/g, '$1$1\\"')
    .replace(/(\\+)$/, "$1$1") +
  '"';
function windowsCommand(
  kind,
  placeholder,
  node = process.execPath,
  script = cli,
  hidden = launcher,
) {
  return [
    "wscript.exe",
    winQuote(hidden),
    winQuote(node),
    winQuote(script),
    "share",
    "--kind",
    kind,
    "--path",
    winQuote(placeholder),
  ].join(" ");
}
function registryEntries(node = process.execPath, script = cli, hidden = launcher) {
  const result = [];
  for (const [base, marker] of [
    ["Directory", "%1"],
    ["Directory\\Background", "%V"],
  ]) {
    const root = `HKCU\\Software\\Classes\\${base}\\shell\\StudioCoreDrive`;
    result.push([root, "MUIVerb", "StudioCore Drive"], [root, "SubCommands", ""]);
    for (const [kind, title] of actions.filter(([kind]) => kind !== "video")) {
      const key = `${root}\\shell\\${kind}`;
      result.push(
        [key, "", title],
        [key + "\\command", "", windowsCommand(kind, marker, node, script, hidden)],
      );
    }
  }
  for (const ext of [".mp4", ".mov", ".m4v", ".webm", ".mkv"]) {
    const key = `HKCU\\Software\\Classes\\SystemFileAssociations\\${ext}\\shell\\StudioCoreDrive`;
    result.push(
      [key, "", "Chia sẻ video"],
      [key + "\\command", "", windowsCommand("video", "%1", node, script, hidden)],
    );
  }
  return result;
}
function launchPlist(node = process.execPath, script = cli) {
  return `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>Label</key><string>vn.studiocore.drive</string><key>ProgramArguments</key><array>${[node, script, "daemon"].map((item) => `<string>${xml(item)}</string>`).join("")}</array><key>RunAtLoad</key><true/></dict></plist>`;
}
function workflow(kind, node = process.execPath, script = cli) {
  const command = `for item in "$@"; do\n  ${shellQuote(node)} ${shellQuote(script)} share --kind ${kind} --path "$item"\ndone`;
  return `<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>AMApplicationBuild</key><string>523</string><key>AMApplicationVersion</key><string>2.10</string><key>AMDocumentVersion</key><string>2</string><key>actions</key><array><dict><key>action</key><dict><key>AMActionVersion</key><string>2.0.3</string><key>AMActionIdentifier</key><string>com.apple.RunShellScript</string><key>AMProvides</key><dict><key>Container</key><string>List</string><key>Types</key><array><string>com.apple.cocoa.string</string></array></dict><key>AMAccepts</key><dict><key>Container</key><string>List</string><key>Types</key><array><string>com.apple.cocoa.string</string></array></dict><key>ActionBundlePath</key><string>/System/Library/Automator/Run Shell Script.action</string><key>ActionName</key><string>Run Shell Script</string><key>ActionParameters</key><dict><key>COMMAND_STRING</key><string>${xml(command)}</string><key>shell</key><string>/bin/bash</string><key>inputMethod</key><integer>1</integer></dict><key>BundleIdentifier</key><string>com.apple.Automator.RunShellScript</string></dict></dict></array><key>workflowMetaData</key><dict><key>workflowTypeIdentifier</key><string>com.apple.Automator.servicesMenu</string><key>serviceInputTypeIdentifier</key><string>${kind === "video" ? "com.apple.Automator.fileSystemObject.movie" : "com.apple.Automator.fileSystemObject.folder"}</string><key>serviceOutputTypeIdentifier</key><string>com.apple.Automator.nothing</string><key>serviceProcessesInput</key><integer>0</integer><key>serviceApplicationBundleID</key><string>com.apple.finder</string></dict></dict></plist>`;
}
function workflowInfo(kind, title) {
  return `<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>vn.studiocore.drive.${xml(kind)}</string><key>CFBundleName</key><string>${xml(title)}</string><key>NSServices</key><array><dict><key>NSMenuItem</key><dict><key>default</key><string>${xml(title)}</string></dict><key>NSMessage</key><string>runWorkflowAsService</string><key>NSSendFileTypes</key><array><string>${kind === "video" ? "public.movie" : "public.folder"}</string></array><key>NSSendTypes</key><array><string>NSFilenamesPboardType</string></array><key>NSReturnTypes</key><array/><key>NSRequiredContext</key><dict><key>NSApplicationIdentifier</key><string>com.apple.finder</string></dict></dict></array></dict></plist>`;
}
async function contextMenu(install) {
  if (process.platform === "win32") {
    const entries = registryEntries();
    if (install)
      for (const [key, name, value] of entries)
        await run(
          "reg.exe",
          [
            "add",
            key,
            name ? "/v" : "/ve",
            ...(name ? [name] : []),
            "/t",
            "REG_SZ",
            "/d",
            value,
            "/f",
          ],
          { windowsHide: true },
        );
    else
      for (const key of new Set(
        entries.map(([key]) => key.split("\\StudioCoreDrive")[0] + "\\StudioCoreDrive"),
      ))
        await run("reg.exe", ["delete", key, "/f"], { windowsHide: true }).catch((error) => {
          if (error.code !== 1) throw error;
        });
  } else if (process.platform === "darwin") {
    for (const [kind, title] of actions) {
      const directory = path.join(
        os.homedir(),
        "Library",
        "Services",
        `StudioCore - ${title}.workflow`,
      );
      if (install) {
        await fs.mkdir(path.join(directory, "Contents"), { recursive: true });
        await fs.writeFile(path.join(directory, "Contents", "document.wflow"), workflow(kind));
        await fs.writeFile(
          path.join(directory, "Contents", "Info.plist"),
          workflowInfo(kind, title),
        );
      } else await fs.rm(directory, { recursive: true, force: true });
    }
    await run("/System/Library/CoreServices/pbs", ["-update"]);
  } else throw new Error("Menu chuột phải chỉ hỗ trợ Windows và macOS.");
}
async function autoStart(enabled) {
  if (process.platform === "win32") {
    const key = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
    if (enabled)
      await run(
        "reg.exe",
        [
          "add",
          key,
          "/v",
          "StudioCoreDrive",
          "/t",
          "REG_SZ",
          "/d",
          [
            "wscript.exe",
            winQuote(launcher),
            winQuote(process.execPath),
            winQuote(cli),
            "daemon",
          ].join(" "),
          "/f",
        ],
        { windowsHide: true },
      );
    else
      await run("reg.exe", ["delete", key, "/v", "StudioCoreDrive", "/f"], {
        windowsHide: true,
      }).catch((error) => {
        if (error.code !== 1) throw error;
      });
  } else if (process.platform === "darwin") {
    const file = path.join(os.homedir(), "Library", "LaunchAgents", "vn.studiocore.drive.plist");
    const domain = `gui/${process.getuid()}`;
    await run("launchctl", ["bootout", domain + "/vn.studiocore.drive"]).catch(() => {});
    if (enabled) {
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, launchPlist(), { mode: 0o600 });
      await run("launchctl", ["bootstrap", domain, file]);
    } else await fs.rm(file, { force: true });
  } else if (enabled) throw new Error("Tự khởi động chỉ hỗ trợ Windows và macOS.");
}
async function openPath(target) {
  if (process.platform === "win32") return run("explorer.exe", [target], { windowsHide: true });
  return run(process.platform === "darwin" ? "open" : "xdg-open", [target]);
}
async function pickPath(kind) {
  try {
    let result;
    if (process.platform === "darwin")
      result = await run("osascript", [
        "-e",
        `POSIX path of (choose ${kind === "video" ? "file" : "folder"} with prompt "Chọn nguồn StudioCore Drive")`,
      ]);
    else if (process.platform === "win32")
      result = await run(
        "powershell.exe",
        [
          "-NoProfile",
          "-STA",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          path.join(__dirname, "picker.ps1"),
          "-Kind",
          kind === "video" ? "video" : "folder",
        ],
        { windowsHide: true },
      );
    else
      result = await run("zenity", [
        "--file-selection",
        ...(kind === "video" ? [] : ["--directory"]),
        "--title=StudioCore Drive",
      ]);
    return result.stdout.trim();
  } catch (error) {
    if ((process.platform === "linux" && error.code === 1) || /\(-128\)/.test(error.stderr || ""))
      return null;
    if (error.code === "ENOENT")
      throw new Error("Chưa có trình chọn tệp (Linux cần zenity). Bạn có thể dán đường dẫn.");
    throw error;
  }
}
async function notify(title, message) {
  try {
    if (process.platform === "darwin")
      await run("osascript", [
        "-e",
        "on run argv\ndisplay notification (item 2 of argv) with title (item 1 of argv)\nend run",
        title,
        message,
      ]);
    else if (process.platform === "win32")
      await run(
        "powershell.exe",
        [
          "-NoProfile",
          "-STA",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          path.join(__dirname, "notify.ps1"),
          "-Title",
          title,
          "-Message",
          message,
        ],
        { windowsHide: true },
      );
    else await run("notify-send", ["--", title, message]);
  } catch {
    /* Notifications are best effort. */
  }
}
module.exports = {
  registryEntries,
  windowsCommand,
  launchPlist,
  workflow,
  workflowInfo,
  contextMenu,
  autoStart,
  openPath,
  pickPath,
  notify,
  xml,
  shellQuote,
};
