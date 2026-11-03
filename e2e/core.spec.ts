import { test, expect } from "@playwright/test";

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("Demo@123");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
}

test.describe("app thật và vai trò", () => {
  test("owner xem các route chính", async ({ page }) => {
    await login(page, "owner@studiocore.demo");
    await page.waitForURL("**/manage/dashboard");
    const routes: [string, string][] = [
      ["/manage/dashboard", "Tổng quan"],
      ["/manage/customers", "Khách hàng"],
      ["/manage/orders", "Đơn hàng"],
      ["/manage/calendar", "Lịch chụp"],
      ["/manage/photos", "Album ảnh"],
      ["/manage/finance", "Sổ quỹ"],
      ["/manage/tasks", "Công việc"],
      ["/manage/payroll", "Bảng lương"],
      ["/manage/reports", "Báo cáo"],
      ["/manage/activity-log", "Nhật ký hoạt động"],
      ["/manage/settings/studio", "Cài đặt studio"],
    ];
    for (const [route, heading] of routes) {
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { name: heading, exact: true }).first()).toBeVisible();
    }
  });


  test("smoke toàn bộ route chính", async ({ page }) => {
    test.setTimeout(150_000);
    await login(page, "owner@studiocore.demo");
    await page.waitForURL("**/manage/dashboard");
    const routes = [
      "/manage/dashboard",
      "/manage/customers",
      "/manage/customers/customer-demo-01",
      "/manage/orders",
      "/manage/orders/order-demo-01",
      "/manage/orders/order-demo-01/contract",
      "/manage/orders/order-demo-01/receipt",
      "/manage/services",
      "/manage/vouchers",
      "/manage/products",
      "/manage/calendar",
      "/manage/calendar/appointment-demo-01",
      "/manage/settings/rooms",
      "/manage/photos",
      "/manage/photos/albums/new",
      "/manage/photos/filter",
      "/manage/albums/album-demo-01",
      "/manage/albums/album-demo-01/filter",
      "/manage/albums/album-demo-01/notes",
      "/manage/wardrobe",
      "/manage/wardrobe/wardrobe-demo-01",
      "/manage/wardrobe/rentals",
      "/manage/equipment",
      "/manage/equipment/equipment-demo-camera",
      "/manage/finance",
      "/manage/finance/invoices",
      "/manage/finance/debts",
      "/manage/finance/commissions",
      "/manage/payroll",
      "/manage/reports",
      "/manage/reports/invoices/invoice-demo-01/print",
      "/manage/reports/tax/print",
      "/manage/tasks",
      "/manage/documents",
      "/manage/campaigns",
      "/manage/inbox",
      "/manage/staff",
      "/manage/staff/attendance",
      "/manage/staff/leave",
      "/manage/settings/studio",
      "/manage/settings/branches",
      "/manage/settings/payments/sandbox",
      "/manage/settings/ai",
      "/manage/settings/integrations",
      "/manage/settings/users",
      "/manage/settings/roles",
      "/manage/settings/sessions",
      "/manage/activity-log",
      "/share/demo-share-album-01",
    ];
    for (const route of routes) {
      const response = await page.goto(route);
      expect(response?.status(), `${route} phải trả 200`).toBe(200);
    }
  });
  test("PhotoShare public và demo read-only", async ({ page }) => {
    await page.goto("/share/demo-share-album-01");
    await expect(page.getByRole("heading", { name: "Album Cưới Demo" })).toBeVisible();
    await expect(page.getByText("Đây là môi trường demo.")).toBeVisible();
    await expect(page.locator("article")).toHaveCount(12);
    await page.goto("/demo");
    await page.waitForURL("**/manage/dashboard?demo=1");
    await expect(page.getByText("Đây là dữ liệu demo. Chế độ chỉ xem")).toBeVisible();
    await expect(page.getByRole("link", { name: "Người dùng" })).toHaveCount(0);
  });

  test("platform admin vào /platform, không vào dữ liệu tenant", async ({ page }) => {
    await login(page, "platform@studiocore.demo");
    await page.waitForURL("**/platform");
    await expect(page.getByRole("heading", { name: "Quản lý tenant nền tảng" })).toBeVisible();
    await page.goto("/manage/customers");
    await expect(page.getByText("403 — Không có quyền truy cập")).toBeVisible();
  });
});
