import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { selectCheckInDate, tomorrowInVietnam } from "./support/reservation-form";

test("public header shows the signed-in name and removes the hotline", async ({ page }) => {
  await page.goto("/facilities");
  await expect(
    page.locator("header").getByRole("link", { name: "Đăng nhập", exact: true }),
  ).toBeVisible();
  await expect(page.locator('header a[href^="tel:"]')).toHaveCount(0);
  await page.goto("/login");
  await page.getByLabel("Địa chỉ Email", { exact: true }).fill("customer@metastorage.test");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("12345678");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/customer\/dashboard/);
  for (const width of [1440, 1200, 430, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(width === 1200 ? "/reservations/new" : "/facilities");
    const header = page.locator("header");
    const account = header.getByRole("link", { name: "Mở trang quản lý của Nguyễn Minh Anh" });
    await expect(account).toBeVisible();
    await expect(account.getByText("Nguyễn Minh Anh", { exact: true })).toBeVisible();
    await expect(account.getByText("Đã đăng nhập", { exact: true })).toBeVisible();
    await expect(account).toHaveAttribute("href", "/customer/dashboard");
    await expect(header.getByRole("link", { name: "Đăng nhập", exact: true })).toHaveCount(0);
    await expect(header.locator('a[href^="tel:"]')).toHaveCount(0);
    await account.focus();
    await expect(account).toBeFocused();
    expect((await new AxeBuilder({ page }).include("header").analyze()).violations).toEqual([]);
    expect(await header.evaluate((element) => element.scrollWidth <= innerWidth)).toBe(true);
    await header.screenshot({ path: `test-results/public-header-session-${width}.png` });
  }
  await page.reload();
  await page.getByRole("link", { name: "Mở trang quản lý của Nguyễn Minh Anh" }).click();
  await expect(page).toHaveURL(/\/customer\/dashboard$/);
});

for (const width of [1440, 390]) {
  test(`customer books inside customer shell with SePay only at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.clock.setFixedTime(new Date("2030-01-01T09:00:00+07:00"));
    await page.goto("/login");
    await page.getByLabel("Địa chỉ Email", { exact: true }).fill("customer@metastorage.test");
    await page.getByLabel("Mật khẩu", { exact: true }).fill("12345678");
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(page).toHaveURL(/\/customer\/dashboard/);
    await page.getByRole("link", { name: "Đặt kho mới", exact: true }).click();
    await expect(page).toHaveURL(/\/customer\/reservations\/new/);
    await page.goto("/customer/facilities");
    const cards = page.locator("main article");
    await expect(cards.first().getByText("Giá thuê theo tháng", { exact: true })).toBeVisible();
    // Prices come from each facility's types, rather than a shared display constant.
    await page.getByLabel("Sắp xếp").selectOption("price");
    const prices = await cards.locator("p.text-lg").allTextContents();
    expect(new Set(prices).size).toBeGreaterThan(1);
    await cards.first().getByRole("link", { name: "Xem kho trống" }).click();
    await expect(page).toHaveURL(/\/customer\/reservations\/new\?facilityId=/);
    await page.getByRole("button", { name: "Chọn loại này", exact: true }).first().click();
    await page.getByRole("button", { name: "Tiếp tục: Thông tin người thuê" }).click();
    await page.getByLabel("Họ và tên", { exact: true }).fill("Khách Customer");
    await page.getByLabel("Số điện thoại", { exact: true }).fill("0901234567");
    await page.getByLabel("Địa chỉ email", { exact: true }).fill("customer@metastorage.test");
    await selectCheckInDate(page, await tomorrowInVietnam(page));
    await page.locator('input[name="checkInSlotId"]').first().check();
    await page.getByRole("button", { name: "Xem đơn thuê", exact: true }).click();
    await page.getByRole("button", { name: "Thanh toán", exact: true }).click();
    await expect(page.getByText("Thanh toán qua SePay", { exact: true })).toBeVisible();
    await expect(page.getByText(/Thẻ ATM|Visa|Mastercard|Ví điện tử/)).toHaveCount(0);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/customer-checkout-${width}.png`, fullPage: true });
    // Mock confirmation only: no real payment or outbound email.
    await page.getByRole("button", { name: "Thanh toán", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Đặt thuê kho thành công!" })).toBeVisible();
    await page.getByRole("link", { name: "Về trang tìm kho" }).last().click();
    await expect(page).toHaveURL(/\/customer\/facilities$/);
  });
}
