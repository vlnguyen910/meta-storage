import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: /Khách thuê kho/ }).click();
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL(/\/customer\/dashboard/);
});

test("customer completes a reservation and keeps it after reload", async ({ page }) => {
  await page.getByRole("link", { name: "Đặt kho mới" }).click();
  await page.getByRole("button", { name: /metastorage Sài Gòn Central/ }).click();
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await page
    .getByRole("button", { name: /2 m².*Kho tiêu chuẩn/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await expect(page.getByText("Kiểm tra báo giá")).toBeVisible();
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await page.locator('input[name="cardNumber"]').fill("4000 0000 0000 0002");
  await page.getByRole("button", { name: /Thanh toán & đặt chỗ/ }).click();
  await expect(page.locator(".inline-error")).toHaveText("Ngân hàng từ chối giao dịch thử nghiệm");
  await page.locator('input[name="cardNumber"]').fill("4242 4242 4242 4242");
  await page.getByRole("button", { name: /Thanh toán & đặt chỗ/ }).click();
  await expect(page.getByText("Đặt chỗ thành công")).toBeVisible();
  const code = await page.locator(".reservation-success h1").textContent();
  await page.getByRole("link", { name: "Xem reservation" }).click();
  await expect(page).toHaveURL(/\/customer\/reservations\/res-/);
  await expect(page.getByText(code ?? "RS-")).toBeVisible();
  await page.reload();
  await expect(page.getByText(code ?? "RS-")).toBeVisible();
});

test("a staff account cannot enter customer routes", async ({ page }) => {
  const logoutButton = page.getByRole("button", { name: "Đăng xuất" });
  if ((page.viewportSize()?.width ?? 1280) <= 800) {
    await page.locator(".app-topbar .mobile-menu-button").click();
  }
  await logoutButton.click();
  await page.getByRole("button", { name: /Nhân viên cơ sở/ }).click();
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL(/\/staff\/dashboard/);
  await page.goto("/customer/dashboard");
  await expect(page).toHaveURL(/\/forbidden/);
});
