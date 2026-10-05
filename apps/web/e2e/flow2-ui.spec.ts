import type { BookingListItem, CheckInLookupResult, Inspection } from "@metastorage/contracts";
import { PaymentStatus, UserRole } from "@metastorage/contracts";
import { expect, type Page, test } from "@playwright/test";

const id = "b0000000-0000-0000-0000-000000000001";
const now = new Date().toISOString();
const photoData =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
async function fixture(
  page: Page,
  { unassigned = false, failHistory = false, role = "FACILITY_STAFF", cloudPhotos = false } = {},
) {
  const assignment = {
    id: "a0000000-0000-0000-0000-000000000001",
    bookingId: id,
    physicalUnitId: "c0000000-0000-0000-0000-000000000001",
    physicalUnitCode: "HCM-01-002",
    assignedBy: "d0000000-0000-0000-0000-000000000001",
    status: "ACTIVE" as const,
    assignedAt: now,
    endedAt: null,
  };
  const booking: BookingListItem = {
    id,
    bookingCode: "BK-2026-0001",
    facilityId: "f0000000-0000-0000-0000-000000000001",
    facilityName: "StoreX Sài Gòn Central",
    unitTypeId: "e0000000-0000-0000-0000-000000000001",
    unitTypeName: "Kho tiêu chuẩn (4 m²)",
    unitTypeSizeLabel: "4 m²",
    contactName: "Lê Thị Mai Linh",
    contactPhone: "0912345678",
    contactEmail: "linh@example.com",
    requestedMonths: 1,
    totalAmount: 3000000,
    status: "CONFIRMED",
    paidAt: now,
    checkInSlotStart: new Date(Date.now() - 3600000).toISOString(),
    checkInSlotEnd: new Date(Date.now() + 3600000).toISOString(),
    rentalEndAt: new Date(Date.now() + 30 * 86400000).toISOString(),
    createdAt: now,
    assignedUnit: unassigned ? null : assignment,
    assignedStaff: {
      id: assignment.assignedBy,
      name: "Staff được phân công",
      email: "staff@example.com",
      phone: null,
      role: UserRole.FACILITY_STAFF,
      isActive: true,
    },
  };
  const lookup: CheckInLookupResult = {
    booking: { ...booking, graceEndsAt: new Date(Date.now() + 3 * 3600000).toISOString() },
    assignedUnit: booking.assignedUnit ?? null,
    payment: {
      status: PaymentStatus.SUCCEEDED,
      paidAt: now,
      totalAmount: 3000000,
      rentalFeeAmount: 1500000,
      depositAmount: 1500000,
      currency: "VND",
    },
    eligibility: { canProceed: !unassigned, reasons: unassigned ? ["UNIT_NOT_ASSIGNED"] : [] },
    verification: null,
  };
  let inspection: Inspection | null = null;
  let versionConflict = false;
  await page.route("**/api/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace("/api", "");
    const method = req.method();
    const input = req.postDataJSON();
    const headers = {
      "Access-Control-Allow-Origin": "http://127.0.0.1:3100",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "content-type,authorization",
      "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    };
    if (method === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    let data: unknown = null;
    if (path === "/users/me")
      data = {
        id: assignment.assignedBy,
        name: "Lê Thu Hà",
        email: "manager@example.com",
        phone: null,
        role,
        assignedFacilityIds: [booking.facilityId],
      };
    else if (path === "/facilities/my-assignments")
      data = [
        { facilityId: booking.facilityId, facilityName: booking.facilityName, isActive: true },
      ];
    else if (path === `/facilities/${booking.facilityId}/bookings` || path === "/staff/tasks")
      data = [booking];
    else if (path === "/check-ins/lookup") data = lookup;
    else if (path === `/check-ins/${id}/confirm`) {
      lookup.verification = {
        id: "a1111111-1111-1111-1111-111111111111",
        bookingId: id,
        facilityId: booking.facilityId,
        staffId: assignment.assignedBy,
        unitAssignmentId: assignment.id,
        status: "VERIFIED",
        verifiedAt: now,
        consumedAt: null,
        invalidatedAt: null,
        invalidatedReason: null,
      };
      data = lookup;
    } else if (path === `/bookings/${id}/eligible-units`)
      data = [
        {
          id: assignment.physicalUnitId,
          facilityId: booking.facilityId,
          unitTypeId: booking.unitTypeId,
          code: assignment.physicalUnitCode,
          status: "AVAILABLE",
          floor: "Tầng 1",
          locationDescription: "Dãy A",
          isAvailableForPeriod: true,
        },
      ];
    else if (path === `/bookings/${id}/assign-unit`) {
      booking.assignedUnit = assignment;
      lookup.assignedUnit = assignment;
      lookup.eligibility = { canProceed: true, reasons: [] };
      data = assignment;
    } else if (path === `/bookings/${id}`) data = booking;
    else if (path === `/bookings/${id}/inspections`) {
      if (failHistory && method === "GET") {
        await route.fulfill({ status: 500, headers, json: { message: "Không thể tải hồ sơ" } });
        return;
      }
      if (method === "POST") {
        inspection = {
          id: "a2222222-2222-2222-2222-222222222222",
          bookingId: id,
          facilityId: booking.facilityId,
          physicalUnitId: assignment.physicalUnitId,
          unitCode: assignment.physicalUnitCode,
          unitAssignmentId: assignment.id,
          verificationId: lookup.verification?.id ?? "",
          policyVersion: "H6_V1",
          status: "DRAFT",
          version: 0,
          correctUnit: null,
          conditionNotes: "",
          createdBy: assignment.assignedBy,
          completedBy: null,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
          photos: [],
        };
        data = inspection;
      } else data = inspection ? [inspection] : [];
    } else if (inspection && path === `/inspections/${inspection.id}`) {
      if (input?.version !== inspection.version) {
        versionConflict = true;
        await route.fulfill({ status: 409, headers, json: { message: "Phiên bản không khớp" } });
        return;
      }
      inspection = { ...inspection, ...input, version: inspection.version + 1 };
      data = inspection;
    } else if (inspection && path === `/inspections/${inspection.id}/photos`) {
      if (input?.version !== inspection.version) versionConflict = true;
      inspection = {
        ...inspection,
        version: inspection.version + 1,
        photos: [
          {
            id: "a3333333-3333-3333-3333-333333333333",
            filename: input.filename,
            mimeType: input.mimeType,
            byteSize: 68,
            createdAt: now,
          },
        ],
      };
      data = inspection;
    } else if (inspection && path.includes("/photos/"))
      data = {
        ...inspection.photos[0],
        ...(cloudPhotos
          ? { url: "https://api.cloudinary.com/v1_1/test/image/download?signature=test" }
          : { dataBase64: photoData }),
      };
    else if (inspection && path === `/inspections/${inspection.id}/complete`) {
      if (
        !inspection.correctUnit ||
        !inspection.conditionNotes.trim() ||
        !inspection.photos.length ||
        input.version !== inspection.version
      )
        throw new Error("Invalid inspection completion");
      inspection = {
        ...inspection,
        status: "COMPLETED",
        version: inspection.version + 1,
        completedAt: now,
        completedBy: assignment.assignedBy,
      };
      data = inspection;
    } else if (path.endsWith("/handover") && inspection) {
      inspection.handedOverAt = now;
      inspection.handedOverBy = assignment.assignedBy;
      inspection.handedOverByName = "Staff được phân công";
      inspection.version++;
      booking.status = "CHECKED_IN";
      lookup.booking.status = "CHECKED_IN";
      if (lookup.verification) lookup.verification.status = "CONSUMED";
      data = inspection;
    } else if (path.startsWith("/dashboards/"))
      data = {
        title: "Tổng quan vận hành",
        subtitle: booking.facilityName,
        kpis: [],
        activities: [],
      };
    else if (path === "/auth/sign-out") data = null;
    else {
      await route.fulfill({
        status: 404,
        headers,
        json: { message: `Unknown test route ${method} ${path}` },
      });
      return;
    }
    await route.fulfill({
      status: 200,
      headers,
      json: { success: true, data, message: "OK", timestamp: now },
    });
  });
  return {
    booking,
    lookup,
    getInspection: () => inspection,
    hasVersionConflict: () => versionConflict,
  };
}
test("manager navigation and assignment return to the new shell", async ({ page }) => {
  await fixture(page, { unassigned: true, role: "FACILITY_MANAGER" });
  await page.goto("/facility-manager/dashboard");
  await expect(page.getByRole("heading", { name: "Chuẩn bị kho & Phân công Staff" })).toBeVisible();
  await page.getByRole("link", { name: "Gán ô kho ngay" }).click();
  await expect(page.getByRole("heading", { name: "Gán & Đổi ô kho" })).toBeVisible();
  await page.getByRole("radio", { name: "HCM-01-002" }).check();
  await expect
    .poll(() =>
      page
        .getByAltText("Ảnh minh họa buồng kho")
        .evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.screenshot({ path: "/tmp/storex-flow2-assign.png", fullPage: true });
  await page.getByRole("button", { name: "Xác nhận gán ô kho" }).click();
  await expect(page.getByText("BK-2026-0001 · HCM-01-002")).toBeVisible();
  await page.getByRole("button", { name: "Quay lại danh sách" }).click();
  await page.getByRole("link", { name: "Tổng quan cơ sở", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tổng quan cơ sở", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Chuẩn bị & Phân công", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Chuẩn bị kho & Phân công Staff" })).toBeVisible();
  await page.screenshot({ path: "/tmp/storex-flow2-dispatch.png", fullPage: true });
});
test("draft, real photo, review, immutable completion and reload", async ({ page }) => {
  const f = await fixture(page);
  await page.goto("/staff/check-in?bookingCode=BK-2026-0001");
  await expect(page.getByRole("heading", { name: "Lê Thị Mai Linh" })).toBeVisible();
  await expect
    .poll(() =>
      page
        .getByAltText("Ảnh minh họa không gian kho", { exact: true })
        .evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.screenshot({ path: "/tmp/storex-flow2-verify.png", fullPage: true });
  await page.getByRole("button", { name: "Xác minh booking & Chuyển sang kiểm tra kho" }).click();
  await expect(page.getByRole("button", { name: "Lưu và xem lại trước khi khóa" })).toBeDisabled();
  await page.getByRole("radio", { name: /Đúng ô kho vật lý/ }).check();
  await page
    .getByRole("textbox", { name: "Biên bản ghi nhận hiện trường" })
    .fill("Sàn khô ráo; vách tôn có vết xước nhỏ được ghi nhận baseline.");
  await page.locator("input[type=file]").setInputFiles({
    name: "baseline.png",
    mimeType: "image/png",
    buffer: Buffer.from(photoData, "base64"),
  });
  await expect(page.getByAltText("baseline.png")).toBeVisible();
  await expect(
    page
      .getByRole("heading", { name: "Quy chuẩn bàn giao thô" })
      .locator("xpath=ancestor::section"),
  ).toHaveCSS("background-color", "rgb(0, 59, 47)");
  await page.screenshot({ path: "/tmp/storex-flow2-inspect.png", fullPage: true });
  await page.getByRole("button", { name: "Lưu và xem lại trước khi khóa" }).click();
  await expect(page.getByRole("heading", { name: "Xem lại & Hoàn tất kiểm tra" })).toBeVisible();
  await page.getByRole("button", { name: "Quay lại chỉnh sửa" }).click();
  await expect(page.getByRole("textbox", { name: "Biên bản ghi nhận hiện trường" })).toHaveValue(
    /Sàn khô ráo/,
  );
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Biên bản ghi nhận hiện trường" })).toHaveValue(
    /Sàn khô ráo/,
  );
  await page.getByRole("button", { name: "Lưu và xem lại trước khi khóa" }).click();
  await page.getByRole("checkbox").check();
  await page.screenshot({ path: "/tmp/storex-flow2-review.png", fullPage: true });
  await page.getByRole("button", { name: "Hoàn tất kiểm tra ô kho (Khóa biên bản)" }).click();
  await expect(
    page.getByRole("heading", { name: "Bàn giao kho & Kích hoạt thuê kho" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Xác nhận bàn giao & Kích hoạt hợp đồng thuê kho" }),
  ).toBeDisabled();
  expect(f.getInspection()?.status).toBe("COMPLETED");
  expect(f.lookup.booking.status).toBe("CONFIRMED");
  expect(f.hasVersionConflict()).toBe(false);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Bàn giao kho & Kích hoạt thuê kho" }),
  ).toBeVisible();
  await expect(page.getByText("Mã Smart PIN khởi tạo")).toHaveCount(0);
  await expect(page.getByText("Thẻ từ vật lý (NFC Card)")).toHaveCount(0);
  await page
    .getByRole("checkbox", {
      name: "Đã đối chiếu với khách hàng và xác nhận khách đã nhận bàn giao ô kho.",
    })
    .check();
  await page
    .getByRole("button", { name: "Xác nhận bàn giao & Kích hoạt hợp đồng thuê kho" })
    .click();
  await expect(page.getByRole("heading", { name: "Thuê kho đang hoạt động" })).toBeVisible();
  expect(f.lookup.booking.status).toBe("CHECKED_IN");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Thuê kho đang hoạt động" })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "/tmp/storex-flow2-handover.png", fullPage: true });
});
test("API error does not leave verification stuck", async ({ page }) => {
  await fixture(page, { failHistory: true });
  await page.goto("/staff/check-in?bookingCode=BK-2026-0001");
  await page.getByRole("button", { name: "Xác minh booking & Chuyển sang kiểm tra kho" }).click();
  await expect(
    page.getByText("Không thể tải hồ sơ kiểm tra. Thử lại trước khi tiếp tục."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Thử lại" })).toBeVisible();
});
test("mobile sidebar and dispatch do not overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page, { role: "FACILITY_MANAGER" });
  await page.goto("/facility-manager/dashboard");
  await expect(page.getByRole("heading", { name: "Chuẩn bị kho & Phân công Staff" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Mở menu" }).click();
  await expect(page.getByRole("link", { name: "Kiểm tra kho", exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Tổng quan cơ sở", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tổng quan cơ sở", exact: true })).toBeVisible();
  await page.screenshot({ path: "/tmp/storex-flow2-mobile.png", fullPage: true });
});

test("unsaved navigation is guarded and wrong unit blocks review", async ({ page }) => {
  await fixture(page);
  await page.goto("/staff/check-in?bookingCode=BK-2026-0001");
  await page.getByRole("button", { name: "Xác minh booking & Chuyển sang kiểm tra kho" }).click();
  await page.getByRole("radio", { name: /Sai ô kho thực tế/ }).check();
  await expect(page.getByRole("button", { name: "Lưu và xem lại trước khi khóa" })).toBeDisabled();
  await page
    .getByRole("textbox", { name: "Biên bản ghi nhận hiện trường" })
    .fill("Ghi nhận ô kho không khớp.");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("link", { name: "Công việc được giao", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Biên bản ghi nhận hiện trường" })).toHaveValue(
    "Ghi nhận ô kho không khớp.",
  );
  await page
    .locator("input[type=file]")
    .setInputFiles({ name: "invalid.txt", mimeType: "text/plain", buffer: Buffer.from("invalid") });
  await expect(
    page.getByRole("alert").filter({ hasText: "Ảnh phải là JPEG, PNG hoặc WebP" }),
  ).toBeVisible();
});
test("staff dashboard uses the same flow shell and limits assignment actions", async ({ page }) => {
  await fixture(page, { role: "FACILITY_STAFF" });
  await page.goto("/staff/dashboard");
  await expect(page.getByRole("heading", { name: "Công việc được giao" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Chỉ định / Đổi nhân viên" })).toHaveCount(0);
  await page.getByRole("link", { name: /Tiếp đón & Xác minh booking/ }).click();
  await expect(page).toHaveURL(/staff\/check-in/);
});

test("truthful progress, contextual help and keyboard lookup", async ({ page }) => {
  await fixture(page, { unassigned: true });
  await page.goto("/staff/check-in");
  const steps = page.locator("ol").first();
  await expect(steps.getByText("Hoàn tất", { exact: true })).toHaveCount(0);
  await expect(steps.locator('[aria-current="step"]')).toContainText("Xác minh booking");
  await page.getByText("Hướng dẫn thao tác", { exact: true }).click();
  await expect(
    page.getByText(
      "FM gán ô kho phù hợp và phân công Staff. Staff chỉ thực hiện booking được giao.",
    ),
  ).toBeVisible();
  const input = page.getByRole("textbox", { name: "Mã booking" });
  await input.fill("BK-2026-0001");
  await input.press("Enter");
  await expect(page.getByRole("heading", { name: "Lê Thị Mai Linh" })).toBeVisible();
  await expect(steps.getByText("Hoàn tất", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Đã xác nhận", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Xác minh booking & Chuyển sang kiểm tra kho" }),
  ).toBeDisabled();
  await page.screenshot({ path: "/tmp/storex-nielsen-help.png", fullPage: true });
});

test("cancelling a reassignment preserves the original unit", async ({ page }) => {
  const f = await fixture(page, { role: "FACILITY_MANAGER" });
  await page.route(`**/api/bookings/${id}/eligible-units`, async (route) =>
    route.fulfill({
      headers: {
        "Access-Control-Allow-Origin": "http://127.0.0.1:3100",
        "Access-Control-Allow-Credentials": "true",
      },
      json: {
        success: true,
        data: [
          {
            id: "c0000000-0000-0000-0000-000000000003",
            code: "HCM-01-003",
            status: "AVAILABLE",
            isAvailableForPeriod: true,
            floor: "Tầng 1",
            locationDescription: "Dãy B",
          },
        ],
      },
    }),
  );
  await page.goto(`/facility-manager/check-in?view=assign&bookingId=${id}`);
  await page.getByRole("radio", { name: "HCM-01-003" }).check();
  let dialogSeen = false;
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("Lê Thị Mai Linh từ HCM-01-002 sang HCM-01-003");
    dialogSeen = true;
    await dialog.dismiss();
  });
  await page.getByRole("button", { name: "Xác nhận gán ô kho" }).click();
  expect(dialogSeen).toBe(true);
  expect(f.booking.assignedUnit?.physicalUnitCode).toBe("HCM-01-002");
  await expect(page.getByRole("heading", { name: "Gán & Đổi ô kho" })).toBeVisible();
});

test("cancelling evidence deletion keeps the photo in the record", async ({ page }) => {
  const f = await fixture(page);
  await page.goto("/staff/check-in?bookingCode=BK-2026-0001");
  await page.getByRole("button", { name: "Xác minh booking & Chuyển sang kiểm tra kho" }).click();
  await page.locator("input[type=file]").setInputFiles({
    name: "evidence.png",
    mimeType: "image/png",
    buffer: Buffer.from(photoData, "base64"),
  });
  await expect(page.getByAltText("evidence.png")).toBeVisible();
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("evidence.png");
    await dialog.dismiss();
  });
  await page.getByRole("button", { name: "Xóa ảnh: evidence.png" }).click();
  await expect(page.getByAltText("evidence.png")).toBeVisible();
  expect(f.getInspection()?.photos).toHaveLength(1);
});

test("failed refresh preserves the list and offers recovery", async ({ page }) => {
  await fixture(page, { role: "FACILITY_MANAGER" });
  await page.goto("/facility-manager/dashboard");
  await expect(page.getByRole("heading", { name: "Lê Thị Mai Linh" })).toBeVisible();
  const pattern = "**/api/facilities/*/bookings";
  await page.route(pattern, async (route) =>
    route.fulfill({
      status: 503,
      headers: {
        "Access-Control-Allow-Origin": "http://127.0.0.1:3100",
        "Access-Control-Allow-Credentials": "true",
      },
      json: { message: "Service unavailable" },
    }),
  );
  await page.getByRole("button", { name: "Làm mới", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Danh sách dưới đây là dữ liệu đã tải trước đó" }),
  ).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("heading", { name: "Lê Thị Mai Linh" })).toBeVisible();
  await page.screenshot({ path: "/tmp/storex-nielsen-refresh-error.png", fullPage: true });
  await page.unroute(pattern);
  await page.getByRole("button", { name: "Làm mới", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Danh sách dưới đây là dữ liệu đã tải trước đó" }),
  ).toHaveCount(0);
});

test("Cloudinary evidence URL renders in inspection, review and handover", async ({ page }) => {
  await fixture(page, { cloudPhotos: true });
  await page.route("https://api.cloudinary.com/**", (route) =>
    route.fulfill({ contentType: "image/png", body: Buffer.from(photoData, "base64") }),
  );
  await page.goto("/staff/check-in?bookingCode=BK-2026-0001");
  await page.getByRole("button", { name: "Xác minh booking & Chuyển sang kiểm tra kho" }).click();
  await page.getByRole("radio", { name: /Đúng ô kho vật lý/ }).check();
  await page
    .getByRole("textbox", { name: "Biên bản ghi nhận hiện trường" })
    .fill("Kho sạch, cửa hoạt động bình thường.");
  await page.locator("input[type=file]").setInputFiles({
    name: "cloud.png",
    mimeType: "image/png",
    buffer: Buffer.from(photoData, "base64"),
  });
  const img = page.getByAltText("cloud.png");
  await expect(img).toHaveAttribute("src", /^https:\/\/api.cloudinary.com/);
  await expect
    .poll(() => img.evaluate((element: HTMLImageElement) => element.naturalWidth))
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Lưu và xem lại trước khi khóa" }).click();
  await expect(img).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Hoàn tất kiểm tra ô kho (Khóa biên bản)" }).click();
  await expect(
    page.getByRole("heading", { name: "Bàn giao kho & Kích hoạt thuê kho" }),
  ).toBeVisible();
  await page.reload();
  await expect(img).toBeVisible();
  await page.screenshot({ path: "/tmp/storex-cloudinary-ui.png", fullPage: true });
});

test("failed Cloudinary delivery can be retried", async ({ page }) => {
  await fixture(page, { cloudPhotos: true });
  let deliveryAvailable = false;
  await page.route("https://api.cloudinary.com/**", (route) => {
    return !deliveryAvailable
      ? route.abort()
      : route.fulfill({ contentType: "image/png", body: Buffer.from(photoData, "base64") });
  });
  await page.goto("/staff/check-in?bookingCode=BK-2026-0001");
  await page.getByRole("button", { name: "Xác minh booking & Chuyển sang kiểm tra kho" }).click();
  await page.locator("input[type=file]").setInputFiles({
    name: "retry.png",
    mimeType: "image/png",
    buffer: Buffer.from(photoData, "base64"),
  });
  await expect(
    page.getByRole("alert").filter({ hasText: "Không tải được ảnh bằng chứng" }),
  ).toBeVisible();
  deliveryAvailable = true;
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect
    .poll(() =>
      page.getByAltText("retry.png").evaluate((element: HTMLImageElement) => element.naturalWidth),
    )
    .toBeGreaterThan(0);
  await expect(
    page.getByRole("alert").filter({ hasText: "Không tải được ảnh bằng chứng" }),
  ).toHaveCount(0);
  await page.screenshot({ path: "/tmp/storex-cloudinary-retry.png", fullPage: true });
});

test("FM direct inspection URLs remain read only and contain no PIN or handover actions", async ({
  page,
}) => {
  await fixture(page, { role: "FACILITY_MANAGER" });
  await page.goto("/facility-manager/check-in?bookingCode=BK-2026-0001&view=inspect");
  await expect(page.getByRole("heading", { name: "Theo dõi hồ sơ" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Xác minh booking & Chuyển sang kiểm tra kho" }),
  ).toHaveCount(0);
  await expect(page.locator("input[type=file]")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Xác nhận bàn giao & Kích hoạt hợp đồng thuê kho" }),
  ).toHaveCount(0);
  await expect(page.getByText("Bàn giao chìa & PIN")).toHaveCount(0);
  await page.screenshot({ path: "/tmp/storex-fm-monitor.png", fullPage: true });
});

test("FM filters real handover progress and only opens monitoring", async ({ page }) => {
  const f = await fixture(page, { role: "FACILITY_MANAGER" });
  f.booking.handoverStage = "READY_HANDOVER";
  await page.goto("/facility-manager/dashboard");
  await page.getByRole("button", { name: /^Chờ bàn giao/ }).click();
  await expect(page.getByRole("heading", { name: "Lê Thị Mai Linh" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Tiếp đón & Xác minh booking/ })).toHaveCount(0);
  await expect(page.getByText("Staff được phân công", { exact: true })).toBeVisible();
  await page.screenshot({ path: "/tmp/storex-fm-preparation-final.png", fullPage: true });
});

test("Staff re-verifies a legacy FM verification before editing", async ({ page }) => {
  const f = await fixture(page);
  f.lookup.verification = {
    id: "a1111111-1111-1111-1111-111111111111",
    bookingId: id,
    facilityId: f.booking.facilityId,
    staffId: "d0000000-0000-0000-0000-000000000099",
    unitAssignmentId: f.booking.assignedUnit?.id ?? "",
    status: "VERIFIED",
    verifiedAt: now,
    consumedAt: null,
    invalidatedAt: null,
    invalidatedReason: null,
  };
  await page.goto("/staff/check-in?bookingCode=BK-2026-0001&view=inspect");
  await expect(
    page.getByRole("button", { name: "Xác minh booking & Chuyển sang kiểm tra kho" }),
  ).toBeVisible();
  await expect(page.locator("input[type=file]")).toHaveCount(0);
  await page.getByRole("button", { name: "Xác minh booking & Chuyển sang kiểm tra kho" }).click();
  await expect(page.getByRole("textbox", { name: "Biên bản ghi nhận hiện trường" })).toBeVisible();
});
