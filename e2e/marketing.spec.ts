import { test, expect } from "@playwright/test";

test.describe("landing và public website", () => {
  test("landing đủ section, tabs, FAQ, pricing và responsive", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.getByRole("heading", { name: /Quản lý studio, CRM, lịch chụp/ })).toBeVisible();
    for (const text of [
      "Bạn đang gặp những vấn đề này?",
      "Vài bước để đi vào vận hành.",
      "Hơn 20 tính năng cho mọi nhu cầu.",
      "Một nền tảng. Mọi hoạt động.",
      "Trực quan, dễ sử dụng.",
      "Gói cước phù hợp mọi quy mô studio.",
      "Studio nói gì về StudioCore?",
      "Câu hỏi thường gặp.",
      "Tài liệu hướng dẫn chi tiết.",
      "Bắt đầu quản lý studio ngay hôm nay.",
    ]) {
      await expect(page.getByText(text, { exact: false }).first()).toBeVisible();
    }

    await page.getByRole("tab", { name: "Đơn hàng" }).click();
    await expect(page.getByRole("img", { name: "Quản lý đơn hàng" }).first()).toBeVisible();
    await page.getByRole("button", { name: "Tôi cần kiến thức kỹ thuật để dùng không?" }).click();
    await expect(page.getByText("Không. Giao diện tiếng Việt")).toBeVisible();
    await page.getByRole("button", { name: "Theo năm (tiết kiệm 2 tháng)" }).click();
    await expect(page.getByText("4.990.000 ₫", { exact: false }).first()).toBeVisible();

    const broken = await page.evaluate(() =>
      [...document.images]
        .filter((image) => image.complete && image.naturalWidth === 0)
        .map((image) => image.src),
    );
    expect(broken).toEqual([]);
  });

  test("mobile menu và public pages", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto("/");
    await page.getByRole("button", { name: "Mở menu" }).click();
    await expect(page.getByRole("dialog").getByRole("link", { name: "Tính năng" })).toBeVisible();
    await page.keyboard.press("Escape");
    for (const route of [
      "/phan-mem-quan-ly-studio",
      "/crm-studio-chup-anh",
      "/pricing",
      "/guide",
      "/blog",
      "/blog/checklist-van-hanh-studio-chup-anh",
      "/terms",
      "/privacy",
      "/contact",
    ]) {
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      await expect(page.locator("h1")).toHaveCount(1);
    }
  });

  test("SEO, JSON-LD, sitemap và robots", async ({ page, request }) => {
    await page.goto("/");
    const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(jsonLd.length).toBeGreaterThanOrEqual(3);
    const types = jsonLd.map((value) => JSON.parse(value)["@type"]);
    expect(types).toEqual(expect.arrayContaining(["Organization", "SoftwareApplication", "FAQPage"]));
    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.status()).toBe(200);
    expect(await sitemap.text()).toContain("/pricing");
    const robots = await request.get("/robots.txt");
    expect(await robots.text()).toContain("Sitemap:");
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
  });
});
