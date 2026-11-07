import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import {
  appointment,
  appointments,
  customer,
  facility,
  id,
  testNow,
  unit,
} from "./customer-home.data";

test.use({ actionTimeout: 10000 });
async function setup(
  page: Page,
  options: {
    empty?: boolean;
    failAppointments?: boolean;
    failDetail?: boolean;
    unpaid?: boolean;
  } = {},
) {
  await page.clock.setFixedTime(new Date(testNow));
  const calls: { path: string; method: string }[] = [];
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    calls.push({ path, method: route.request().method() });
    if (path.endsWith("/auth/get-session"))
      return route.fulfill({
        json: {
          user: customer,
          session: {
            id: "session",
            token: "test",
            userId: customer.id,
            expiresAt: "2099-01-01T00:00:00Z",
          },
        },
      });
    let data: unknown;
    if (path.endsWith("/appointments/mine")) {
      if (options.failAppointments)
        return route.fulfill({ status: 503, json: { message: "Unavailable" } });
      data = options.empty ? [] : appointments;
    } else if (path.endsWith(`/appointments/${appointment.id}`)) {
      if (options.failDetail) return route.fulfill({ status: 404, json: { message: "Not found" } });
      data = options.unpaid
        ? {
            ...appointment,
            paymentStatus: "PENDING",
            assignedUnit: null,
            reservation: { ...appointment.reservation, status: "DRAFT" },
          }
        : appointment;
    } else if (path.includes("/appointments/"))
      data = appointments.find((a) => path.endsWith(a.id));
    else if (path.endsWith("/rentals/mine"))
      data = {
        items: options.empty
          ? []
          : [
              { id: id(90), status: "ACTIVE" },
              { id: id(91), status: "ACTIVE" },
            ],
        nextCursor: null,
      };
    else if (path.endsWith("/facilities/catalog")) {
      const items = options.empty
        ? []
        : [
            facility,
            { ...facility, id: id(21), name: "Kho Hà Nội", startingMonthlyPrice: null },
          ].filter((item) => item.name.includes(url.searchParams.get("search") ?? ""));
      data = {
        items,
        page: 1,
        pageSize: 6,
        total: items.length,
        totalPages: 1,
      };
    } else if (path.endsWith("/unit-types")) data = [unit];
    else return route.fulfill({ status: 501, json: { message: "Endpoint not modeled" } });
    return route.fulfill({ json: { success: true, data, message: "OK", timestamp: testNow } });
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Tìm & Thuê buồng kho" })).toBeVisible({
    timeout: 120000,
  });
  await page.evaluate(() => document.fonts.ready);
  return { calls, options };
}
async function openDetail(page: Page) {
  await page
    .getByRole("button", { name: /^Xem chi tiết: Kho Sài Gòn,/ })
    .first()
    .tap();
  await expect(page.getByRole("heading", { name: "Chi tiết lịch hẹn", exact: true })).toBeVisible();
}
async function assertFits(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  for (const button of await page.getByRole("button").all()) {
    const box = await button.boundingBox();
    expect(box && box.width >= 44 && box.height >= 44).toBeTruthy();
  }
}
for (const [width, height] of [
  [375, 667],
  [390, 844],
  [430, 932],
  [768, 1024],
]) {
  for (const landscape of [false, true]) {
    test(`customer screens fit ${width}x${height} ${landscape ? "landscape" : "portrait"}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(landscape ? { width: height, height: width } : { width, height });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await setup(page);
      await expect(page.getByText("Kho Sài Gòn", { exact: true }).first()).toBeVisible();
      await assertFits(page);
      await page.screenshot({ path: testInfo.outputPath("home.png") });
      await page.getByRole("button", { name: "Tất cả (5)", exact: true }).tap();
      await expect(
        page.getByRole("heading", { name: "Tất cả lịch hẹn", exact: true }),
      ).toBeVisible();
      await assertFits(page);
      await page.screenshot({ path: testInfo.outputPath("appointments.png") });
      await page.getByRole("button", { name: "Đóng", exact: true }).tap();
      await openDetail(page);
      await expect(page.getByText("SG-023", { exact: true })).toBeVisible();
      await assertFits(page);
      await page.screenshot({ path: testInfo.outputPath("detail.png") });
      expect(errors).toEqual([]);
    });
  }
}
test("detail uses actual assignment, dimensions, payment and reference QR without unsupported claims", async ({
  page,
}) => {
  const { calls } = await setup(page);
  await openDetail(page);
  await expect(page.getByText("1.4 m × 1.4 m", { exact: true })).toBeVisible();
  await expect(page.getByText("4.800.000 đ", { exact: true })).toBeVisible();
  await expect(page.getByText("Trần Bình", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Mã QR mở hồ sơ đặt kho" })).toBeVisible();
  await expect(page.getByText(/Cửa buồng|VNPay|Tầng 1|HỢP LỆ VÀ SẴN SÀNG/)).toHaveCount(0);
  expect(calls.some((c) => c.path.endsWith(`/appointments/${appointment.id}`))).toBeTruthy();
  expect(calls.every((c) => c.method === "GET")).toBeTruthy();
});
test("facility search uses catalog parameters and selection stays inside the app", async ({
  page,
}) => {
  await setup(page);
  await page.getByRole("textbox", { name: "Tìm cơ sở lưu trữ", exact: true }).fill("Hà Nội");
  const request = page.waitForRequest((req) => {
    const url = new URL(req.url());
    return (
      url.pathname.endsWith("/facilities/catalog") && url.searchParams.get("search") === "Hà Nội"
    );
  });
  await page.getByRole("button", { name: "Tìm kho", exact: true }).tap();
  await request;
  await expect(page.getByText("Kho Hà Nội", { exact: true })).toBeVisible();
  const selection = page.getByRole("button", { name: "Xem kho & Đặt", exact: true });
  await expect(selection).toHaveCount(1);
  await selection.tap();
  await expect(page.getByRole("heading", { name: "Đặt kho mới", exact: true })).toBeVisible();
  expect(page.context().pages()).toHaveLength(1);
});
test("calendar uses real Vietnamese dates, filters status and supports navigating weeks", async ({
  page,
}) => {
  await setup(page);
  await page.getByRole("button", { name: "Tất cả (5)", exact: true }).tap();
  await expect(page.getByRole("button", { name: /^Xem chi tiết:/ })).toHaveCount(3);
  await page.getByRole("tab", { name: "Đã hoàn tất (1)", exact: true }).tap();
  await expect(page.getByRole("button", { name: /^Xem chi tiết:/ })).toHaveCount(1);
  await page.getByRole("tab", { name: "Tất cả (5)", exact: true }).tap();
  await page
    .getByRole("button", { name: /06\/11\/2026/ })
    .and(page.locator("[aria-pressed]"))
    .tap();
  await expect(page.getByRole("button", { name: /^Xem chi tiết:/ })).toHaveCount(1);
  await page.getByRole("button", { name: "Tuần sau", exact: true }).tap();
  await expect(page.getByRole("button", { name: /^Xem chi tiết: Kho Hà Nội,/ })).toBeVisible();
  await page.getByRole("tab", { name: "Đã hủy / Vắng hẹn (1)", exact: true }).tap();
  await expect(page.getByRole("button", { name: /^Xem chi tiết:/ })).toHaveCount(1);
  await page.getByRole("button", { name: "Tuần trước", exact: true }).tap();
  await expect(page.getByText("Chưa có lịch hẹn trong tuần đã chọn.")).toBeVisible();
});
test("missing assignment and pending payment never claim readiness", async ({ page }) => {
  await setup(page, { unpaid: true });
  await openDetail(page);
  await expect(page.getByText("Chờ phân bổ buồng kho", { exact: true })).toBeVisible();
  await expect(page.getByText("Chờ thanh toán", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Mã QR mở hồ sơ đặt kho" })).toHaveCount(0);
});
test("empty and failed responses retain retry and safe navigation", async ({ page }) => {
  const { options } = await setup(page, { failAppointments: true });
  await expect(page.getByText("Không thể tải dữ liệu. Vui lòng thử lại.")).toBeVisible();
  options.failAppointments = false;
  await page.getByRole("button", { name: "Thử lại", exact: true }).tap();
  await expect(page.getByRole("button", { name: "Tất cả (5)", exact: true })).toBeVisible();
  options.failDetail = true;
  await openDetail(page);
  await expect(page.getByText("Không thể tải dữ liệu. Vui lòng thử lại.")).toBeVisible();
  await expect(page.getByRole("img", { name: "Mã QR mở hồ sơ đặt kho" })).toHaveCount(0);
  await page.getByRole("button", { name: "Đóng", exact: true }).tap();
  await expect(page.getByRole("heading", { name: "Tìm & Thuê buồng kho" })).toBeVisible();
});
test("empty account and all three routes pass accessibility checks", async ({ page }) => {
  await setup(page);
  for (const action of [undefined, "all", "detail"]) {
    if (action === "all") await page.getByRole("button", { name: "Tất cả (5)", exact: true }).tap();
    if (action === "detail") await openDetail(page);
    expect(
      (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
        .violations,
    ).toEqual([]);
  }
});
test("empty home has zero counts and no fabricated appointments", async ({ page }) => {
  await setup(page, { empty: true });
  await expect(page.getByText("Bạn chưa có lịch nhận kho sắp tới.")).toBeVisible();
  await expect(page.getByText("Chưa có cơ sở để hiển thị.")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Xem chi tiết:/ })).toHaveCount(0);
});
