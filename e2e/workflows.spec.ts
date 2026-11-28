import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.locator("#email").fill("owner@studiocore.demo");
  await page.locator("#password").fill("Demo@123");
  await page.getByRole("button", { name: "Đăng nhập với mật khẩu", exact: true }).click();
  await page.waitForURL("**/manage/dashboard");
});

test("từ hồ sơ lập đơn đúng khách, tiền cọc xuất hiện trong sổ quỹ sau tải lại", async ({ page }) => {
  await page.goto("/manage/customers/customer-demo-01");
  await page.getByRole("button", { name: "Tạo đơn hàng", exact: true }).click({ timeout: 4000 });
  await expect(page.locator("#order-customer")).toHaveValue("customer-demo-01");
  await page.locator("#item-catalog-0").selectOption("custom");
  await page.locator("#item-name-0").fill("Gói 5 triệu");
  await page.locator("#item-price-0").fill("5000000");
  await page.locator("#order-deposit").fill("1000000");
  await page.getByRole("dialog").getByRole("button", { name: "Tạo đơn hàng", exact: true }).click();
  await page.waitForURL("**/manage/orders/*");
  await page.reload();
  const code = (await page.locator("h1").innerText()).match(/DH[\w-]+/)?.[0];
  expect(code).toBeTruthy();
  await page.goto("/manage/finance?q=" + encodeURIComponent(code!));
  await page.reload();
  await expect(page.getByText("Thu cọc đơn " + code, { exact: true })).toBeVisible();
});

test("thông báo mở đúng công việc và giữ được sau tải lại", async ({ page }) => {
  await page.goto("/manage/tasks?taskId=task-demo-01");
  const detail = page.getByRole("dialog");
  await expect(detail.getByRole("heading", { name: "Gọi tư vấn gói cưới cho khách Trang" })).toBeVisible({ timeout: 4000 });
  await page.reload();
  await expect(detail.locator('[name="taskId"]').first()).toHaveValue("task-demo-01");
});

test("điện thoại quét QR chi nhánh rồi vào và ra ca bằng vị trí",async({page,context})=>{
  await page.setViewportSize({width:390,height:844});
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({latitude:10.77,longitude:106.69});
  await page.goto("/manage/check-in?branch=branch-demo-q1");
  const lat=page.getByLabel("Vĩ độ");
  if(!(await lat.isVisible())) await page.getByText("Cấu hình vị trí chấm công",{exact:true}).click();
  await lat.fill("10.77");await page.getByLabel("Kinh độ").fill("106.69");
  await page.getByRole("button",{name:"Lưu vị trí"}).click();
  await page.getByRole("link",{name:"Mở liên kết chấm công của mã QR"}).click();
  await page.getByRole("button",{name:"Vào ca bằng GPS"}).click();
  await expect(page.getByRole("status").filter({hasText:"Đã vào ca."})).toBeVisible();
  await page.reload();
  await page.getByRole("button",{name:"Kết thúc ca bằng GPS"}).click();
  await expect(page.getByRole("status").filter({hasText:"Đã kết thúc ca."})).toBeVisible();
});
test("chọn sổ hộ kinh doanh, kỳ và mở trang quản lý Fanpage",async({page})=>{
  await page.goto("/manage/reports/tax/print?from=2026-01-01&to=2026-12-31");
  await page.getByLabel("Chế độ kế toán hộ kinh doanh").selectOption("S1a-HKD");
  await expect(page.getByRole("heading",{name:"SỔ DOANH THU BÁN HÀNG HÓA, DỊCH VỤ"})).toBeVisible();
  await page.getByLabel("Chế độ kế toán hộ kinh doanh").selectOption("S2a-HKD");
  await expect(page.getByRole("columnheader",{name:"Số hiệu chứng từ"})).toBeVisible();
  await page.goto("/manage/campaigns");
  await page.getByRole("link",{name:"Fanpage và quảng cáo"}).click();
  await expect(page.getByText("Chưa có kỳ đã đồng bộ.",{exact:true})).toBeVisible();
});
test("gắn đơn vào chiến dịch rồi thấy đơn trong danh sách chiến dịch",async({page})=>{
  await page.goto("/manage/orders/order-demo-04");
  const code=(await page.locator("h1").innerText()).match(/DH[\w-]+/)?.[0];
  expect(code).toBeTruthy();
  await page.getByLabel("Chiến dịch").selectOption("campaign-demo-facebook");
  await page.getByRole("button",{name:"Lưu nguồn đơn"}).click();
  await page.reload();
  await expect(page.getByLabel("Chiến dịch")).toHaveValue("campaign-demo-facebook");
  await page.goto("/manage/campaigns");
  const row=page.getByRole("row").filter({hasText:"Facebook cưới tháng 10"});
  await row.locator("summary").click();
  await expect(row.getByRole("link",{name:new RegExp(code!)})).toHaveAttribute("href","/manage/orders/order-demo-04");
});
test("giữ rồi giao trang phục từ lịch hẹn",async({page})=>{
  await page.goto("/manage/calendar/appointment-demo-03");
  const itemId=await page.locator('select[name="itemId"] option:not([value=""])').first().getAttribute("value");
  expect(itemId).toBeTruthy();
  await page.locator('select[name="itemId"]').selectOption(itemId!);
  await page.getByLabel("Hạn trả").fill(new Date(Date.now()+7*864e5).toISOString().slice(0,10)+"T17:00");
  await page.getByRole("button",{name:"Giữ đồ cho lịch"}).click();
  await expect(page.getByRole("status").filter({hasText:"Đã giữ trang phục cho lịch."})).toBeVisible();
  await page.goto("/manage/wardrobe/rentals");
  const returnedBefore=await page.getByRole("row").filter({has:page.locator(`a[href="/manage/wardrobe/${itemId}"]`)}).getByText("Đã trả",{exact:true}).count();
  const row=page.getByRole("row").filter({has:page.locator(`a[href="/manage/wardrobe/${itemId}"]`)});
  await row.getByRole("button",{name:"Giao đồ"}).click();
  await page.reload();
  await expect(row.getByText("Đang thuê",{exact:true})).toBeVisible();
  await expect(row.getByRole("button",{name:"Giao đồ"})).toHaveCount(0);
  await row.getByRole("button",{name:"Nhận lại"}).click();
  await page.getByRole("button",{name:"Xác nhận nhận lại"}).click();
  await page.reload();
  await expect(row.getByText("Đã trả",{exact:true})).toHaveCount(returnedBefore+1);
  await expect(row.getByText("Đang thuê",{exact:true})).toHaveCount(0);
});
test("form Fanpage và quảng cáo gửi được",async({page})=>{
  await page.goto("/manage/campaigns/fanpage");
  await page.getByLabel("Mã tài khoản").fill("abc");
  await page.getByLabel("Token có quyền ads_read").fill("token-thu");
  await page.getByRole("button",{name:"Kết nối tài khoản"}).click();
  await expect(page.getByRole("status").filter({hasText:"Nhập mã act_ và token có quyền ads_read."})).toBeVisible();
});
