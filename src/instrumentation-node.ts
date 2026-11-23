let backupRegistrationStarted = false;

export async function registerNodeDbBackups() {
  if (backupRegistrationStarted) return;
  backupRegistrationStarted = true;

  const { getR2Config } = await import("./lib/storage/r2-storage");
  if (!getR2Config()) return;

  const { resolveDbFilename } = await import("./lib/db/client");
  const { watchDbBackups } = await import("./lib/db/r2-backup");
  watchDbBackups(resolveDbFilename());
}
