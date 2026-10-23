import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  f5facility,
  f5id,
  f5staff,
  f5staff2,
  f5type,
  flow5Fixture,
  mockFlow5,
} from "./support/flow5-fixture";

test("FM creates and edits a unit, handles maintenance conflict and sees both history entries", async ({
  page,
}) => {
  const state = flow5Fixture();
  await mockFlow5(page, state);
  await page.goto("/facility-manager/dashboard?view=staff");
  await page
    .getByRole("link", { name: "Quản lý ô kho", exact: true })
    .waitFor({ state: "attached" });
  const menu = page.getByRole("button", { name: "Mở menu", exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("link", { name: "Quản lý ô kho", exact: true }).click();
  const add = page.getByRole("button", { name: "Thêm ô kho", exact: true });
  await add.click();
  await page.keyboard.press("Escape");
  await expect(add).toBeFocused();
  await add.click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Mã", { exact: true }).fill("WEB-FLOW5-TEST");
  await dialog.getByLabel("Loại kho", { exact: true }).selectOption(f5type);
  await dialog.getByLabel("Tầng", { exact: true }).fill("2");
  await dialog.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const detail = page.getByRole("region", { name: "WEB-FLOW5-TEST", exact: true });
  await expect(detail).toBeVisible();
  await detail.getByRole("button", { name: "Sửa thông tin", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Vị trí ô kho").fill("Gần lối đi");
  await dialog.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(detail.getByText("Gần lối đi", { exact: true })).toBeVisible();
  await detail.getByRole("button", { name: "Đưa vào bảo trì", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(dialog.getByLabel("Lý do bảo trì")).toHaveAttribute("aria-invalid", "true");
  expect(state.writes.filter((row) => row.path.endsWith("/transitions"))).toHaveLength(0);
  await dialog.getByLabel("Lý do bảo trì").fill("Kiểm tra ổ khóa");
  state.maintenanceConflict = true;
  await dialog.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Ô kho đang có booking còn hiệu lực");
  state.maintenanceConflict = false;
  await dialog.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(detail.getByText("Kiểm tra ổ khóa", { exact: true })).toBeVisible();
  await detail.getByRole("button", { name: "Kết thúc bảo trì", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(detail.getByRole("listitem")).toHaveCount(2);
  expect(state.units.find((unit) => unit.code === "WEB-FLOW5-TEST")?.status).toBe("AVAILABLE");
  expect(
    state.writes.find((row) => row.method === "PATCH" && row.path.startsWith("/storage-units/"))
      ?.body,
  ).not.toHaveProperty("unitTypeId");
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot("flow5-inventory.png", {
    fullPage: true,
    animations: "disabled",
  });
  expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
});

test("FM creates a task and reloads the latest assignment version after a conflict", async ({
  page,
}) => {
  const state = flow5Fixture();
  await mockFlow5(page, state);
  await page.goto("/facility-manager/tasks");
  await page.getByRole("button", { name: "Giao công việc", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Tiêu đề công việc").fill("In biên bản kiểm thử");
  await dialog.getByLabel("Loại công việc").selectOption("PRINT_DOCUMENT");
  await dialog.getByLabel("Nhân viên được giao").selectOption(f5staff);
  await dialog.getByLabel("Ô kho", { exact: true }).selectOption(f5id(6));
  await dialog.getByRole("button", { name: "Giao công việc", exact: true }).click();
  const detail = page.getByRole("region", { name: "In biên bản kiểm thử", exact: true });
  await expect(detail).toBeVisible();
  state.assignmentConflict = true;
  await detail.getByLabel("Nhân viên được giao").selectOption(f5staff2);
  await detail.getByRole("button", { name: "Đổi nhân viên", exact: true }).click();
  await expect(detail.getByRole("alert")).toHaveText("Phân công đã thay đổi, vui lòng tải lại");
  await expect(detail.getByLabel("Nhân viên được giao")).toHaveValue(f5staff);
  await detail.getByLabel("Nhân viên được giao").selectOption(f5staff2);
  await detail.getByRole("button", { name: "Đổi nhân viên", exact: true }).click();
  await expect(detail.getByRole("status").filter({ hasText: "Đã lưu thay đổi." })).toBeVisible();
  const changes = state.writes.filter((row) => row.path.endsWith("/assign"));
  expect(changes.map((row) => row.body.version)).toEqual([0, 1]);
  expect(state.tasks[0]?.assignedStaffId).toBe(f5staff2);
  const creation = state.writes.find(
    (row) => row.path === "/facility-tasks" && row.method === "POST",
  );
  expect(creation?.body).toMatchObject({
    facilityId: f5facility,
    assignedStaffId: f5staff,
    type: "PRINT_DOCUMENT",
    storageUnitId: f5id(6),
  });
  expect(creation?.body).not.toHaveProperty("bookingId");
});

test("FS submits a report and FM accepts it to complete the task", async ({ page, context }) => {
  const state = flow5Fixture();
  await mockFlow5(page, state, "FACILITY_STAFF", f5staff);
  await page.goto("/staff/tasks");
  await expect(page.getByRole("button", { name: "Giao công việc", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Xem chi tiết", exact: true }).click();
  const detail = page.getByRole("region", { name: "Kiểm tra kho được giao", exact: true });
  await detail.getByRole("button", { name: "Bắt đầu thực hiện", exact: true }).click();
  await expect(detail.getByText("Đang thực hiện", { exact: true })).toBeVisible();
  await detail.getByLabel("Nội dung báo cáo").fill("   ");
  await detail.getByRole("button", { name: "Gửi báo cáo", exact: true }).click();
  await expect(detail.getByLabel("Nội dung báo cáo")).toHaveAttribute("aria-invalid", "true");
  expect(state.reports).toHaveLength(0);
  await detail.getByLabel("Nội dung báo cáo").fill("  Đã kiểm tra cửa và bên trong kho.  ");
  await detail.getByRole("button", { name: "Gửi báo cáo", exact: true }).click();
  await expect(detail.getByLabel("Nội dung báo cáo")).toHaveValue("");
  await expect(
    detail.getByText("Đã kiểm tra cửa và bên trong kho.", { exact: true }),
  ).toBeVisible();
  expect(state.reports).toHaveLength(1);
  expect(state.reports[0]?.content).toBe("Đã kiểm tra cửa và bên trong kho.");
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot("flow5-staff-report.png", {
    fullPage: true,
    animations: "disabled",
  });
  expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
  const managerPage = await context.newPage();
  await mockFlow5(managerPage, state);
  await managerPage.goto("/facility-manager/tasks");
  await managerPage.getByRole("button", { name: "Xem chi tiết", exact: true }).click();
  const managerDetail = managerPage.getByRole("region", {
    name: "Kiểm tra kho được giao",
    exact: true,
  });
  await expect(
    managerDetail.getByText("Đã kiểm tra cửa và bên trong kho.", { exact: true }),
  ).toBeVisible();
  await managerDetail
    .getByRole("button", { name: "Chấp nhận báo cáo và hoàn tất task", exact: true })
    .click();
  await expect(managerDetail.getByText("Đã hoàn tất", { exact: true })).toBeVisible();
  expect(state.writes.filter((row) => row.path.endsWith("/reports"))).toHaveLength(1);
});

test("Admin manages facilities, types, offerings and membership with revoke guards", async ({
  page,
}) => {
  const state = flow5Fixture();
  await mockFlow5(page, state, "SYSTEM_ADMIN", f5id(9));
  await page.goto("/system-admin/facility-management");
  await page.getByRole("button", { name: "Thêm cơ sở", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Mã", { exact: true }).fill("FAC-WEB");
  await dialog.getByLabel("Tên", { exact: true }).fill("Cơ sở mới");
  await dialog.getByLabel("Địa chỉ", { exact: true }).fill("Địa chỉ mới");
  await dialog.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(page.getByRole("heading", { name: "FAC-WEB · Cơ sở mới" })).toBeVisible();
  await page.getByRole("button", { name: "Sửa thông tin", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Tên", { exact: true }).fill("Cơ sở đã sửa");
  await page.getByRole("dialog").getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(page.getByRole("heading", { name: "FAC-WEB · Cơ sở đã sửa" })).toBeVisible();
  await page.getByRole("button", { name: "Danh mục loại kho", exact: true }).click();
  await page.getByRole("button", { name: "Thêm loại kho", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Mã", { exact: true }).fill("TYPE-WEB");
  await dialog.getByLabel("Tên", { exact: true }).fill("Loại kho mới");
  await dialog.getByLabel("Nhãn kích thước").fill("6 m²");
  await dialog.getByLabel("Chiều dài (m)").fill("3");
  await dialog.getByLabel("Chiều rộng (m)").fill("2");
  await dialog.getByLabel("Chiều cao (m)").fill("2");
  await dialog.getByLabel("Giá thuê ban đầu (VND/tháng)").fill("1200000");
  await dialog.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  const typeCard = page
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: "TYPE-WEB · Loại kho mới" }) });
  await typeCard.getByRole("button", { name: "Sửa thông tin", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Nhãn kích thước").fill("6.0 m²");
  await page.getByRole("dialog").getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(typeCard.getByText("6.0 m²", { exact: false })).toBeVisible();
  expect(
    state.writes.find((row) => row.method === "PATCH" && row.path.startsWith("/unit-types/"))?.body,
  ).not.toHaveProperty("monthlyPrice");
  await page.getByRole("button", { name: "Loại kho tại cơ sở", exact: true }).click();
  await page.getByLabel("Cơ sở", { exact: true }).selectOption(f5facility);
  const offeringCard = page
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: "TYPE-WEB · Loại kho mới" }) });
  await offeringCard.getByRole("button", { name: "Bật cung cấp", exact: true }).click();
  await expect(
    offeringCard.getByRole("button", { name: "Tắt cung cấp", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Phân công nhân sự", exact: true }).click();
  await page.getByLabel("Tài khoản", { exact: true }).selectOption(f5staff2);
  await page.getByRole("button", { name: "Gán nhân sự vào cơ sở", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Nhân viên hai", exact: true })).toBeVisible();
  state.revokeConflict = true;
  const member = page
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: "Nhân viên hai", exact: true }) });
  await member.getByRole("button", { name: "Thu hồi phân công", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Thu hồi phân công", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toHaveText(
    "Nhân viên vẫn còn công việc được giao",
  );
  state.revokeConflict = false;
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Thu hồi phân công", exact: true })
    .click();
  await expect(member.getByRole("button", { name: "Thu hồi phân công", exact: true })).toHaveCount(
    0,
  );
  expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
});

test("BOM can assign by account ID and cannot create or edit physical units", async ({ page }) => {
  const state = flow5Fixture();
  await mockFlow5(page, state, "BUSINESS_OPERATION_MANAGER", f5id(9));
  await page.goto("/operations/facility-management");
  await page.getByRole("button", { name: "Phân công nhân sự", exact: true }).click();
  await page.getByLabel("ID tài khoản (UUID)").fill(f5staff2);
  await page.getByRole("button", { name: "Gán nhân sự vào cơ sở", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Nhân viên hai", exact: true })).toBeVisible();
  expect(state.queries.some((query) => query.startsWith("GET /users"))).toBe(false);
  await page.getByRole("button", { name: "Quản lý ô kho", exact: true }).click();
  await expect(page.getByRole("button", { name: "Thêm ô kho", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Xem chi tiết", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sửa thông tin", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Đưa vào bảo trì", exact: true })).toBeVisible();
});

test("Inventory handles server failure, retry, pagination and empty filters", async ({ page }) => {
  const state = flow5Fixture();
  const first = state.units[0];
  if (!first) throw new Error("Fixture missing unit");
  state.units = Array.from({ length: 21 }, (_, index) => ({
    ...first,
    id: f5id(100 + index),
    code: `UNIT-${index + 1}`,
  }));
  state.inventoryError = true;
  await mockFlow5(page, state);
  await page.goto("/facility-manager/storage-units");
  await expect(
    page.getByText("Không thể tải dữ liệu. Vui lòng thử lại.", { exact: true }),
  ).toBeVisible();
  state.inventoryError = false;
  await page.getByRole("button", { name: /Thử lại/ }).click();
  await expect(page.getByRole("heading", { name: "UNIT-1", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Trang sau", exact: true }).click();
  await expect(page.getByRole("heading", { name: "UNIT-21", exact: true })).toBeVisible();
  await page.getByLabel("Trạng thái", { exact: true }).selectOption("RESERVED");
  await expect(page.getByText("Chưa có dữ liệu phù hợp.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Trang trước", exact: true })).toBeDisabled();
  expect(state.queries.some((query) => query.includes("offset=20"))).toBe(true);
  expect(
    state.queries
      .filter((query) => query.startsWith("GET /storage-units?"))
      .every((query) => query.includes(`facilityId=${f5facility}`)),
  ).toBe(true);
});

test("FS cannot open the FM task management route", async ({ page }) => {
  const state = flow5Fixture();
  await mockFlow5(page, state, "FACILITY_STAFF", f5staff);
  await page.goto("/facility-manager/tasks");
  await expect(page).toHaveURL(/\/forbidden$/);
  expect(state.queries.some((query) => query.startsWith("GET /facility-tasks"))).toBe(false);
});
