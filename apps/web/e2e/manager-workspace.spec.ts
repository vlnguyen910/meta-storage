import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { f5facility, f5id, flow5Fixture, mockFlow5 } from "./support/flow5-fixture";

async function managerFixture(page: Page) {
  const state = flow5Fixture();
  await mockFlow5(page, state);
  let unavailable = false;
  const reportQueries: string[] = [];
  const inventory = {
    totalUnits: 20,
    activeUnits: 20,
    availableUnits: 8,
    occupiedUnits: 7,
    reservedUnits: 3,
    maintenanceUnits: 2,
    inspectionUnits: 0,
    returnPendingUnits: 0,
    lockedUnits: 0,
    inactiveUnits: 0,
    utilizationPercent: 35,
    activeCheckoutHolds: 0,
    confirmedAwaitingHandover: 0,
  };
  await page.route("**/api/reports/**", (route) => {
    const url = new URL(route.request().url());
    reportQueries.push(url.href);
    if (unavailable)
      return route.fulfill({
        status: 503,
        json: { success: false, error: { message: "Unavailable" } },
      });
    const period = {
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
      timeZone: "Asia/Ho_Chi_Minh",
    };
    const data = url.pathname.endsWith("/overview")
      ? { period, asOf: new Date().toISOString(), summary: { inventory }, facilities: [] }
      : url.pathname.endsWith("/revenue/monthly")
        ? {
            period,
            asOf: new Date().toISOString(),
            currency: "VND",
            items: ["2026-08", "2026-09", "2026-10"].map((month, index) => ({
              month,
              cashReceived: String((index + 1) * 2_000_000),
              rentalCollected: String((index + 1) * 1_500_000),
              depositCollected: String((index + 1) * 500_000),
              renewalCollected: "0",
              extraChargeCollected: "0",
              returnDebtCollected: "0",
              cashRefunded: "0",
              chargeRefunded: "0",
              netCash: String((index + 1) * 2_000_000),
              unsupportedCurrencyPayments: 0,
            })),
          }
        : url.pathname.endsWith("/revenue")
          ? {
              items: [
                {
                  facility: {
                    id: f5facility,
                    name: "Cơ sở kiểm thử Flow 5",
                    code: "HCM-TEST",
                  },
                  metrics: { cashReceived: "6000000", netCash: "6000000" },
                },
              ],
              total: 1,
            }
          : { items: [], total: 0 };
    return route.fulfill({ json: { success: true, data } });
  });
  return {
    state,
    reportQueries,
    fail: (value: boolean) => {
      unavailable = value;
    },
  };
}

test("FM keeps one coordination destination and one staff directory with scoped overview graphs", async ({
  page,
}, testInfo) => {
  const { state, reportQueries } = await managerFixture(page);
  await page.goto("/facility-manager/dashboard");
  await expect(page.getByRole("heading", { name: "Tổng quan cơ sở", exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Tiền thuê và dòng tiền theo tháng" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Trạng thái ô kho" })).toBeVisible();
  await expect(page.getByTestId("inventory-donut-chart").locator("svg path").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Báo cáo & Xuất dữ liệu" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tải CSV", exact: true })).toBeVisible();
  await expect(page.getByText("35%", { exact: true })).toBeVisible();
  expect(
    reportQueries.every((url) => new URL(url).searchParams.get("facilityId") === f5facility),
  ).toBe(true);
  await expect(page.getByRole("navigation", { name: "Các tác vụ quản lý cơ sở" })).toHaveCount(0);
  await page.screenshot({
    path: `/tmp/metastorage-staff-ui/manager-overview-${testInfo.project.name}.png`,
    fullPage: true,
    animations: "disabled",
  });
  expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
  const openMenu = async () => {
    const button = page.getByRole("button", { name: "Mở menu", exact: true });
    if (await button.isVisible()) await button.click();
  };
  await openMenu();
  const nav = page.locator("aside nav");
  await expect(nav.getByRole("link")).toHaveCount(6);
  await expect(nav.getByRole("link", { name: "Yêu cầu trả kho", exact: true })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Báo cáo & Xuất dữ liệu", exact: true })).toHaveCount(
    0,
  );
  await expect(nav.getByRole("link", { name: "Chuẩn bị & Phân công", exact: true })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Công việc cơ sở", exact: true })).toHaveCount(0);
  await nav.getByRole("link", { name: "Điều phối công việc", exact: true }).click();
  const coordination = page.getByRole("navigation", { name: "Các nhóm công việc điều phối" });
  await expect(
    page.getByRole("heading", { name: "Booking & Bàn giao", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Theo dõi lịch tiếp đón, chuẩn bị và bàn giao kho tại Cơ sở kiểm thử Flow 5."),
  ).toBeVisible();
  await coordination.getByRole("link", { name: "Yêu cầu trả kho", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Yêu cầu trả kho", exact: true })).toBeVisible();
  await expect(
    page.getByText("Không có yêu cầu phù hợp với bộ lọc.", { exact: true }),
  ).toBeVisible();
  await coordination.getByRole("link", { name: "Task cơ sở", exact: true }).click();
  await expect(page.getByRole("button", { name: "Giao công việc", exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Kiểm tra kho được giao", exact: true }),
  ).toBeVisible();
  const firstTask = state.tasks[0];
  if (!firstTask) throw new Error("Missing task fixture");
  firstTask.status = "IN_PROGRESS";
  await coordination.getByRole("link", { name: "Báo cáo chờ duyệt", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Kiểm tra kho được giao", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `/tmp/metastorage-staff-ui/manager-coordination-${testInfo.project.name}.png`,
    fullPage: true,
    animations: "disabled",
  });
  expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto("/facility-manager/staff");
  await expect(page.getByRole("heading", { name: "Nhân viên cơ sở", exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Cơ sở", exact: true })).toHaveCount(0);
  await page.goto("/facility-manager/dashboard?view=check-in");
  await expect(page).toHaveURL(/\/facility-manager\/tasks\?view=bookings$/);
});

test("pending reports include later API pages and exclude tasks still being performed", async ({
  page,
}) => {
  const { state } = await managerFixture(page);
  const seed = state.tasks[0];
  if (!seed) throw new Error("Missing task fixture");
  state.tasks = Array.from({ length: 105 }, (_, index) => ({
    ...seed,
    id: f5id(100 + index),
    description: `Task ${index}`,
    status: index >= 103 ? "COMPLETED" : "IN_PROGRESS",
  }));
  await page.goto("/facility-manager/tasks?view=reports");
  await expect(page.getByRole("heading", { name: "Task 104", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Task 103", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Task 0", exact: true })).toHaveCount(0);
  expect(state.queries.some((query) => query.includes("offset=100"))).toBe(true);
  expect(
    state.queries
      .filter((query) => query.includes("/facility-tasks?"))
      .every((query) => !query.includes("status=")),
  ).toBe(true);
});

test("FM overview report failure is recoverable", async ({ page }) => {
  const fixture = await managerFixture(page);
  fixture.fail(true);
  await page.goto("/facility-manager/dashboard");
  await expect(
    page.getByText("Không tải được tổng quan cơ sở. Vui lòng thử lại.", { exact: true }),
  ).toBeVisible({ timeout: 15000 });
  fixture.fail(false);
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(page.getByText("35%", { exact: true })).toBeVisible();
});
