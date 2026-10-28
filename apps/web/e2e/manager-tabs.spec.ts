import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { f5facility, f5id, f5staff, flow5Fixture, mockFlow5 } from "./support/flow5-fixture";

async function tabsFixture(page: Page) {
  await mockFlow5(page, flow5Fixture());
  const queries: URL[] = [],
    writes: Record<string, unknown>[] = [];
  const now = new Date().toISOString();
  const rental = {
    id: f5id(700),
    bookingId: f5id(701),
    bookingCode: "BK-RENTAL-01",
    customerId: f5id(702),
    customerName: "Khách thuê kiểm thử",
    customerEmail: "customer@example.test",
    customerPhone: "0901234567",
    facilityId: f5facility,
    unitCode: "HCM-TEST-01",
    unitTypeName: "Kho tiêu chuẩn",
    status: "ACTIVE",
    startAt: now,
    expectedEndAt: now,
    closedAt: null,
    depositAmount: "1000000",
  };
  const ticket = {
    id: f5id(710),
    bookingId: rental.bookingId,
    bookingCode: rental.bookingCode,
    facilityId: f5facility,
    customerName: rental.customerName,
    rentalId: rental.id,
    storageUnitId: f5id(6),
    paymentId: null,
    category: "UNIT",
    subject: "Cửa kho bị kẹt",
    status: "OPEN",
    priority: "NORMAL",
    version: 0,
    actionDueAt: now,
    createdAt: now,
    updatedAt: now,
    closedAt: null,
    closureKind: null,
    closeReason: null,
    assignedStaffId: null as string | null,
    assignedStaffName: null as string | null,
    assignmentVersion: 0,
    firstOnsiteStartedAt: null,
    firstBomResponseAt: null,
    latestReportId: null as string | null,
  };
  const messages = [
    {
      id: f5id(711),
      kind: "PUBLIC_REPLY",
      content: "Nhờ hỗ trợ kiểm tra cửa kho.",
      authorName: rental.customerName,
      createdAt: now,
      attachments: [],
    },
  ];
  let conflict = false;
  await page.route("**/api/facility-workspace/**", async (route) => {
    const url = new URL(route.request().url());
    queries.push(url);
    let data: unknown;
    if (url.pathname.endsWith("/actions")) {
      const input = route.request().postDataJSON();
      writes.push(input);
      if (conflict) {
        conflict = false;
        ticket.version++;
        return route.fulfill({
          status: 409,
          json: {
            success: false,
            error: { message: "Hồ sơ đã thay đổi. Vui lòng tải lại trước khi tiếp tục." },
          },
        });
      }
      expect(input.version).toBe(ticket.version);
      ticket.version++;
      if (input.action === "ASSIGN") {
        ticket.status = "IN_PROGRESS";
        ticket.assignedStaffId = input.staffId;
        ticket.assignedStaffName = "Nhân viên một";
        ticket.assignmentVersion++;
      }
      if (input.action === "ACCEPT") {
        ticket.status = "CLOSED";
        ticket.closeReason = input.reason;
      }
      if (input.action === "REOPEN") {
        ticket.status = "OPEN";
        ticket.assignedStaffId = null;
        ticket.assignedStaffName = null;
      }
      if (input.action === "REPLY" || input.action === "NOTE")
        messages.unshift({
          id: f5id(720 + ticket.version),
          kind: input.action === "NOTE" ? "INTERNAL_NOTE" : "PUBLIC_REPLY",
          content: input.content,
          authorName: "Quản lý",
          createdAt: now,
          attachments: [],
        });
      data = { ticket, messages, totalMessages: messages.length, limit: 20, offset: 0 };
    } else if (url.pathname.endsWith("/support"))
      data = { items: [ticket], total: 1, limit: 20, offset: 0 };
    else data = { ticket, messages, totalMessages: messages.length, limit: 20, offset: 0 };
    return route.fulfill({ json: { success: true, data } });
  });
  await page.route(`**/api/facilities/${f5facility}/rentals**`, async (route) => {
    const url = new URL(route.request().url());
    queries.push(url);
    const item = {
      id: rental.id,
      bookingId: rental.bookingId,
      userId: rental.customerId,
      bookingCode: rental.bookingCode,
      facilityId: f5facility,
      status: "ACTIVE",
      startAt: now,
      endAt: now,
      customer: {
        userId: rental.customerId,
        name: rental.customerName,
        email: rental.customerEmail,
        phone: rental.customerPhone,
      },
      unit: {
        id: f5id(6),
        code: rental.unitCode,
        unitTypeId: f5id(2),
        unitTypeName: rental.unitTypeName,
        sizeLabel: "4 m²",
      },
    };
    const data = url.pathname.endsWith("/payments")
      ? {
          items: [
            {
              id: f5id(703),
              paymentCode: "PAY-001",
              amount: "2000000",
              status: "SUCCEEDED",
              currency: "VND",
              paidAt: now,
              createdAt: now,
              refundedAt: null,
              refundAmount: null,
              refundReason: null,
            },
          ],
          total: 1,
          limit: 20,
          offset: 0,
        }
      : url.pathname.endsWith(rental.id)
        ? item
        : { items: [item], total: 1, limit: 20, offset: 0 };
    await route.fulfill({ json: { success: true, data } });
  });
  await page.route("**/api/reports/**", (route) => {
    const url = new URL(route.request().url());
    queries.push(url);
    if (url.pathname.endsWith("/export"))
      return route.fulfill({
        contentType: "text/csv; charset=utf-8",
        headers: { "Content-Disposition": 'attachment; filename="facility-report.csv"' },
        body: "booking,status\nBK-RENTAL-01,ACTIVE\n",
      });
    const data = url.pathname.endsWith("/overview")
      ? {
          period: { from: "2026-10-01", to: "2026-10-27", timeZone: "Asia/Ho_Chi_Minh" },
          asOf: now,
          currency: "VND",
          summary: {
            inventory: {
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
            },
          },
          facilities: [],
        }
      : url.pathname.endsWith("/revenue/monthly")
        ? {
            period: { from: "2026-10-01", to: "2026-10-27", timeZone: "Asia/Ho_Chi_Minh" },
            asOf: now,
            currency: "VND",
            items: [
              {
                month: "2026-10",
                cashReceived: "2000000",
                rentalCollected: "1900000",
                depositCollected: "100000",
                renewalCollected: "0",
                extraChargeCollected: "0",
                returnDebtCollected: "0",
                cashRefunded: "0",
                chargeRefunded: "0",
                netCash: "1900000",
                unsupportedCurrencyPayments: 0,
              },
            ],
          }
        : url.pathname.endsWith("/rentals")
          ? {
              items: [
                {
                  id: rental.id,
                  bookingCode: rental.bookingCode,
                  unitCode: rental.unitCode,
                  status: rental.status,
                  expectedEndAt: now,
                },
              ],
            }
          : url.pathname.endsWith("/revenue")
            ? {
                items: [
                  {
                    facility: { id: f5facility, name: "Cơ sở kiểm thử", code: "HCM-TEST" },
                    metrics: { cashReceived: "2000000", netCash: "1900000" },
                  },
                ],
              }
            : {
                items: [
                  {
                    facility: { id: f5facility, name: "Cơ sở kiểm thử" },
                    metrics: { cashReceived: "2000000", netCash: "1900000" },
                  },
                ],
              };
    return route.fulfill({ json: { success: true, data } });
  });
  return {
    queries,
    writes,
    ticket,
    conflict: () => {
      conflict = true;
    },
  };
}

test("FM opens a tenant rental and real transaction states within the selected facility", async ({
  page,
}, testInfo) => {
  const f = await tabsFixture(page);
  await page.goto("/facility-manager/rentals");
  await expect(page.getByText("Khách thuê kiểm thử", { exact: true })).toBeVisible();
  expect(
    f.queries.some(
      (q) =>
        q.pathname === `/api/facilities/${f5facility}/rentals` &&
        q.searchParams.get("status") === "ACTIVE",
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "Xem chi tiết", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Lịch sử giao dịch", exact: true })).toBeVisible();
  await expect(page.getByText("PAY-001", { exact: true })).toBeVisible();
  await expect(page.getByText("Đã thanh toán", { exact: true })).toBeVisible();
  await page.screenshot({
    path: `/tmp/metastorage-manager-features/rental-${testInfo.project.name}.png`,
    fullPage: true,
    animations: "disabled",
  });
  expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("FM assigns a support ticket, retains drafts on conflict, accepts the report and reopens", async ({
  page,
}, testInfo) => {
  const f = await tabsFixture(page);
  await page.goto("/facility-manager/support");
  await page.getByRole("link", { name: "Xem chi tiết", exact: true }).click();
  const action = page.getByRole("combobox", { name: "Thao tác", exact: true });
  await action.selectOption("ASSIGN");
  await page.getByRole("button", { name: "Giao / Đổi nhân viên", exact: true }).click();
  await expect(
    page.getByText("Nhập nội dung hoặc lý do từ 3 ký tự.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("combobox", { name: /^Nhân viên được giao/ }).selectOption(f5staff);
  await page
    .getByRole("textbox", { name: /^Nội dung \/ Lý do/ })
    .fill("Kiểm tra cửa kho với khách.");
  await page.getByRole("button", { name: "Giao / Đổi nhân viên", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Xác nhận thao tác", exact: true })
    .click();
  await expect(
    page.getByText("Đã phân công nhân viên xử lý phiếu.", { exact: true }),
  ).toBeVisible();
  expect(f.writes[0]).toMatchObject({ action: "ASSIGN", staffId: f5staff, version: 0 });
  f.conflict();
  await action.selectOption("NOTE");
  await page
    .getByRole("textbox", { name: /^Nội dung \/ Lý do/ })
    .fill("Ghi chú riêng cho quản lý.");
  await page.getByRole("button", { name: "Thêm ghi chú nội bộ", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Hồ sơ đã thay đổi");
  await expect(page.getByRole("textbox", { name: /^Nội dung \/ Lý do/ })).toHaveValue(
    "Ghi chú riêng cho quản lý.",
  );
  await page.getByRole("button", { name: "Thêm ghi chú nội bộ", exact: true }).click();
  await expect(page.getByText("Ghi chú riêng cho quản lý.", { exact: true })).toBeVisible();
  f.ticket.latestReportId = f5id(799);
  await page.reload();
  await action.selectOption("ACCEPT");
  await page
    .getByLabel("Nội dung / Lý do", { exact: true })
    .fill("Đã kiểm tra báo cáo và xác nhận xử lý xong.");
  await page.getByRole("button", { name: "Duyệt báo cáo và đóng phiếu", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Xác nhận thao tác", exact: true })
    .click();
  await expect(page.getByText("Đã đóng", { exact: true })).toBeVisible();
  await page.screenshot({
    path: `/tmp/metastorage-manager-features/support-${testInfo.project.name}.png`,
    fullPage: true,
    animations: "disabled",
  });
  await action.selectOption("REOPEN");
  await page
    .getByRole("textbox", { name: /^Nội dung \/ Lý do/ })
    .fill("Khách báo cần kiểm tra lại.");
  await page.getByRole("button", { name: "Mở lại phiếu", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Xác nhận thao tác", exact: true })
    .click();
  await expect(page.getByText("Mới tiếp nhận", { exact: true })).toBeVisible();
  expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
});

test("FM validates report dates and exports all results with the applied facility filters", async ({
  page,
}, testInfo) => {
  const f = await tabsFixture(page);
  await page.goto("/facility-manager/dashboard#manager-reports");
  await page.getByLabel("Từ ngày", { exact: true }).fill("2026-10-28");
  await page.getByLabel("Đến ngày", { exact: true }).fill("2026-10-01");
  await page.getByRole("button", { name: "Xem báo cáo", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Chọn khoảng ngày hợp lệ");
  await page.getByRole("combobox", { name: "Loại báo cáo", exact: true }).selectOption("rentals");
  await page.getByRole("combobox", { name: "Trạng thái", exact: true }).selectOption("ACTIVE");
  await page.getByRole("button", { name: "Xem báo cáo", exact: true }).click();
  await expect(page.getByText("BK-RENTAL-01 · HCM-TEST-01", { exact: true })).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Tải CSV", exact: true }).click();
  expect((await downloaded).suggestedFilename()).toBe("facility-report.csv");
  const request = f.queries.find((q) => q.pathname.endsWith("/export"));
  expect(request?.searchParams.get("facilityId")).toBe(f5facility);
  expect(request?.searchParams.get("status")).toBe("ACTIVE");
  expect(request?.searchParams.has("from")).toBe(false);
  await page.screenshot({
    path: `/tmp/metastorage-manager-features/reports-${testInfo.project.name}.png`,
    fullPage: true,
    animations: "disabled",
  });
  expect((await new AxeBuilder({ page }).include("#manager-reports").analyze()).violations).toEqual(
    [],
  );
});
