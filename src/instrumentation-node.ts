let backupRegistrationStarted = false;

export async function registerNodeDbBackups() {
  if (backupRegistrationStarted) return;
  backupRegistrationStarted = true;

  const { getR2Config } = await import("./lib/storage/r2-storage");
  if (!getR2Config()) return;

  const { backupDbToR2 } = await import("./lib/db/r2-backup");
  const backup = () => {
    void backupDbToR2().catch(() => {});
  };

  const timer = setInterval(backup, 60 * 1000);
  timer.unref?.();
}
