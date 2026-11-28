let backupRegistrationStarted = false;

export async function registerNodeDbBackups() {
  if (backupRegistrationStarted) return;
  backupRegistrationStarted = true;

  if (process.env.NEXT_PHASE !== "phase-production-build") {
    const { getDb } = await import("./lib/db/client");
    const { deliverDueReviews, recoverReviewDeliveries } = await import("./lib/services/review-delivery-service");
    const { publishDuePosts, deliverAssistantReplies } = await import("./lib/services/page-marketing-service");
    let running = false;
    const timer = setInterval(async () => {
      if (running) return;
      running = true;
      try {
        const db = getDb();
        recoverReviewDeliveries(db);
        await Promise.all([deliverDueReviews(db), publishDuePosts(db), deliverAssistantReplies(db)]);
      } catch (error) {
        console.error("Lỗi xử lý yêu cầu đánh giá", error instanceof Error ? error.name : "Error");
      } finally {
        running = false;
      }
    }, 30_000);
    timer.unref();
  }
  const { getR2Config } = await import("./lib/storage/r2-storage");
  if (!getR2Config()) return;

  const { resolveDbFilename } = await import("./lib/db/client");
  const { watchDbBackups } = await import("./lib/db/r2-backup");
  watchDbBackups(resolveDbFilename());
}
