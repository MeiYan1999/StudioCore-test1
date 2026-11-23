void (async () => {
  try {
    const { backupDbToR2 } = await import("../src/lib/db/r2-backup");
    const backedUp = await backupDbToR2();
    console.log(
      backedUp
        ? "[Backup DB] Đã hoàn tất sao lưu database."
        : "[Backup DB] Không thực hiện được sao lưu database.",
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[Backup DB] Không thể sao lưu database: ${message}`);
  }

  process.exit(0);
})();
