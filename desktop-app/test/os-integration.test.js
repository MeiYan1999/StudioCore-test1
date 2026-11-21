const { test } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const {
  registryEntries,
  launchPlist,
  workflow,
  workflowInfo,
  windowsCommand,
} = require("../src/os-integration");
test("Windows commands use user-level keys, hidden launcher and correctly quoted absolute paths", () => {
  const entries = registryEntries(
    "C:\\Program Files\\node\\node.exe",
    "C:\\User A\\app\\cli.js",
    "C:\\User A\\app\\hidden.vbs",
  );
  assert.ok(entries.every(([key]) => key.startsWith("HKCU\\Software\\Classes\\")));
  for (const kind of ["album", "view", "folder", "video"])
    assert.ok(entries.some(([, , value]) => value.includes(`--kind ${kind}`)));
  assert.ok(entries.some(([, , value]) => value.endsWith('--path "%V"')));
  for (const ext of [".mp4", ".mov", ".m4v", ".webm", ".mkv"])
    assert.ok(entries.some(([key]) => key.includes(`SystemFileAssociations\\${ext}\\shell`)));
  const command = windowsCommand(
    "album",
    "%1",
    "C:\\Program Files\\node.exe",
    "C:\\My app\\cli.js",
    "C:\\My app\\hidden.vbs",
  );
  assert.match(command, /^wscript\.exe "/);
  assert.match(command, /"C:\\Program Files\\node.exe"/);
  assert.match(command, /share --kind album --path "%1"$/);
});
test("macOS plist and workflows are valid XML plists and safely quote node/script paths", () => {
  const plist = launchPlist("/a & b/node", "/user's app/cli.js");
  const parsed = JSON.parse(
    execFileSync(
      "python3",
      [
        "-c",
        "import sys,plistlib,json; print(json.dumps(plistlib.loads(sys.stdin.buffer.read())))",
      ],
      { input: plist, encoding: "utf8" },
    ),
  );
  assert.deepEqual(parsed.ProgramArguments, ["/a & b/node", "/user's app/cli.js", "daemon"]);
  assert.equal(parsed.RunAtLoad, true);
  assert.equal(parsed.Label, "vn.studiocore.drive");
  for (const kind of ["album", "view", "folder", "video"]) {
    const info = JSON.parse(
      execFileSync(
        "python3",
        [
          "-c",
          "import sys,plistlib,json; print(json.dumps(plistlib.loads(sys.stdin.buffer.read())))",
        ],
        { input: workflowInfo(kind, "StudioCore & Drive"), encoding: "utf8" },
      ),
    );
    assert.equal(info.NSServices[0].NSMessage, "runWorkflowAsService");
    assert.deepEqual(info.NSServices[0].NSSendFileTypes, [
      kind === "video" ? "public.movie" : "public.folder",
    ]);
    const contents = workflow(kind, "/a & b/node", "/user's app/cli.js");
    const result = JSON.parse(
      execFileSync(
        "python3",
        [
          "-c",
          "import sys,plistlib,json; print(json.dumps(plistlib.loads(sys.stdin.buffer.read())))",
        ],
        { input: contents, encoding: "utf8" },
      ),
    );
    const script = result.actions[0].action.ActionParameters.COMMAND_STRING;
    assert.ok(script.includes(`share --kind ${kind} --path "$item"`));
    assert.ok(script.includes("'/user'\\''s app/cli.js'"));
    assert.equal(
      result.workflowMetaData.serviceInputTypeIdentifier.endsWith(
        kind === "video" ? "movie" : "folder",
      ),
      true,
    );
    execFileSync("bash", ["-n"], { input: script });
  }
});
