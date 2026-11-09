import { describe, expect, it } from "vitest";
import { tenants } from "@/lib/db/schema";
import { buildStudioShareUrl } from "@/lib/services/album-service";
import {
  buildGoogleCalendarEventUrl,
  buildGoogleCalendarSubscribeUrl,
  generateCalendarIcs,
  getOrCreateCalendarFeedToken,
  regenerateCalendarFeedToken,
} from "@/lib/services/ical-service";
import { createTestDb } from "../helpers/test-db";
import { setTenantSetting } from "@/lib/services/settings-write-service";

describe("Calendar Sync & Studio Subdomain Share", () => {
  it("buildStudioShareUrl: returns default domain when no custom subdomain is configured", () => {
    const db = createTestDb();
    const tenant = db.select().from(tenants).get()!;

    const prevEnv = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://studiocore.io.vn";

    try {
      const shareUrl = buildStudioShareUrl(db, tenant.id, "my_secret_token_123");
      expect(shareUrl).toBe("https://studiocore.io.vn/share/my_secret_token_123");
    } finally {
      process.env.NEXT_PUBLIC_SITE_URL = prevEnv;
    }
  });

  it("buildStudioShareUrl: returns custom studio subdomain when configured in settings", () => {
    const db = createTestDb();
    const tenant = db.select().from(tenants).get()!;

    setTenantSetting(db, tenant.id, "studio.subdomain", "manhnguyen");

    const prevEnv = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://studiocore.io.vn";

    try {
      const shareUrl = buildStudioShareUrl(db, tenant.id, "token_abc");
      expect(shareUrl).toBe("https://manhnguyen.studiocore.io.vn/share/token_abc");
    } finally {
      process.env.NEXT_PUBLIC_SITE_URL = prevEnv;
    }
  });

  it("Calendar iCal & Google Calendar URL generation", () => {
    const db = createTestDb();
    const tenant = db.select().from(tenants).get()!;

    const feedToken1 = getOrCreateCalendarFeedToken(db, tenant.id);
    expect(feedToken1).toBeTruthy();
    expect(feedToken1.length).toBeGreaterThanOrEqual(20);

    const feedToken2 = getOrCreateCalendarFeedToken(db, tenant.id);
    expect(feedToken2).toBe(feedToken1);

    const refreshedToken = regenerateCalendarFeedToken(db, tenant.id);
    expect(refreshedToken).not.toBe(feedToken1);

    const icsResult = generateCalendarIcs(db, refreshedToken);
    expect(icsResult).not.toBeNull();
    expect(icsResult?.icsContent).toContain("BEGIN:VCALENDAR");
    expect(icsResult?.icsContent).toContain("VERSION:2.0");
    expect(icsResult?.icsContent).toContain("X-WR-TIMEZONE:Asia/Ho_Chi_Minh");
    expect(icsResult?.icsContent).toContain("END:VCALENDAR");

    const singleEventUrl = buildGoogleCalendarEventUrl({
      orderCode: "ORD-999",
      customerName: "Nguyễn Văn A",
      customerPhone: "0901234567",
      startAt: new Date("2026-11-15T09:00:00Z"),
      endAt: new Date("2026-11-15T11:00:00Z"),
      branchName: "Chi nhánh Quận 1",
      roomName: "Studio A",
      photographerName: "Tuấn Photographer",
      notes: "Chụp ảnh cưới concept Hàn Quốc",
    });

    expect(singleEventUrl).toContain("calendar.google.com/calendar/render");
    expect(singleEventUrl).toContain("ORD-999");
    expect(singleEventUrl).toContain("Nguy%E1%BB%85n+V%C4%83n+A");

    const subscribeUrl = buildGoogleCalendarSubscribeUrl(
      "webcal://studiocore.io.vn/api/calendar/feed/tok123/schedule.ics",
    );
    expect(subscribeUrl).toContain("calendar.google.com/calendar/r?cid=webcal%3A%2F%2Fstudiocore.io.vn");
  });
});
