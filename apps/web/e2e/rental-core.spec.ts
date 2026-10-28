import { expect, test } from "@playwright/test";
import { f5facility, f5id, f5now, f5type, flow5Fixture, mockFlow5 } from "./support/flow5-fixture";

const rentalId = f5id(901),
  owner = f5id(902),
  bookingId = f5id(903);
const core = {
  id: rentalId,
  bookingId,
  userId: owner,
  bookingCode: "SX-RENTAL-CORE",
  status: "ACTIVE",
  startAt: f5now,
  endAt: "2026-12-01T03:00:00.000Z",
};

test("FM uses the canonical facility rental API and sees basic rental and booking payment details", async ({
  page,
}) => {
  await mockFlow5(page, flow5Fixture());
  const calls: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/")) calls.push(r.url());
  });
  await page.route(`**/api/facilities/${f5facility}/rentals**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    const item = {
      ...core,
      facilityId: f5facility,
      customer: {
        userId: owner,
        name: "Khách thuê tối giản",
        email: "customer@example.test",
        phone: "0900000000",
      },
      unit: {
        id: f5id(6),
        code: "HCM-TEST-01",
        unitTypeId: f5type,
        unitTypeName: "Kho kiểm thử",
        sizeLabel: "4 m²",
      },
    };
    const data = path.endsWith("/payments")
      ? { items: [], total: 0, limit: 20, offset: 0 }
      : path.endsWith(rentalId)
        ? item
        : { items: [item], total: 1, limit: 20, offset: 0 };
    await route.fulfill({ json: { success: true, data } });
  });
  await page.goto("/facility-manager/rentals");
  await expect(page.getByText("Khách thuê tối giản", { exact: true })).toBeVisible();
  await expect(page.getByRole("option")).toHaveText(["Tất cả", "Đang thuê", "Đã đóng"]);
  await page.getByRole("link", { name: "Xem chi tiết", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Lịch sử giao dịch" })).toBeVisible();
  await expect(page.getByText("customer@example.test · 0900000000")).toBeVisible();
  await expect(page.getByText("Đổi nhân viên", { exact: true })).toHaveCount(0);
  expect(calls.some((c) => c.includes("facility-workspace/rentals"))).toBe(false);
  expect(calls.some((c) => /rental-charges|rental-renewals|return-requests/.test(c))).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("Customer reads their rental without invoking removed return, charge or renewal APIs", async ({
  page,
}) => {
  await mockFlow5(page, flow5Fixture(), "CUSTOMER", owner);
  const item = {
    ...core,
    facility: { id: f5facility, name: "Cơ sở kiểm thử", address: "Địa chỉ kiểm thử" },
    unitType: { id: f5type, name: "Kho kiểm thử", sizeLabel: "4 m²" },
    storageUnit: { id: f5id(6), code: "HCM-TEST-01" },
    bookingStatus: "CHECKED_IN",
    actions: { canCancel: false, canReschedule: false, note: "Chỉ xem hồ sơ" },
    customer: {
      userId: owner,
      name: "Khách thuê",
      email: "customer@example.test",
      phone: "0900000000",
    },
  };
  const calls: string[] = [];
  await page.route("**/api/rentals/**", async (route) => {
    const url = new URL(route.request().url());
    calls.push(url.pathname);
    const data = url.pathname.endsWith("/mine")
      ? { items: [item], nextCursor: null }
      : url.pathname.endsWith("/payments")
        ? []
        : item;
    await route.fulfill({ json: { success: true, data } });
  });
  await page.goto(`/customer/storage/${rentalId}`);
  await expect(page.getByRole("heading", { name: "SX-RENTAL-CORE", exact: true })).toBeVisible();
  await expect(page.getByText("HCM-TEST-01", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Gửi yêu cầu hỗ trợ" })).toHaveAttribute(
    "href",
    `/customer/support/new?bookingId=${bookingId}`,
  );
  await expect(page.getByRole("button", { name: /Gia hạn|Báo giá|Trả kho/ })).toHaveCount(0);
  expect(calls.every((c) => !/renewal|charge|return/.test(c))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
