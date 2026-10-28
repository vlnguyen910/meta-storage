import { expect, test } from "@playwright/test";
import { flow5Fixture, mockFlow5 } from "./support/flow5-fixture";

test("Manager represents retired support API honestly and inventory remains scrollable on narrow screens", async ({
  page,
}, info) => {
  const state = flow5Fixture();
  await mockFlow5(page, state);
  await page.route("**/api/facility-workspace/support?**", (route) =>
    route.fulfill({
      status: 410,
      json: { success: false, error: { code: "ROUTE_OUTDATED", message: "Route retired" } },
    }),
  );
  await page.goto("/facility-manager/support");
  await expect(page.getByRole("heading", { name: "Điều phối hỗ trợ chưa khả dụng" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Giao công việc" })).toHaveCount(0);
  await page.goto("/facility-manager/storage-units");
  await expect(page.getByRole("columnheader", { name: "Diện tích / Quy cách" })).toBeVisible();
  await page.getByRole("button", { name: "Xem chi tiết", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.screenshot({ path: `/tmp/manager-refinement-unit-${info.project.name}.png` });
  await page.keyboard.press("Escape");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("Manager mobile navigation traps keyboard focus and Escape returns to the menu button", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockFlow5(page, flow5Fixture());
  await page.goto("/facility-manager/tasks?view=tasks");
  const menu = page.getByRole("button", { name: "Mở menu", exact: true });
  await menu.click();
  const navigation = page.getByRole("complementary");
  await expect(navigation).toBeVisible();
  await expect(navigation.locator("a").first()).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(navigation.getByRole("button", { name: "Đăng xuất" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  await expect(navigation).toHaveAttribute("inert", "");
});
