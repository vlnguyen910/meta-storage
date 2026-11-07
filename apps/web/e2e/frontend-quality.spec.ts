import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

async function signInAsCustomer(page: Page) {
  await page.goto("/login");
  const submit = page.locator('button[type="submit"]');
  await expect(submit).toBeVisible();
  await submit.click();
  await expect(page).toHaveURL(/\/customer\/dashboard/);
}

test("public reservation is accessible on desktop", async ({ page }) => {
  await page.goto("/reservations/new");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
  await expect(page).toHaveScreenshot("reservation-public-desktop.png", {
    fullPage: true,
    maxDiffPixelRatio: 0.01,
  });
});

test("My Storage is accessible and visually stable on mobile", async ({ page }) => {
  await signInAsCustomer(page);
  await page.goto("/customer/storage");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
  await expect(page).toHaveScreenshot("my-storage-mobile.png", {
    fullPage: true,
    maxDiffPixelRatio: 0.01,
  });
});

test("My Storage detail has an accessible read-only note", async ({ page }) => {
  await signInAsCustomer(page);
  await page.goto("/customer/storage/11111111-1111-1111-1111-111111111111");
  await expect(page.getByText(/Các thao tác hủy, đổi lịch/)).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
