import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import {
  f5facility,
  f5id,
  f5staff,
  f5staff2,
  flow5Fixture,
  mockFlow5,
} from "./support/flow5-fixture";

async function staffFixture(page: Page) {
  const state = flow5Fixture();
  const bookingQueries: string[] = [];
  await mockFlow5(page, state, "FACILITY_STAFF", f5staff);
  await page.routeWebSocket("**/api/notifications/ws", () => {});
  const now = new Date().toISOString();
  const booking = {
    id: f5id(80),
    bookingCode: "BK-STAFF-UI",
    facilityId: f5facility,
    facilityName: "Cơ sở kiểm thử Flow 5",
    unitTypeId: f5id(2),
    unitTypeName: "Kho tiêu chuẩn",
    unitTypeSizeLabel: "4 m²",
    contactName: "Nguyễn Minh Anh",
    contactEmail: "customer@example.test",
    contactPhone: "0901234567",
    checkInSlotStart: now,
    checkInSlotEnd: now,
    rentalEndAt: now,
    requestedMonths: 1,
    totalAmount: 2000000,
    status: "CONFIRMED",
    paidAt: now,
    assignedUnit: { physicalUnitCode: "HCM-TEST-01" },
    assignedStaff: { id: f5staff, name: "Nhân viên một" },
    handoverStage: "WAITING_CUSTOMER",
    createdAt: now,
  };
  page.on("request", (request) => {
    if (request.url().includes("/bookings/assigned-to-me")) bookingQueries.push(request.url());
  });
  let bookingError = false;
  const bookings = [
    booking,
    {
      ...booking,
      id: f5id(81),
      bookingCode: "OTHER-STAFF",
      assignedStaff: { id: f5staff2, name: "Nhân viên hai" },
    },
  ];
  await page.route("**/api/bookings/assigned-to-me*", (route) =>
    route.fulfill({
      status: bookingError ? 503 : 200,
      json: bookingError
        ? { success: false, error: { message: "Unavailable" } }
        : { success: true, data: bookings },
    }),
  );
  const returns = [
    {
      id: f5id(82),
      facilityId: f5facility,
      assignedStaffId: f5staff,
      status: "CONFIRMED",
      startsAt: now,
      endsAt: now,
      timezone: "Asia/Ho_Chi_Minh",
      context: {
        booking: { id: f5id(83), bookingCode: "BK-RETURN-UI" },
        customer: { name: "Trần Văn Bình" },
        unit: { code: "HCM-TEST-02" },
      },
    },
  ];
  await page.route("**/api/facilities/*/return-requests*", (route) =>
    route.fulfill({ json: { success: true, data: returns } }),
  );
  return {
    state,
    bookingQueries,
    bookings,
    returns,
    setBookingError: (value: boolean) => {
      bookingError = value;
    },
  };
}

test("Staff lands on assigned work and opens bookings and facility task details", async ({
  page,
}, testInfo) => {
  const { state, bookings, bookingQueries } = await staffFixture(page);
  await page.goto("/staff/dashboard?view=overview");
  await expect(page).toHaveURL(/\/staff\/dashboard\?view=overview$/);
  await expect(page.getByRole("heading", { name: "Công việc của tôi", exact: true })).toBeVisible();
  await expect(page.locator("aside")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Điều hướng nhân viên cơ sở" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Tổng quan cơ sở", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Kiểm tra kho được giao" })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Cần xử lý/ })).toContainText("3");
  await page.goto("/staff");
  await expect(page).toHaveURL(/\/staff$/);
  await expect(page.getByRole("heading", { name: "Công việc của tôi", exact: true })).toBeVisible();
  await page.screenshot({
    path: `/tmp/metastorage-staff-ui/merged-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByLabel("Loại công việc", { exact: true }).selectOption("CHECK_IN");
  await expect(page.getByRole("heading", { name: "Kiểm tra kho được giao" })).toHaveCount(0);
  await expect(page.getByText("BK-RETURN-UI", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Nhận kho — Nguyễn Minh Anh" })).toBeVisible();
  await expect(page.getByText("OTHER-STAFF", { exact: false })).toHaveCount(0);
  const checkInLink = page.getByRole("link", { name: "Làm check-in", exact: true });
  await expect(checkInLink).toHaveAttribute("href", "/staff/check-in?bookingCode=BK-STAFF-UI");
  await checkInLink.click();
  await expect(page).toHaveURL(/\/staff\/check-in\?bookingCode=BK-STAFF-UI$/);
  await page.goto("/staff/tasks");
  await page.getByLabel("Loại công việc", { exact: true }).selectOption("CHECK_IN");
  await page.getByLabel("Ngày làm việc", { exact: true }).fill("2026-10-23");
  await expect
    .poll(() =>
      bookingQueries.some(
        (url) => url.includes("fromDate=2026-10-23") && url.includes("toDate=2026-10-23"),
      ),
    )
    .toBe(true);
  await expect(page.getByRole("heading", { name: "Nhận kho — Nguyễn Minh Anh" })).toHaveCount(0);
  await page.getByRole("button", { name: "Tất cả ngày", exact: true }).click();
  await expect
    .poll(() =>
      bookingQueries.some(
        (url) => url.includes("fromDate=0001-01-01") && url.includes("toDate=9999-12-31"),
      ),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Hôm nay", exact: true }).click();
  await page.getByLabel("Loại công việc", { exact: true }).selectOption("TASK");
  await expect(page.getByRole("link", { name: "Làm check-in", exact: true })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: /Đã hủy/ })).toHaveCount(0);
  const row = page.getByRole("listitem").filter({ hasText: "Kiểm tra kho được giao" });
  await expect(row.getByText("Chưa có lịch", { exact: true })).toBeVisible();
  await row.getByRole("link", { name: "Mở công việc" }).click();
  await expect(page).toHaveURL(new RegExp(`/staff/tasks/${f5id(7)}`), { timeout: 15000 });
  await expect(page.getByText("Phiên bản phân công", { exact: true })).toHaveCount(0);
  await expect(page.getByText(f5id(6), { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Bắt đầu thực hiện", exact: true }).click();
  const detail = page.getByRole("region", { name: "Kiểm tra kho được giao", exact: true });
  await expect(detail.getByText("Đang thực hiện", { exact: true })).toBeVisible();
  await detail.getByLabel("Nội dung báo cáo").fill("Đã kiểm tra cửa kho và báo quản lý.");
  await detail.getByRole("button", { name: "Gửi báo cáo", exact: true }).click();
  await expect(detail.getByText("Chờ FM chấp nhận", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: "Quay lại công việc", exact: true }).click();
  await page.getByRole("tab", { name: /Chờ FM duyệt/ }).click();
  await expect(
    page.getByRole("heading", { name: "Kiểm tra kho được giao", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("tab", { name: /Đã hoàn tất/ })).toContainText("0");
  expect(state.tasks[0]?.status).toBe("AWAITING_APPROVAL");
  if (!bookings[0]) throw new Error("Missing booking fixture");
  bookings[0].handoverStage = "READY_HANDOVER";
  await page.goto("/staff/tasks");
  await page.getByLabel("Loại công việc", { exact: true }).selectOption("CHECK_IN");
  await expect(page.getByRole("heading", { name: "Công việc của tôi", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Làm mới", exact: true }).click();
  await expect(page.getByRole("link", { name: "Tiếp tục bàn giao", exact: true })).toHaveAttribute(
    "href",
    "/staff/check-in?bookingCode=BK-STAFF-UI&view=handover",
  );
  await page.screenshot({
    path: `/tmp/metastorage-staff-ui/workboard-${testInfo.project.name}.png`,
    fullPage: true,
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("filters and pagination survive task navigation; assignment revocation is handled", async ({
  page,
}) => {
  const { state } = await staffFixture(page);
  const seed = state.tasks[0];
  if (!seed) throw new Error("Missing task fixture");
  state.tasks.push(
    ...Array.from({ length: 104 }, (_, i) => ({
      ...seed,
      id: f5id(100 + i),
      title: `Kiểm tra bổ sung ${i}`,
    })),
  );
  await page.goto("/staff/tasks");
  await page.getByLabel("Loại công việc", { exact: true }).selectOption("TASK");
  await expect(page.getByRole("tab", { name: /Cần xử lý/ })).toContainText("105");
  expect(state.queries.some((q) => q.includes("offset=100"))).toBe(true);
  await page.getByRole("button", { name: "Trang sau", exact: true }).click();
  await expect(page.getByText("Trang 2 / 11", { exact: true })).toBeVisible();
  const link = page.getByRole("link", { name: "Mở công việc", exact: true }).first();
  const href = await link.getAttribute("href");
  await link.click();
  await expect(page.getByRole("button", { name: "Bắt đầu thực hiện", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Quay lại công việc", exact: true }).click();
  await expect(page.getByText("Trang 2 / 11", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Loại công việc", { exact: true })).toHaveValue("TASK");
  const task = state.tasks.find((t) => href?.endsWith(t.id));
  if (!task || !href) throw new Error("Missing selected task");
  task.assignedStaffId = f5staff2;
  await page.goto(href);
  await expect(page.getByRole("button", { name: "Bắt đầu thực hiện", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Thử lại", exact: true })).toBeVisible();
});

test("empty and partial error states recover; mobile workspace remains usable", async ({
  page,
}) => {
  const fixture = await staffFixture(page);
  await page.goto("/staff/tasks");
  await page.getByLabel("Tìm công việc", { exact: true }).fill("không tồn tại");
  await expect(page.getByText("Chưa có công việc trong nhóm này", { exact: true })).toBeVisible();
  await page.getByLabel("Tìm công việc", { exact: true }).fill("");
  fixture.setBookingError(true);
  await page.getByRole("button", { name: "Làm mới", exact: true }).click();
  await expect(
    page.getByText("Chưa cập nhật được công việc. Vui lòng thử lại trước khi xử lý.", {
      exact: true,
    }),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    page.getByRole("heading", { name: "Kiểm tra kho được giao", exact: true }),
  ).toBeVisible();
  fixture.setBookingError(false);
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(
    page.getByText("Chưa cập nhật được công việc. Vui lòng thử lại trước khi xử lý.", {
      exact: true,
    }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("link", { name: "Làm check-in", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/metastorage-staff-ui/workspace-mobile.png", fullPage: true });
});
