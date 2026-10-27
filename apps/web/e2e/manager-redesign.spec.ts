import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { f5id, f5now, f5staff, f5staff2, flow5Fixture, mockFlow5 } from "./support/flow5-fixture";

test("Manager keeps list filters behind a keyboard-accessible task dialog and preserves reassignment drafts", async ({
  page,
}, info) => {
  const state = flow5Fixture();
  await mockFlow5(page, state);
  await page.goto("/facility-manager/tasks?view=tasks");
  await expect(page.getByRole("link", { name: "Công việc cơ sở", exact: true })).toBeVisible();
  const opener = page.getByRole("button", { name: "Xem chi tiết", exact: true });
  await opener.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Phiên bản phân công")).toHaveCount(0);
  await dialog.locator("summary").filter({ hasText: "Đổi nhân viên" }).click();
  await dialog.getByLabel("Nhân viên được giao").selectOption(f5staff2);
  state.assignmentConflict = true;
  await dialog.getByRole("button", { name: "Đổi nhân viên", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Phân công đã thay đổi");
  await expect(dialog.getByLabel("Nhân viên được giao")).toHaveValue(f5staff2);
  await dialog.getByRole("button", { name: "Đổi nhân viên", exact: true }).click();
  await expect(page.getByText("Đã cập nhật nhân viên phụ trách.", { exact: true })).toBeVisible();
  expect(state.tasks[0]?.assignedStaffId).toBe(f5staff2);
  expect((await new AxeBuilder({ page }).include("dialog").analyze()).violations).toEqual([]);
  await page.screenshot({ path: `/tmp/manager-refinement-task-${info.project.name}.png` });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("Manager approves a report only after confirming and the pending review list updates", async ({
  page,
}, info) => {
  const state = flow5Fixture();
  const task = state.tasks[0];
  if (!task) throw new Error("Missing task fixture");
  task.status = "AWAITING_APPROVAL";
  task.startedAt = f5now;
  state.reports.push({
    id: f5id(55),
    taskId: task.id,
    submittedBy: f5staff,
    submitterName: "Nhân viên một",
    content: "Đã kiểm tra khóa và cửa kho, hoạt động bình thường.",
    submittedAt: f5now,
    acceptedBy: null,
    acceptedAt: null,
    acceptedByName: null,
  });
  await mockFlow5(page, state);
  await page.goto("/facility-manager/tasks?view=reports");
  await page.getByRole("button", { name: "Xem chi tiết", exact: true }).click();
  const detail = page.getByRole("dialog", { name: "Xem chi tiết", exact: true });
  await expect(detail.getByText("Đổi nhân viên", { exact: true })).toHaveCount(0);
  await expect(detail.getByText(state.reports[0]?.content ?? "", { exact: true })).toBeVisible();
  await detail.getByRole("button", { name: "Duyệt báo cáo", exact: true }).click();
  const confirm = page.getByRole("dialog", { name: "Xác nhận duyệt báo cáo", exact: true });
  expect(state.writes.filter((entry) => entry.path.endsWith("/accept"))).toHaveLength(0);
  await page.screenshot({ path: `/tmp/manager-refinement-review-${info.project.name}.png` });
  await confirm.getByRole("button", { name: "Duyệt báo cáo", exact: true }).click();
  await expect(confirm).toHaveCount(0);
  await expect(detail.getByText("Đã hoàn tất", { exact: true })).toBeVisible();
  expect(state.writes.filter((entry) => entry.path.endsWith("/accept"))).toHaveLength(1);
  await detail.getByRole("button", { name: "Đóng", exact: true }).click();
  await expect(page.getByRole("button", { name: "Xem chi tiết", exact: true })).toHaveCount(0);
});

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
