import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("guest can request a private booking access link", async ({ page }, testInfo) => {
  await page.goto("/booking/tracking");

  await expect(page.getByRole("heading", { name: "Tra cứu kho của tôi" })).toBeVisible();
  await expect(page.getByLabel("Mã đặt kho")).toBeVisible();
  await expect(page.getByLabel("Email dùng khi đặt kho")).toBeVisible();
  await expect(page.getByText(/Smart App|camera AI|CCCD|SHA-256|QR code/i)).toHaveCount(0);

  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations).toEqual([]);

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);

  await page.screenshot({
    path: `test-results/booking-lookup-${testInfo.project.name}.png`,
    fullPage: true,
  });

  await page.getByLabel("Mã đặt kho").fill("bk-2026-0001");
  await page.getByLabel("Email dùng khi đặt kho").fill("guest@example.com");
  await page.getByRole("button", { name: "Gửi liên kết tra cứu" }).click();

  await expect(page.getByRole("status")).toContainText("Môi trường demo không gửi email thật");
  await page.getByRole("button", { name: "Gửi yêu cầu khác" }).click();
  await expect(page.getByLabel("Mã đặt kho")).toHaveValue("");
});
