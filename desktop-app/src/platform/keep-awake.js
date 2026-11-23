"use strict";

const { spawn: defaultSpawn } = require("node:child_process");

function buildWindowsKeepAwakeScript(parentPid) {
  if (!Number.isSafeInteger(parentPid) || parentPid <= 0) {
    throw new TypeError("parentPid must be a positive integer");
  }

  return `Add-Type -Namespace StudioCore -Name Power -MemberDefinition @'
[StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
public struct REASON_CONTEXT
{
  public uint Version;
  public uint Flags;
  [MarshalAs(UnmanagedType.LPWStr)]
  public string SimpleReasonString;
}
[DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
public static extern IntPtr PowerCreateRequest(ref REASON_CONTEXT context);
[DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
[return: MarshalAs(UnmanagedType.Bool)]
public static extern bool PowerSetRequest(IntPtr handle, int requestType);
'@
$context = New-Object -TypeName 'StudioCore.Power+REASON_CONTEXT'
$context.Version = 0
$context.Flags = 1
$context.SimpleReasonString = 'StudioCore Drive: giữ máy luôn bật'
$handle = [StudioCore.Power]::PowerCreateRequest([ref]$context)
if ($handle -eq [IntPtr]::Zero) { exit 2 }
if (-not [StudioCore.Power]::PowerSetRequest($handle, 1)) { exit 2 }
Wait-Process -Id ${parentPid}
`;
}

function startKeepAwake({
  platform = process.platform,
  powerSaveBlocker,
  spawn = defaultSpawn,
  pid = process.pid,
} = {}) {
  let active = true;
  let child = null;
  let blockerId = null;
  let blockerStarted = false;

  const startBlocker = () => {
    if (!active || blockerStarted) return;
    blockerStarted = true;
    try {
      blockerId = powerSaveBlocker.start("prevent-app-suspension");
    } catch (error) {
      console.warn("Không thể giữ máy luôn bật:", error);
    }
  };

  if (platform === "win32") {
    const script = buildWindowsKeepAwakeScript(pid);
    const encodedScript = Buffer.from(script, "utf16le").toString("base64");
    try {
      child = spawn(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-ExecutionPolicy",
          "Bypass",
          "-EncodedCommand",
          encodedScript,
        ],
        { windowsHide: true, stdio: "ignore" },
      );
      child.once("error", startBlocker);
      child.once("exit", startBlocker);
    } catch {
      startBlocker();
    }
  } else {
    startBlocker();
  }

  return {
    stop() {
      if (!active) return;
      active = false;

      if (child) {
        try {
          child.kill();
        } catch {}
        child = null;
      }

      if (blockerId !== null) {
        try {
          if (
            typeof powerSaveBlocker.isStarted !== "function" ||
            powerSaveBlocker.isStarted(blockerId)
          ) {
            powerSaveBlocker.stop(blockerId);
          }
        } catch (error) {
          console.warn("Không thể dừng chế độ giữ máy luôn bật:", error);
        } finally {
          blockerId = null;
        }
      }
    },
  };
}

module.exports = { buildWindowsKeepAwakeScript, startKeepAwake };
