import AxeBuilder from "@axe-core/playwright";
import type {
  ReturnRefundDto,
  ReturnRefundSummaryDto,
  ReturnSettlementDto,
} from "@metastorage/contracts";
import { expect, type Page, test } from "@playwright/test";
import { F3 } from "../src/features/returns/integration.messages";

const rentalId = "85000000-0000-4000-8000-000000000003";
const requestId = "86000000-0000-4000-8000-000000000003";
const facilityId = "30000000-0000-4000-8000-000000000001";
const bookingId = "50000000-0000-4000-8000-000000000001";
const actorId = "40000000-0000-4000-8000-000000000001";
const photoId = "88000000-0000-4000-8000-000000000001";
const timeId = "89000000-0000-4000-8000-000000000001";
const now = "2026-10-22T07:30:00.000Z";
const image = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

async function openPage(page: Page, path: string) {
  // The local browser environment occasionally denies a framework asset before hydration.
  // Retry navigation only for that transport failure, never for a UI assertion or API error.
  for (let attempt = 0; attempt < 3; attempt++) {
    let blockedAsset = false;
    const failed = (request: import("@playwright/test").Request) => {
      if (
        ["document", "script", "stylesheet"].includes(request.resourceType()) &&
        request.failure()?.errorText.includes("ERR_NETWORK_ACCESS_DENIED")
      )
        blockedAsset = true;
    };
    page.on("requestfailed", failed);
    try {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      if (!blockedAsset) return;
    } catch (error) {
      if (
        !blockedAsset &&
        !String(error).includes("ERR_NETWORK_ACCESS_DENIED") &&
        !String(error).includes("chrome-error://chromewebdata/")
      )
        throw error;
      await page.goto("about:blank");
    } finally {
      page.off("requestfailed", failed);
    }
  }
  throw new Error("Local browser denied framework assets after three navigation attempts");
}

async function setup(page: Page, role: string, conflictSetting = false) {
  const writes: Array<{ path: string; body: Record<string, unknown> }> = [];
  const rental = {
    id: rentalId,
    bookingId,
    bookingCode: "BK-FLOW3-TEST",
    facility: { id: facilityId, name: "Cơ sở kiểm thử", address: "Địa chỉ kiểm thử" },
    unitType: { id: actorId, name: "Kho tiêu chuẩn", sizeLabel: "4 m²" },
    physicalUnit: { id: actorId, code: "HCM-TEST-03" },
    startAt: now,
    expectedEndAt: "2026-11-22T07:30:00.000Z",
    status: "ACTIVE",
    bookingStatus: "ACTIVE",
    actions: { canCancel: false, canReschedule: false, note: "Theo dõi và gửi yêu cầu trả kho." },
    timeline: [],
    depositAmount: "500000",
    actualReturnAt: now,
    closedAt: null,
  };
  const request = {
    id: requestId,
    rentalId,
    facilityId,
    status: "INSPECTING",
    version: 2,
    assignedStaffId: actorId,
    startsAt: now,
    endsAt: "2026-10-22T09:00:00.000Z",
    timezone: "Asia/Ho_Chi_Minh",
    reason: "Hồ sơ kiểm thử trả kho",
    manualReviewRequired: false,
    createdAt: now,
  };
  const detail = {
    context:
      role === "CUSTOMER"
        ? null
        : {
            booking: { id: bookingId, bookingCode: "BK-FLOW3-TEST" },
            customer: { id: null, name: "Guest demo", phone: "0901234567" },
            rental: {
              id: rentalId,
              status: "RETURN_PENDING",
              expectedEndAt: now,
              depositSnapshot: "500000.00",
            },
            unit: { id: actorId, code: "HCM-TEST-03", unitTypeName: "Standard", sizeLabel: "4 m²" },
            facility: { id: facilityId, name: "Demo facility" },
            assignedStaff: { id: actorId, name: "Staff demo" },
          },
    refundSummary: null as ReturnRefundSummaryDto | null,
    request,
    actualReturnAt: now,
    inspections: [],
    evidence: [
      {
        id: photoId,
        filename: "evidence.png",
        mimeType: "image/png",
        byteSize: 70,
        purpose: "TIME_CORRECTION",
      },
    ],
    settlements: [] as ReturnSettlementDto[],
    refunds: [] as ReturnRefundDto[],
    timeChanges: [] as Array<Record<string, unknown>>,
    audit: [],
  };
  let rate = 25;
  let settingVersion = 1;
  let conflicted = false;
  await page.route("**/api/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace(/^\/api/, "");
    const method = req.method();
    const headers = {
      "Access-Control-Allow-Origin": new URL(
        page.url() === "about:blank" ? "http://localhost:3000" : page.url(),
      ).origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "content-type,authorization",
      "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
    };
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers });
    let data: unknown = null;
    if (method !== "GET") writes.push({ path, body: req.postDataJSON() ?? {} });
    if (path === "/auth/me")
      data = {
        id: actorId,
        name: "Người kiểm thử",
        email: "test@example.com",
        role,
        assignedFacilityId: facilityId,
        isActive: true,
      };
    else if (path === "/facilities/my-assignments")
      data = [
        {
          id: actorId,
          userId: actorId,
          facilityId,
          facilityName: "Cơ sở kiểm thử",
          isActive: true,
          role,
        },
      ];
    else if (path === `/facilities/${facilityId}/staff`)
      data = [{ id: actorId, name: "Nhân viên kiểm thử", isActive: true }];
    else if (path === `/rentals/${rentalId}`) data = rental;
    else if (path === `/rentals/${rentalId}/return-requests`) data = [request];
    else if (path === `/rentals/${rentalId}/payments`)
      data = [
        {
          id: actorId,
          paymentCode: "PAY-F3",
          provider: "SEPAY",
          status: "SUCCEEDED",
          totalAmount: "1500000.00",
          currency: "VND",
          paidAt: now,
          createdAt: now,
          refundedAt: null,
          refundAmount: null,
          returnRefunds: [],
        },
      ];
    else if (path === "/booking/tracking/BK-FLOW3-TEST")
      data = {
        bookingCode: rental.bookingCode,
        status: "CHECKED_IN",
        facility: rental.facility,
        unitType: rental.unitType,
        checkInSlotStart: now,
        checkInSlotEnd: now,
        rentalEndAt: rental.expectedEndAt,
        durationMonths: 1,
        contact: { fullName: "Khách kiểm thử", email: "test@example.com", phone: "0901234567" },
        pricing: {
          monthlyRateSnapshot: "1000000",
          rentalFeeAmount: "1000000",
          depositAmount: "500000",
          totalAmount: "1500000",
        },
        payment: {
          status: "SUCCEEDED",
          paidAt: now,
          refundAmount: null,
          depositForfeitedAmount: "0",
        },
      };
    else if (path === "/booking/tracking/BK-FLOW3-TEST/rental") data = rental;
    else if (path === "/booking/tracking/BK-FLOW3-TEST/payments") data = [];
    else if (path.endsWith("/contracts") && method === "GET")
      data = [
        {
          id: actorId,
          bookingId,
          version: 1,
          filename: "contract.pdf",
          byteSize: 100,
          pageCount: 1,
          status: "ISSUED",
          issuedAt: now,
          uploadedAt: now,
          currentIssued: true,
          usedForHandover: true,
        },
      ];
    else if (path.endsWith("/pdf"))
      return route.fulfill({
        headers: { ...headers, "Content-Type": "application/pdf" },
        body: "%PDF-1.4\n%%EOF",
      });
    else if (path === `/facilities/${facilityId}/return-requests`) {
      const offset = Number(new URL(req.url()).searchParams.get("offset") ?? 0);
      data =
        offset === 0
          ? Array.from({ length: 20 }, (_, i) => ({
              ...request,
              context: detail.context,
              id: `86000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
            }))
          : [];
    } else if (path === `/return-requests/${requestId}`) data = detail;
    else if (path.endsWith("/evidence") && method === "POST") {
      detail.request.version++;
      data = { ...detail.evidence[0], purpose: req.postDataJSON().purpose };
      detail.evidence[0] = data as (typeof detail.evidence)[number];
    } else if (path.endsWith(`/evidence/${photoId}`))
      data = {
        id: photoId,
        filename: "evidence.png",
        url: `data:image/png;base64,${image.toString("base64")}`,
      };
    else if (path.endsWith("/time-changes") && method === "POST") {
      const body = req.postDataJSON();
      detail.request.version++;
      detail.timeChanges.push({
        id: timeId,
        previousAt: now,
        proposedAt: body.actualReturnAt,
        status: "PENDING",
        reason: body.reason,
        evidencePhotoIds: [photoId],
        createdAt: now,
      });
      data = { id: timeId, status: "PENDING" };
    } else if (path.endsWith("/settlement/preview")) {
      const input = req.postDataJSON();
      const remaining = String(
        500000 - Number(input.damageAmount) + Number(input.unusedRentRefundAmount),
      );
      data = {
        requestId,
        version: detail.request.version,
        canClose: true,
        blockingReasons: [],
        calculation: {
          depositSnapshot: "500000.00",
          rateSnapshot: rate,
          overdueFeeAmount: "0.00",
          damageAmount: input.damageAmount,
          unusedRentRefundAmount: input.unusedRentRefundAmount,
          debtAmount: "0",
          refundEntitlement: remaining,
          remainingRefund: remaining,
          allocationKnown: true,
          remainingDepositRefund: String(500000 - Number(input.damageAmount)),
          remainingRentRefund: input.unusedRentRefundAmount,
          confirmedDepositRefund: "0",
          confirmedRentRefund: "0",
        },
      };
    } else if (path.endsWith("/settlement")) {
      const input = req.postDataJSON();
      const settlement = settlementFixture(input.unusedRentRefundAmount);
      detail.settlements.push(settlement);
      detail.refundSummary = summaryFixture(input.unusedRentRefundAmount);
      detail.request.status = "COMPLETED";
      detail.request.version++;
      data = settlement;
    } else if (path.endsWith("/refunds/confirm")) {
      const input = req.postDataJSON();
      detail.request.version++;
      detail.refunds.push({
        id: timeId,
        amount: input.amount,
        depositRefundAmount: input.depositRefundAmount,
        rentRefundAmount: input.rentRefundAmount,
        reference: input.reference,
        confirmedBy: actorId,
        confirmedAt: now,
        settlementId: actorId,
      });
      const summary = detail.refundSummary;
      if (!summary) throw new Error("Refund fixture must include source balances");
      summary.remainingRefund = String(Number(summary.remainingRefund) - Number(input.amount));
      summary.remainingDepositRefund = String(
        Number(summary.remainingDepositRefund) - Number(input.depositRefundAmount),
      );
      summary.remainingRentRefund = String(
        Number(summary.remainingRentRefund) - Number(input.rentRefundAmount),
      );
      summary.confirmedDepositRefund = String(
        Number(summary.confirmedDepositRefund) + Number(input.depositRefundAmount),
      );
      summary.confirmedRentRefund = String(
        Number(summary.confirmedRentRefund) + Number(input.rentRefundAmount),
      );
      if (detail.settlements[0]) detail.settlements[0].remainingRefund = summary.remainingRefund;
      data = {
        id: timeId,
        amount: input.amount,
        confirmedAt: now,
        version: detail.request.version,
        refundSummary: summary,
      };
    } else if (path.endsWith("/decision")) {
      detail.request.version++;
      data = { id: timeId, status: "APPROVED" };
    } else if (path === "/notifications")
      data = [
        {
          id: actorId,
          bookingId,
          type: "RENTAL_EXPIRING",
          subject: "Thông báo kiểm thử",
          body: "Hợp đồng sắp hết hạn.",
          occurredAt: now,
        },
      ];
    else if (path === "/system-settings") {
      if (method === "PUT") {
        if (conflictSetting && !conflicted) {
          conflicted = true;
          settingVersion++;
          return route.fulfill({
            status: 409,
            headers,
            json: { success: false, message: "Stale version" },
          });
        }
        rate = req.postDataJSON().value;
        settingVersion++;
        data = { key: req.postDataJSON().key, value: rate, version: settingVersion };
      } else
        data = (
          role === "SYSTEM_ADMIN"
            ? ["EXPIRY_REMINDER_DAYS", "ABANDONED_REVIEW_DAYS"]
            : ["OVERDUE_FEE_RATE"]
        ).map((key) => ({
          key,
          value: rate,
          version: settingVersion,
          description: "Cấu hình kiểm thử",
          unit: "PERCENT",
          category: "FINANCE",
          valueType: "INTEGER",
          updatedBy: actorId,
          updatedAt: now,
        }));
    } else if (path.endsWith("/history")) data = [];
    else if (path === "/return-policy/checklist")
      data = {
        id: actorId,
        version: 1,
        createdAt: now,
        items: ["REMAINING_PROPERTY", "UNIT_CONDITION", "HYGIENE_SAFETY", "EVIDENCE"].map(
          (group, index) => ({
            code: `CODE_${index}`,
            label: `Tiêu chí ${index}`,
            group,
            serious: false,
          }),
        ),
      };
    else if (path === "/facilities")
      data = [{ id: facilityId, name: "Cơ sở kiểm thử", isActive: true }];
    else if (path.endsWith("/return-calendar"))
      data = {
        facilityId,
        timezone: "Asia/Ho_Chi_Minh",
        holidays: [],
        reminderTime: "09:00",
        version: 1,
        operatingHours: [{ dayOfWeek: 1, openTime: "08:00:00", closeTime: "17:00:00" }],
      };
    else
      return route.fulfill({
        status: 404,
        headers,
        json: { success: false, message: "Fixture endpoint unavailable" },
      });
    return route.fulfill({ headers, json: { success: true, data } });
  });
  return { writes, detail };
}

async function inspect(page: Page, name: string) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator('[role="alert"]').filter({ hasText: /\S/ })).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: `test-results/flow3-${name}-${page.viewportSize()?.width}.png`,
    fullPage: true,
  });
}

test("Customer sees payment facts and can open a private PDF", async ({ page }) => {
  await setup(page, "CUSTOMER");
  await openPage(page, `/customer/storage/${rentalId}`);
  await expect(
    page.getByRole("heading", { name: "Lịch sử thanh toán và hoàn tiền" }),
  ).toBeVisible();
  await expect(page.getByText("PAY-F3", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Xem PDF", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("link", { name: "Tải PDF" })).toHaveAttribute("href", /^blob:/);
  await page.getByRole("button", { name: "Đóng", exact: true }).click();
  await inspect(page, "customer");
});

test("FM sees operational context and reviews settlement before closing", async ({ page }) => {
  const { writes } = await setup(page, "FACILITY_MANAGER");
  await openPage(page, "/facility-manager/returns");
  await page.getByRole("button", { name: F3.loadMore, exact: true }).click();
  await expect(page.getByRole("button", { name: F3.loadMore, exact: true })).toHaveCount(0);
  await openPage(page, `/facility-manager/returns/${requestId}`);
  await expect(page.getByText("Guest demo", { exact: true })).toBeVisible();
  await expect(page.getByText("HCM-TEST-03", { exact: false })).toBeVisible();
  const form = page
    .locator("form")
    .filter({ has: page.getByRole("button", { name: F3.preview, exact: true }) });
  await form.getByLabel(F3.reason, { exact: true }).fill("Checked inspection and physical return");
  await form.getByRole("button", { name: F3.preview, exact: true }).click();
  await expect(page.getByRole("button", { name: F3.previewRefresh, exact: true })).toBeEnabled();
  expect(writes.filter((w) => w.path.endsWith("/settlement"))).toHaveLength(0);
  await page.getByRole("button", { name: F3.previewRefresh, exact: true }).click();
  await expect(page.getByRole("dialog", { name: F3.finalConfirm })).toBeVisible();
  await inspect(page, "settlement-confirmation");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: F3.finalConfirm, exact: true })
    .click();
  await expect(page.getByRole("button", { name: F3.preview, exact: true })).toHaveCount(0);
  expect(writes.filter((w) => w.path.endsWith("/settlement/preview"))).toHaveLength(2);
  expect(writes.filter((w) => w.path.endsWith("/settlement"))).toHaveLength(1);
  await inspect(page, "manager");
});

test("FS proposes a correction with evidence and facility timezone", async ({ page }) => {
  const { writes } = await setup(page, "FACILITY_STAFF");
  await openPage(page, `/staff/returns/${requestId}`);
  await page.locator("summary").filter({ hasText: "Gửi đề xuất sửa giờ" }).click();
  await page.getByLabel("Giờ thực nhận đề xuất", { exact: true }).fill("2026-10-22T15:00");
  const form = page
    .locator("form")
    .filter({ has: page.getByRole("button", { name: "Gửi đề xuất sửa giờ" }) });
  await form.getByLabel("Lý do", { exact: true }).fill("Đối chiếu biên bản tiếp nhận");
  await form
    .locator('input[type="file"]')
    .setInputFiles({ name: "evidence.png", mimeType: "image/png", buffer: image });
  await expect(form.getByRole("button", { name: "Gửi đề xuất sửa giờ" })).toBeEnabled();
  await form.getByRole("button", { name: "Gửi đề xuất sửa giờ" }).click();
  await expect(page.getByText("Đã lưu thay đổi.", { exact: true })).toBeVisible();
  expect(writes.find((write) => write.path.endsWith("/time-changes"))?.body.actualReturnAt).toBe(
    "2026-10-22T08:00:00.000Z",
  );
  await inspect(page, "staff");
});

test("BOM updates overdue rate through system settings", async ({ page }) => {
  const { writes } = await setup(page, "BUSINESS_OPERATION_MANAGER");
  await openPage(page, "/operations/fees");
  await page.getByLabel("Tỷ lệ phí quá hạn (%)", { exact: true }).fill("30");
  await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(page.getByText("Đã lưu thay đổi.", { exact: true })).toBeVisible();
  expect(writes.find((write) => write.path === "/system-settings")?.body).toMatchObject({
    key: "OVERDUE_FEE_RATE",
    expectedVersion: 1,
    value: 30,
  });
  await inspect(page, "bom");
});

test("Admin calendar is readable and changing it requires acknowledgement", async ({ page }) => {
  const { writes } = await setup(page, "SYSTEM_ADMIN");
  await openPage(page, "/system-admin/return-settings");
  await expect(page.getByText("Tiêu chí", { exact: true })).toHaveCount(4);
  await page.getByRole("button", { name: "Lịch trả kho của cơ sở", exact: true }).click();
  await page.getByRole("combobox", { name: "Cơ sở", exact: true }).selectOption(facilityId);
  await expect(page.getByRole("button", { name: "Lưu thay đổi", exact: true })).toBeDisabled();
  await page.getByLabel("Tôi đã kiểm tra ảnh hưởng tới lịch check-in và trả kho").check();
  await expect(page.getByRole("button", { name: "Lưu thay đổi", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(page.getByText("Đã lưu thay đổi.", { exact: true })).toBeVisible();
  expect(
    writes.find((write) => write.path.endsWith("/return-calendar"))?.body.operatingHours,
  ).toEqual([{ dayOfWeek: 1, openTime: "08:00", closeTime: "17:00" }]);
  await inspect(page, "admin");
});

test("Guest rental is read-only and private data disappears when the session expires", async ({
  page,
}) => {
  await setup(page, "CUSTOMER");
  await openPage(page, "/booking/tracking?bookingCode=BK-FLOW3-TEST");
  await expect(page.getByRole("heading", { name: "Kho thuê của booking này" })).toBeVisible();
  await expect(page.getByText("HCM-TEST-03", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Gửi yêu cầu trả kho" })).toHaveCount(0);
  await inspect(page, "guest");
  await page.route("**/booking/tracking/BK-FLOW3-TEST/rental", (route) =>
    route.fulfill({
      status: 401,
      headers: {
        "Access-Control-Allow-Origin": new URL(page.url()).origin,
        "Access-Control-Allow-Credentials": "true",
      },
      json: { success: false, message: "Session expired" },
    }),
  );
  await openPage(page, page.url());
  await expect(page.getByRole("main").getByRole("alert")).toContainText(/hết hạn|không hợp lệ/);
  await expect(page.getByText("HCM-TEST-03", { exact: true })).toHaveCount(0);
});

test("A conflicting settings update keeps the draft for review and retry", async ({ page }) => {
  const { writes } = await setup(page, "BUSINESS_OPERATION_MANAGER", true);
  await openPage(page, "/operations/fees");
  const value = page.getByLabel("Tỷ lệ phí quá hạn (%)", { exact: true });
  await value.fill("40");
  await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: /Dữ liệu đã thay đổi/ })).toBeVisible();
  await expect(value).toHaveValue("40");
  await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(page.getByText("Đã lưu thay đổi.", { exact: true })).toBeVisible();
  const updates = writes.filter((write) => write.path === "/system-settings");
  expect(updates).toHaveLength(2);
  expect(updates[1]?.body).toMatchObject({ value: 40, expectedVersion: 2 });
});

function summaryFixture(rent = "0"): ReturnRefundSummaryDto {
  return {
    refundEntitlement: String(500000 + Number(rent)),
    remainingRefund: String(500000 + Number(rent)),
    allocationKnown: true,
    remainingDepositRefund: "500000.00",
    remainingRentRefund: rent,
    confirmedDepositRefund: "0.00",
    confirmedRentRefund: "0.00",
  };
}
function settlementFixture(rent = "0"): ReturnSettlementDto {
  return {
    id: actorId,
    requestId,
    revision: 1,
    depositSnapshot: "500000.00",
    rateSnapshot: 25,
    overdueFeeAmount: "0.00",
    damageAmount: "0.00",
    unusedRentRefundAmount: rent,
    refundEntitlement: String(500000 + Number(rent)),
    remainingRefund: String(500000 + Number(rent)),
    debtAmount: "0",
    actualReturnAt: now,
    refundDueDate: "2026-10-25",
    approvedBy: actorId,
    approvedAt: now,
  };
}
async function prepareRefund(page: Page, rent = "0") {
  const fixture = await setup(page, "FACILITY_MANAGER");
  fixture.detail.request.status = "COMPLETED";
  fixture.detail.refundSummary = summaryFixture(rent);
  fixture.detail.settlements.push(settlementFixture(rent));
  return fixture;
}
async function fillRefund(page: Page, deposit = "500000", rent = "0") {
  await page.getByLabel(F3.depositTransfer, { exact: true }).fill(deposit);
  await page.getByLabel(F3.rentTransfer, { exact: true }).fill(rent);
  await page.getByLabel(F3.reference, { exact: true }).fill("MANUAL-TEST-001");
  await page
    .locator('form input[type="file"]')
    .setInputFiles({ name: "proof.png", mimeType: "image/png", buffer: image });
  await page.getByLabel(F3.confirmTransfer, { exact: true }).check();
}

test("FM cannot close when preview reports blockers", async ({ page }) => {
  const { writes } = await setup(page, "FACILITY_MANAGER");
  await page.route("**/settlement/preview", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          requestId,
          version: 2,
          canClose: false,
          calculation: null,
          blockingReasons: [{ code: "INSPECTION", message: "Inspection requires completion" }],
        },
      },
    }),
  );
  await openPage(page, `/facility-manager/returns/${requestId}`);
  const form = page
    .locator("form")
    .filter({ has: page.getByRole("button", { name: F3.preview, exact: true }) });
  await form.getByLabel(F3.reason, { exact: true }).fill("Review inspection");
  await form.getByRole("button", { name: F3.preview, exact: true }).click();
  await expect(page.getByText("Inspection requires completion")).toBeVisible();
  await expect(page.getByRole("button", { name: F3.previewRefresh, exact: true })).toBeDisabled();
  expect(writes.filter((w) => w.path.endsWith("/settlement"))).toHaveLength(0);
});

test("A settlement conflict preserves the draft and requires a fresh preview", async ({ page }) => {
  const { detail } = await setup(page, "FACILITY_MANAGER");
  await page.route("**/settlement", (route) => {
    detail.request.version++;
    return route.fulfill({ status: 409, json: { success: false, message: "Stale version" } });
  });
  await openPage(page, `/facility-manager/returns/${requestId}`);
  const form = page
    .locator("form")
    .filter({ has: page.getByRole("button", { name: F3.preview, exact: true }) });
  await form.getByLabel(F3.reason, { exact: true }).fill("Keep this draft");
  await form.getByRole("button", { name: F3.preview, exact: true }).click();
  await page.getByRole("button", { name: F3.previewRefresh, exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: F3.finalConfirm, exact: true })
    .click();
  await expect(form.getByLabel(F3.reason, { exact: true })).toHaveValue("Keep this draft");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("button", { name: F3.previewRefresh, exact: true })).toHaveCount(0);
  await expect(form.getByRole("button", { name: F3.preview, exact: true })).toBeEnabled();
});

test("Successful refund with a failed refetch does not permit another write", async ({ page }) => {
  const { detail, writes } = await prepareRefund(page, "100000");
  let failRead = false;
  await page.route(`**/return-requests/${requestId}`, (route) =>
    failRead ? route.fulfill({ status: 503, json: { success: false } }) : route.fallback(),
  );
  await page.route("**/refunds/confirm", async (route) => {
    failRead = true;
    await route.fallback();
  });
  await openPage(page, `/facility-manager/returns/${requestId}`);
  await fillRefund(page, "200000", "50000");
  await page.getByRole("button", { name: F3.refund, exact: true }).click();
  await expect(page.getByText(F3.refreshFailed).first()).toBeVisible();
  await expect(page.getByRole("button", { name: F3.refund, exact: true })).toBeDisabled();
  expect(detail.refunds).toHaveLength(1);
  expect(writes.filter((w) => w.path.endsWith("/refunds/confirm"))).toHaveLength(1);
  failRead = false;
  await page.getByRole("button", { name: F3.refresh, exact: true }).click();
  await expect(page.getByText("MANUAL-TEST-001", { exact: false })).toBeVisible();
  await expect(page.getByText(F3.refreshFailed)).toHaveCount(0);
});

test("FM confirms a completed mixed transfer using server source balances", async ({ page }) => {
  const { writes } = await prepareRefund(page, "100000");
  await openPage(page, `/facility-manager/returns/${requestId}`);
  await fillRefund(page, "500000", "100000");
  await page.getByRole("button", { name: F3.refund, exact: true }).click();
  await expect(page.getByText("MANUAL-TEST-001", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: F3.refund, exact: true })).toHaveCount(0);
  const writesToRefund = writes.filter((w) => w.path.endsWith("/refunds/confirm"));
  expect(writesToRefund).toHaveLength(1);
  expect(writesToRefund[0]?.body).toMatchObject({
    amount: "600000",
    depositRefundAmount: "500000",
    rentRefundAmount: "100000",
    expectedVersion: 3,
  });
  expect(writesToRefund[0]?.body.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
  await inspect(page, "refund");
});

test("Legacy unknown allocation remains read only", async ({ page }) => {
  const { detail } = await prepareRefund(page, "100000");
  detail.refundSummary = {
    ...summaryFixture("100000"),
    allocationKnown: false,
    remainingDepositRefund: null,
    remainingRentRefund: null,
    confirmedDepositRefund: null,
    confirmedRentRefund: null,
  };
  await openPage(page, `/facility-manager/returns/${requestId}`);
  await expect(page.getByText(F3.allocationUnknown)).toBeVisible();
  await expect(page.getByRole("button", { name: F3.refund, exact: true })).toHaveCount(0);
});

test("Late preview cannot authorize an edited form", async ({ page }) => {
  await setup(page, "FACILITY_MANAGER");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/settlement/preview", async (route) => {
    await gate;
    await route.fallback();
  });
  await openPage(page, `/facility-manager/returns/${requestId}`);
  const form = page
    .locator("form")
    .filter({ has: page.getByRole("button", { name: F3.preview, exact: true }) });
  await form.getByLabel(F3.reason, { exact: true }).fill("Inspection checked");
  await form.getByRole("button", { name: F3.preview, exact: true }).click();
  await form.getByLabel(`${F3.damage} (VND)`, { exact: true }).fill("1000");
  release();
  await expect(page.getByRole("button", { name: F3.previewRefresh, exact: true })).toHaveCount(0);
});

test("Uncertain transfer preserves its idempotency key after reload", async ({ page }) => {
  const { writes } = await prepareRefund(page, "100000");
  let failed = false;
  let first: Record<string, unknown> | undefined;
  await page.route("**/refunds/confirm", async (route) => {
    if (!failed) {
      failed = true;
      first = route.request().postDataJSON();
      await route.abort("failed");
    } else await route.fallback();
  });
  await openPage(page, `/facility-manager/returns/${requestId}`);
  await fillRefund(page, "200000", "50000");
  await page.getByRole("button", { name: F3.refund, exact: true }).click();
  await expect(page.getByText(F3.unknownOutcome)).toBeVisible();
  await openPage(page, page.url());
  await expect(page.getByLabel(F3.depositTransfer, { exact: true })).toHaveValue("200000");
  await page.getByLabel(F3.confirmTransfer, { exact: true }).check();
  await page.getByRole("button", { name: F3.refund, exact: true }).click();
  await expect(page.getByText("MANUAL-TEST-001", { exact: false })).toBeVisible();
  expect(writes.find((w) => w.path.endsWith("/refunds/confirm"))?.body.idempotencyKey).toBe(
    first?.idempotencyKey,
  );
});
