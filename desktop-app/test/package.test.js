const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

test("platform packages are deterministic, contain current runtime only, and preserve macOS executables", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "drive-package-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const { buildPackages } = await import("../../scripts/drive-package.mjs");
  const outputDirectory = path.join(root, "output");
  const first = await buildPackages({ outputDirectory });
  const bytes = await Promise.all(
    first.map(({ filename }) => fs.readFile(path.join(outputDirectory, filename))),
  );
  await buildPackages({ outputDirectory });
  for (const [index, { filename }] of first.entries())
    assert.deepEqual(await fs.readFile(path.join(outputDirectory, filename)), bytes[index]);
  execFileSync("python3", [
    "-c",
    `
import pathlib, sys, zipfile
for platform in ('Windows', 'macOS'):
    with zipfile.ZipFile(pathlib.Path(sys.argv[1]) / ('StudioCore-Drive-' + platform + '.zip')) as z:
        assert z.testzip() is None
        names = z.namelist()
        assert len(names) == len(set(names))
        assert all(name.startswith('StudioCore Drive/') for name in names)
        assert not any(set(name.split('/')) & {'test','tests','node_modules','data','cache','bin'} for name in names)
        assert not any(name.endswith(('config.json','shares.json','gui-token','.log','.zip')) for name in names)
        assert 'StudioCore Drive/src/gui.js' in names
        assert 'StudioCore Drive/src/ui/app.js' in names
        if platform == 'macOS':
            for name in ('install.command','uninstall.command','macos/StudioCore Drive.app/Contents/MacOS/app-launcher'):
                assert z.getinfo('StudioCore Drive/' + name).external_attr >> 16 & 0o111 == 0o111
            assert not any('/windows/' in name for name in names)
        else:
            assert 'StudioCore Drive/windows/install.bat' in names
            assert 'StudioCore Drive/windows/hidden.vbs' in names
            assert not any('/macos/' in name or name.endswith('.command') for name in names)
`,
    outputDirectory,
  ]);
});

test("packaging rejects an empty runtime directory and symlinks", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "drive-package-invalid-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const { buildPackages } = await import("../../scripts/drive-package.mjs");
  const sourceDirectory = path.join(root, "empty");
  await fs.mkdir(sourceDirectory);
  const options = { sourceDirectory, outputDirectory: path.join(root, "output") };
  await assert.rejects(buildPackages(options), { code: "ENOENT" });
  if (process.platform !== "win32") {
    await fs.symlink(__filename, path.join(sourceDirectory, "cli.js"));
    await assert.rejects(buildPackages(options), /Cannot package a symlink/);
  }
});
