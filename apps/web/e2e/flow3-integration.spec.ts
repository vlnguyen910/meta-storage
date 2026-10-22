import AxeBuilder from "@axe-core/playwright";
import type { ReturnRefundDto, ReturnSettlementDto } from "@metastorage/contracts";
import { expect, type Page, test } from "@playwright/test";

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
              id: `86000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
            }))
          : [];
    } else if (path === `/return-requests/${requestId}`) data = detail;
    else if (path.endsWith("/evidence") && method === "POST") {
      detail.request.version++;
      data = { ...detail.evidence[0], purpose: req.postDataJSON().purpose };
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
    } else if (path.endsWith("/refunds/confirm")) {
      const input = req.postDataJSON();
      detail.request.version++;
      detail.refunds.push({
        id: timeId,
        amount: input.amount,
        depositRefundAmount: input.amount,
        rentRefundAmount: "0",
        reference: input.reference,
        confirmedBy: actorId,
        confirmedAt: now,
        settlementId: actorId,
      });
      if (detail.settlements[0]) detail.settlements[0].remainingRefund = "0";
      data = { id: timeId, amount: input.amount, confirmedAt: now };
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

test("FM queue loads another page and keeps financial approval safely blocked", async ({
  page,
}) => {
  await setup(page, "FACILITY_MANAGER");
  await openPage(page, "/facility-manager/returns");
  await page.getByRole("button", { name: "Tải thêm", exact: true }).click();
  await expect(page.getByRole("button", { name: "Tải thêm", exact: true })).toHaveCount(0);
  await openPage(page, `/facility-manager/returns/${requestId}`);
  await expect(page.getByRole("button", { name: "Duyệt quyết toán", exact: true })).toBeDisabled();
  await expect(page.getByText(/backend chưa có bản xem trước/)).toBeVisible();
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

test("FM confirms an already completed deposit transfer with proof and no automatic payment", async ({
  page,
}) => {
  const { detail, writes } = await setup(page, "FACILITY_MANAGER");
  detail.settlements.push({
    id: actorId,
    requestId,
    revision: 1,
    depositSnapshot: "500000.00",
    rateSnapshot: 25,
    overdueFeeAmount: "0.00",
    damageAmount: "0.00",
    unusedRentRefundAmount: "0.00",
    refundEntitlement: "500000",
    remainingRefund: "500000",
    debtAmount: "0",
    actualReturnAt: now,
    refundDueDate: "2026-10-25",
    approvedBy: actorId,
    approvedAt: now,
  });
  await openPage(page, `/facility-manager/returns/${requestId}`);
  const submit = page.getByRole("button", {
    name: "Xác nhận chuyển khoản đã hoàn tất",
    exact: true,
  });
  await expect(submit).toBeDisabled();
  await page.getByLabel("Số tiền đã chuyển (VND)", { exact: true }).fill("500000");
  await page.getByLabel("Mã tham chiếu chuyển khoản", { exact: true }).fill("MANUAL-TEST-001");
  await page
    .locator('form input[type="file"]')
    .setInputFiles({ name: "proof.png", mimeType: "image/png", buffer: image });
  await page.getByLabel("Tôi xác nhận chuyển khoản này đã hoàn tất", { exact: true }).check();
  await submit.click();
  await expect(page.getByText("MANUAL-TEST-001", { exact: false })).toBeVisible();
  await expect(submit).toHaveCount(0);
  const confirmations = writes.filter((write) => write.path.endsWith("/refunds/confirm"));
  expect(confirmations).toHaveLength(1);
  expect(confirmations[0]?.body).toMatchObject({
    amount: "500000",
    reference: "MANUAL-TEST-001",
    evidencePhotoIds: [photoId],
    expectedVersion: 3,
  });
  expect(confirmations[0]?.body.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
  expect(writes.every((write) => !write.path.includes("/payments/"))).toBe(true);
  await inspect(page, "refund");
});

test("Mixed rent/deposit refund stays blocked until backend exposes source balances", async ({
  page,
}) => {
  const { detail } = await setup(page, "FACILITY_MANAGER");
  detail.settlements.push({
    id: actorId,
    requestId,
    revision: 1,
    depositSnapshot: "500000",
    rateSnapshot: 25,
    overdueFeeAmount: "0",
    damageAmount: "0",
    unusedRentRefundAmount: "100000",
    refundEntitlement: "600000",
    remainingRefund: "600000",
    debtAmount: "0",
    actualReturnAt: now,
    refundDueDate: "2026-10-25",
    approvedBy: actorId,
    approvedAt: now,
  });
  await openPage(page, `/facility-manager/returns/${requestId}`);
  await expect(page.getByText(/Chưa đủ số dư cọc\/tiền thuê/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Xác nhận chuyển khoản đã hoàn tất" })).toHaveCount(
    0,
  );
});
