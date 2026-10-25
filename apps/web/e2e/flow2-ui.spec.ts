import AxeBuilder from "@axe-core/playwright";
import type { BookingListItem, CheckInLookupResult, Inspection } from "@metastorage/contracts";
import {
  HANDOVER_CHECKLIST_ITEMS,
  HandoverChecklistCompletionSchema,
  INSPECTION_CHECKLIST_VERSION,
  PaymentStatus,
  UserRole,
} from "@metastorage/contracts";
import { expect, type Page, test } from "@playwright/test";
import { FLOW } from "../src/features/facility-flow/flow.messages";
import { CONTRACT_UI as C } from "../src/features/rentals/contract.messages";
import { F3 } from "../src/features/returns/integration.messages";

const id = "b0000000-0000-4000-8000-000000000001";
const now = new Date().toISOString();
const photoData =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const contractPdf = Buffer.from(
  "JVBERi0xLjcKJYGBgYEKCjYgMCBvYmoKPDwKL0ZpbHRlciAvRmxhdGVEZWNvZGUKL0xlbmd0aCAxMjEKPj4Kc3RyZWFtCnicHYrBCsJADETv8xU5C2I23U12QTwILR68CPkBkSpKe1DE728qAzM83rxxdDCt+TywO43Tb/w+b9etcau5stVGScjvkEx+RvpfE0kUM/mMfeks62CipVRh7XTQ3nJw0jDCxqsz1RZtwTk2zIH8Bd+gd1ywAC69HXsKZW5kc3RyZWFtCmVuZG9iagoKNyAwIG9iago8PAovRmlsdGVyIC9GbGF0ZURlY29kZQovVHlwZSAvT2JqU3RtCi9OIDUKL0ZpcnN0IDI2Ci9MZW5ndGggMzYxCj4+CnN0cmVhbQp4nNVSTUvDQBC976+Yox5kP5LmQ0qhbRIFKUorKIqHbbKUSNmVZCP13zuTpJYexLOEx+7MvNl9m3kSBCgIQwggTiCESaBgArGUMJ0y/vj1YYA/6J1pGb+rqxZekSNgDW+ML11nPUg2m7ETd6m93rsdG5pAEvnIeGhc1ZWmgWmRF4UQsRAiChGRECrDdYlIEQpjrKkE94g4HIG5OBAimGOtGBDFQw/Ve+5k7M9xRW5EnGzghskQ/9xLd+XDGeovPemM8ZWrMu0NXGTXSqhIChWINEhl8nKJv6Mx2rv/+7hef+3sry88mzONl4bcGPJAP2W+Nq3rmhLHTrzCYYU2t2b/aXxd6qtYpAnqjJMUPTYagz/fb99N2VMpzA/+ZuNJw5Cg3MpUtV64A7pP4IcvB1RNHpxb6zy5svej9aiGomj06JlkEsT4ptv6PqSkZHyhW9NLPelEEbZ0VW13wJ9qO7dtfUzQid8tGsXmCmVuZHN0cmVhbQplbmRvYmoKCjggMCBvYmoKPDwKL1NpemUgOQovUm9vdCAyIDAgUgovSW5mbyAzIDAgUgovRmlsdGVyIC9GbGF0ZURlY29kZQovVHlwZSAvWFJlZgovTGVuZ3RoIDQxCi9XIFsgMSAyIDIgXQovSW5kZXggWyAwIDkgXQo+PgpzdHJlYW0KeJwVxLERACAMA7G3wx0t+3esxEIJViGg22xISk6Vljgg3s8XBmIVA74KZW5kc3RyZWFtCmVuZG9iagoKc3RhcnR4cmVmCjY3MwolJUVPRg==",
  "base64",
);

for (const width of [1440, 375, 390, 430]) {
  test(`contract manager uploads with local preview and recovers storage error at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await fixture(page, { role: "FACILITY_MANAGER" });
    let document: Record<string, unknown> | null = null;
    let uploads = 0;
    await page.route(`**/api/bookings/${id}/contracts`, async (route) => {
      if (route.request().method() === "POST") {
        uploads++;
        if (uploads === 1)
          return route.fulfill({
            status: 503,
            json: {
              success: false,
              error: { code: "CONTRACT_STORAGE_UNAVAILABLE", message: "Storage unavailable" },
            },
          });
        document = {
          id,
          bookingId: id,
          filename: "contract-demo.pdf",
          status: "UPLOADED",
          currentIssued: false,
          usedForHandover: false,
          version: 1,
          byteSize: contractPdf.length,
          pageCount: 1,
          uploadedAt: now,
          issuedAt: null,
        };
        return route.fulfill({ json: { success: true, data: document } });
      }
      return route.fulfill({ json: { success: true, data: document ? [document] : [] } });
    });
    await page.route(`**/api/bookings/${id}/contracts/${id}/issue`, async (route) => {
      document = { ...document, status: "ISSUED", currentIssued: true, issuedAt: now };
      return route.fulfill({ json: { success: true, data: document } });
    });
    await page.goto("/facility-manager/check-in?bookingCode=BK-2026-0001");
    await expect(page.getByText(C.missing, { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: C.manage })).toBeVisible();
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: C.select, exact: false }).click();
    await (await chooser).setFiles({
      name: "contract-demo.pdf",
      mimeType: "application/pdf",
      buffer: contractPdf,
    });
    await expect(page.getByRole("heading", { name: C.localPreview, exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: C.openLocal, exact: true })).toHaveAttribute(
      "href",
      /^blob:/,
    );
    expect(uploads).toBe(0);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await page.screenshot({ path: `test-results/contract-preview-${width}.png`, fullPage: true });
    await page.getByRole("button", { name: F3.upload, exact: true }).click();
    await expect(page.getByText(C.storageFailure)).toBeVisible();
    await expect(page.getByRole("heading", { name: C.localPreview, exact: true })).toBeVisible();
    await page.getByRole("button", { name: F3.upload, exact: true }).click();
    await expect(page.getByText(C.pendingIssue)).toBeVisible();
    await expect(page.getByRole("heading", { name: C.localPreview, exact: true })).toHaveCount(0);
    await expect(page.getByText(C.ready, { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: F3.issue, exact: true }).click();
    await page.getByRole("button", { name: F3.issue, exact: true }).last().click();
    await expect(page.getByText(C.ready, { exact: true })).toBeVisible();
    expect(uploads).toBe(2);
  });
}

test("contract missing blocks Staff handover early and refresh recovers after FM issues", async ({
  page,
}) => {
  await fixture(page);
  let issued = false;
  await page.route(`**/api/bookings/${id}/contracts`, (route) =>
    route.fulfill({
      json: {
        success: true,
        data: issued
          ? [
              {
                id,
                bookingId: id,
                filename: "issued.pdf",
                status: "ISSUED",
                currentIssued: true,
                version: 1,
              },
            ]
          : [],
      },
    }),
  );
  await page.goto("/staff/check-in?bookingCode=BK-2026-0001");
  await page.getByRole("button", { name: FLOW.verifyProceed }).click();
  await expect(page.getByText(C.missing, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: C.select, exact: false })).toHaveCount(0);
  await passChecklist(page);
  await page.getByRole("button", { name: FLOW.review, exact: true }).click();
  await page.getByRole("checkbox", { name: FLOW.confirmLock }).check();
  await page.getByRole("button", { name: FLOW.complete, exact: true }).click();
  await expect(page.getByText(C.handoverMissing)).toBeVisible();
  await page.getByRole("checkbox", { name: FLOW.customerReceived }).check();
  await expect(page.getByRole("button", { name: FLOW.handover, exact: true })).toBeDisabled();
  issued = true;
  await page.getByRole("button", { name: C.refresh, exact: true }).click();
  await expect(page.getByRole("button", { name: FLOW.handover, exact: true })).toBeEnabled();
});

async function fixture(
  page: Page,
  {
    unassigned = false,
    failHistory = false,
    role = "FACILITY_STAFF",
    cloudPhotos = false,
    elapsedSlot = false,
  } = {},
) {
  const assignment = {
    id: "a0000000-0000-4000-8000-000000000001",
    bookingId: id,
    physicalUnitId: "c0000000-0000-4000-8000-000000000001",
    physicalUnitCode: "HCM-01-002",
    assignedBy: "d0000000-0000-4000-8000-000000000001",
    status: "ACTIVE" as const,
    assignedAt: now,
    endedAt: null,
  };
  const booking: BookingListItem = {
    id,
    bookingCode: "BK-2026-0001",
    facilityId: "f0000000-0000-4000-8000-000000000001",
    facilityName: "metastorage Sài Gòn Central",
    unitTypeId: "e0000000-0000-4000-8000-000000000001",
    unitTypeName: "Kho tiêu chuẩn (4 m²)",
    unitTypeSizeLabel: "4 m²",
    contactName: "Lê Thị Mai Linh",
    contactPhone: "0912345678",
    contactEmail: "linh@example.com",
    requestedMonths: 1,
    totalAmount: 3000000,
    status: "CONFIRMED",
    paidAt: now,
    checkInSlotStart: new Date(Date.now() - 4 * 3600000).toISOString(),
    checkInSlotEnd: new Date(Date.now() + (elapsedSlot ? -3 : 1) * 3600000).toISOString(),
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
    if (path === `/bookings/${id}/contracts`)
      data = [
        {
          id,
          bookingId: id,
          filename: "issued.pdf",
          status: "ISSUED",
          currentIssued: true,
          usedForHandover: false,
          version: 1,
          byteSize: 500,
          pageCount: 1,
          uploadedAt: now,
          issuedAt: now,
        },
      ];
    else if (path === "/auth/me")
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
    else if (
      path === `/facilities/${booking.facilityId}/bookings` ||
      path === "/bookings/assigned-to-me"
    )
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
    } else if (path === `/facilities/${booking.facilityId}/staff`) data = [booking.assignedStaff];
    else if (path === `/bookings/${id}/assign-staff`) {
      if (!booking.assignedStaff) throw new Error("Expected assigned staff");
      booking.assignedStaff = { ...booking.assignedStaff, id: input.staffId };
      data = booking;
    } else if (path === `/bookings/${id}`) data = booking;
    else if (path === `/bookings/${id}/inspections`) {
      if (failHistory && method === "GET") {
        await route.fulfill({
          status: 500,
          headers,
          json: { success: false, error: { code: 500, message: "Không thể tải hồ sơ" } },
        });
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
          results: [],
          checklistDefinition: [...HANDOVER_CHECKLIST_ITEMS],
          checklistVersion: INSPECTION_CHECKLIST_VERSION,
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
        await route.fulfill({
          status: 409,
          headers,
          json: { success: false, error: { code: 409, message: "Phiên bản không khớp" } },
        });
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
        !HandoverChecklistCompletionSchema.safeParse(inspection.results).success ||
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
  await page.goto("/facility-manager/dashboard?view=check-in");
  await expect(page.getByRole("heading", { name: "Chuẩn bị kho & Phân công Staff" })).toBeVisible();
  await page.getByRole("link", { name: "Gán ô kho ngay" }).click();
  await expect(page.getByRole("heading", { name: "Gán & Đổi ô kho" })).toBeVisible();
  await page.getByRole("radio", { name: "HCM-01-002" }).check();
  await expect(page.getByAltText(/Ảnh minh họa/)).toHaveCount(0);
  await page.screenshot({ path: "/tmp/metastorage-flow2-assign.png", fullPage: true });
  await page.getByRole("button", { name: "Xác nhận gán ô kho" }).click();
  await expect(page.getByText("BK-2026-0001 · HCM-01-002")).toBeVisible();
  await page.getByRole("button", { name: "Quay lại danh sách" }).click();
  await page.getByRole("link", { name: "Tổng quan cơ sở", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tổng quan cơ sở", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Chuẩn bị & Phân công", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Chuẩn bị kho & Phân công Staff" })).toBeVisible();
  await page.screenshot({ path: "/tmp/metastorage-flow2-dispatch.png", fullPage: true });
});
test("draft, real photo, review, immutable completion and reload", async ({ page }) => {
  const f = await fixture(page);
  await page.goto("/staff/check-in?bookingCode=BK-2026-0001");
  await expect(page.getByRole("heading", { name: "Lê Thị Mai Linh" })).toBeVisible();
  await expect(page.getByAltText(/Ảnh minh họa/)).toHaveCount(0);
  await page.screenshot({ path: "/tmp/metastorage-flow2-verify.png", fullPage: true });
  await page.getByRole("button", { name: "Xác minh booking & Chuyển sang kiểm tra kho" }).click();
  await expect(page.getByRole("button", { name: "Lưu và xem lại trước khi khóa" })).toBeDisabled();
  await passChecklist(page);
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
  await page.screenshot({ path: "/tmp/metastorage-flow2-inspect.png", fullPage: true });
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
  await page.screenshot({ path: "/tmp/metastorage-flow2-review.png", fullPage: true });
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
  await page.screenshot({ path: "/tmp/metastorage-flow2-handover.png", fullPage: true });
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
  await page.goto("/facility-manager/dashboard?view=check-in");
  await expect(page.getByRole("heading", { name: "Chuẩn bị kho & Phân công Staff" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Mở menu" }).click();
  await expect(page.getByRole("link", { name: "Kiểm tra kho", exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Tổng quan cơ sở", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tổng quan cơ sở", exact: true })).toBeVisible();
  await page.screenshot({ path: "/tmp/metastorage-flow2-mobile.png", fullPage: true });
});

test("unsaved navigation is guarded and wrong unit blocks review", async ({ page }) => {
  await fixture(page);
  await page.goto("/staff/check-in?bookingCode=BK-2026-0001");
  await page.getByRole("button", { name: "Xác minh booking & Chuyển sang kiểm tra kho" }).click();
  await page
    .getByRole("group", { name: "Đúng ô kho đã được gán cho booking", exact: true })
    .getByRole("radio", { name: "Không đạt", exact: true })
    .check();
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
  await page.goto("/staff/dashboard?view=tasks");
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
  await page.screenshot({ path: "/tmp/metastorage-nielsen-help.png", fullPage: true });
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
            id: "c0000000-0000-4000-8000-000000000003",
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
  let assignments = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/assign-unit")) assignments++;
  });
  await page.getByRole("button", { name: "Xác nhận gán ô kho" }).click();
  const dialog = page.getByRole("dialog", { name: "Xác nhận đổi ô kho", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("HCM-01-002", { exact: true })).toBeVisible();
  await expect(dialog.getByText("HCM-01-003", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Hủy", exact: true })).toBeFocused();
  await dialog.getByRole("button", { name: "Hủy", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(assignments).toBe(0);
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
  await page.goto("/facility-manager/dashboard?view=check-in");
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
  await page.screenshot({ path: "/tmp/metastorage-nielsen-refresh-error.png", fullPage: true });
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
  await passChecklist(page);
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
  await page.screenshot({ path: "/tmp/metastorage-cloudinary-ui.png", fullPage: true });
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
  await page.screenshot({ path: "/tmp/metastorage-cloudinary-retry.png", fullPage: true });
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
  await page.screenshot({ path: "/tmp/metastorage-fm-monitor.png", fullPage: true });
});

test("FM filters real handover progress and only opens monitoring", async ({ page }) => {
  const f = await fixture(page, { role: "FACILITY_MANAGER" });
  f.booking.handoverStage = "READY_HANDOVER";
  await page.goto("/facility-manager/dashboard?view=tasks");
  await page.getByRole("button", { name: /^Chờ bàn giao/ }).click();
  await expect(page.getByRole("heading", { name: "Lê Thị Mai Linh" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Tiếp đón & Xác minh booking/ })).toHaveCount(0);
  await expect(page.getByText("Staff được phân công", { exact: true })).toBeVisible();
  await page.screenshot({ path: "/tmp/metastorage-fm-preparation-final.png", fullPage: true });
});

test("Staff re-verifies a legacy FM verification before editing", async ({ page }) => {
  const f = await fixture(page);
  f.lookup.verification = {
    id: "a1111111-1111-1111-1111-111111111111",
    bookingId: id,
    facilityId: f.booking.facilityId,
    staffId: "d0000000-0000-4000-8000-000000000099",
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

test("staff assignment handles backend errors and retries with only persisted fields", async ({
  page,
}) => {
  await fixture(page, { role: "FACILITY_MANAGER" });
  let attempts = 0;
  await page.route(`**/api/bookings/${id}/assign-staff`, async (route) => {
    attempts++;
    expect(Object.keys(route.request().postDataJSON())).toEqual(["staffId"]);
    if (attempts === 1) {
      await route.fulfill({
        status: 409,
        json: {
          success: false,
          error: { code: 409, message: "Nhân viên không còn thuộc cơ sở này." },
        },
      });
    } else await route.fallback();
  });
  await page.goto("/facility-manager/dashboard?view=tasks");
  await page.getByRole("button", { name: "Chỉ định / Đổi nhân viên" }).click();
  const dialog = page.getByRole("dialog", { name: "Chỉ định nhân viên phụ trách" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("textbox")).toHaveCount(0);
  await dialog.getByRole("radio").check();
  await dialog.getByRole("button", { name: "Xác nhận chỉ định" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Nhân viên không còn thuộc cơ sở này.");
  await dialog.getByRole("button", { name: "Xác nhận chỉ định" }).click();
  await expect(dialog).toHaveCount(0);
  expect(attempts).toBe(2);
});

test("inspection version conflict shows backend reason and reloads the current version", async ({
  page,
}) => {
  const f = await fixture(page);
  await page.goto("/staff/check-in?bookingCode=BK-2026-0001");
  await page.getByRole("button", { name: "Xác minh booking & Chuyển sang kiểm tra kho" }).click();
  await passChecklist(page);
  await page
    .getByRole("textbox", { name: "Biên bản ghi nhận hiện trường" })
    .fill("Bản nháp trước xung đột");
  const record = f.getInspection();
  if (!record) throw new Error("Expected inspection");
  record.version++;
  record.conditionNotes = "Bản nháp mới nhất từ server";
  await page.getByRole("button", { name: "Lưu nháp", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Phiên bản không khớp" }).first(),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Biên bản ghi nhận hiện trường" })).toHaveValue(
    "Bản nháp mới nhất từ server",
  );
  await page
    .getByRole("textbox", { name: "Biên bản ghi nhận hiện trường" })
    .fill("Bản nháp sau khi tải lại");
  await page.getByRole("button", { name: "Lưu nháp", exact: true }).click();
  await expect(page.getByText("Đã lưu biên bản nháp.", { exact: true })).toBeVisible();
});

for (const width of [1440, 390]) {
  test(`assignment dialog accessibility and keyboard recovery at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await fixture(page, { role: "FACILITY_MANAGER" });
    await page.goto("/facility-manager/dashboard?view=tasks");
    await page.getByRole("button", { name: "Chỉ định / Đổi nhân viên" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    const audit = await new AxeBuilder({ page }).analyze();
    expect(audit.violations).toEqual([]);
    await page.screenshot({ path: `/tmp/flow2-staff-assignment-${width}.png`, fullPage: true });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Chỉ định / Đổi nhân viên" })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

for (const role of ["FACILITY_MANAGER", "FACILITY_STAFF"]) {
  test(`${role} overview uses scoped API bookings instead of sample dashboard data`, async ({
    page,
  }) => {
    const f = await fixture(page, { role });
    f.booking.contactName = "Khách lấy từ API cơ sở";
    f.booking.handoverStage = "READY_HANDOVER";
    const requests: string[] = [];
    page.on("request", (request) => requests.push(new URL(request.url()).pathname));
    const root = role === "FACILITY_MANAGER" ? "/facility-manager" : "/staff";
    await page.goto(`${root}/dashboard?view=overview`);
    await expect(page.getByRole("heading", { name: "Booking tạo gần đây" })).toBeVisible();
    await expect(page.getByText("Khách lấy từ API cơ sở", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "BK-2026-0001", exact: true })).toBeVisible();
    expect(requests.some((path) => path.startsWith("/api/dashboards/"))).toBe(false);
    expect(requests).toContain(
      role === "FACILITY_STAFF"
        ? "/api/bookings/assigned-to-me"
        : `/api/facilities/${f.booking.facilityId}/bookings`,
    );
    if (role === "FACILITY_STAFF")
      expect(requests).not.toContain(`/api/facilities/${f.booking.facilityId}/bookings`);
    await page.reload();
    await expect(page.getByText("Khách lấy từ API cơ sở", { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const audit = await new AxeBuilder({ page }).analyze();
    expect(audit.violations).toEqual([]);
    await page.screenshot({ path: `/tmp/flow2-overview-${role}.png`, fullPage: true });
  });
}

test("overview API failure shows retry without fabricated metrics", async ({ page }) => {
  const f = await fixture(page, { role: "FACILITY_MANAGER" });
  await page.route(`**/api/facilities/${f.booking.facilityId}/bookings`, (route) =>
    route.fulfill({
      status: 500,
      json: { success: false, error: { code: 500, message: "Database unavailable" } },
    }),
  );
  await page.goto("/facility-manager/dashboard?view=overview");
  await expect(
    page.getByRole("alert").filter({ hasText: "Không tải được danh sách booking" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Thử lại" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Booking tạo gần đây" })).toHaveCount(0);
});

for (const screen of [
  {
    role: "BUSINESS_OPERATION_MANAGER",
    path: "/operations/dashboard",
    title: "Chức năng vận hành chưa sẵn sàng",
  },
  {
    role: "SYSTEM_ADMIN",
    path: "/system-admin/dashboard",
    title: "Chức năng quản trị chưa sẵn sàng",
  },
]) {
  test(`${screen.role} cannot display prototype data in API mode`, async ({ page }) => {
    await fixture(page, { role: screen.role });
    await page.goto(screen.path);
    await expect(page.getByRole("heading", { name: screen.title, exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Lưu bản mẫu", exact: true })).toHaveCount(0);
    await expect(page.getByText("Dữ liệu minh họa", { exact: true })).toHaveCount(0);
  });
}

async function openReassignment(page: Page) {
  const f = await fixture(page, { role: "FACILITY_MANAGER" });
  const newUnit = {
    id: "c0000000-0000-4000-8000-000000000003",
    facilityId: f.booking.facilityId,
    unitTypeId: f.booking.unitTypeId,
    code: "HCM-01-003",
    status: "AVAILABLE",
    isAvailableForPeriod: true,
  };
  await page.route(`**/api/bookings/${id}/eligible-units`, (route) =>
    route.fulfill({ json: { success: true, data: [newUnit] } }),
  );
  await page.goto(`/facility-manager/check-in?view=assign&bookingId=${id}`);
  await page.getByRole("radio", { name: newUnit.code }).check();
  await page
    .getByRole("textbox", { name: "Ghi chú lý do gán / đổi kho" })
    .fill("Khách yêu cầu đổi vị trí kho.");
  await page.getByRole("button", { name: "Xác nhận gán ô kho" }).click();
  const dialog = page.getByRole("dialog", { name: "Xác nhận đổi ô kho", exact: true });
  await expect(dialog).toBeVisible();
  return { ...f, dialog, newUnit };
}

for (const width of [1440, 390]) {
  test(`reassignment confirmation is accessible and Escape preserves assignment at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const f = await openReassignment(page);
    await expect(
      f.dialog.getByText("Khách yêu cầu đổi vị trí kho.", { exact: true }),
    ).toBeVisible();
    await expect(f.dialog.getByText(/Nhân viên cần xác minh/)).toBeVisible();
    const audit = await new AxeBuilder({ page }).analyze();
    expect(audit.violations).toEqual([]);
    await page.screenshot({ path: `/tmp/storex-reassignment-dialog-${width}.png`, fullPage: true });
    await page.keyboard.press("Escape");
    await expect(f.dialog).toHaveCount(0);
    expect(f.booking.assignedUnit?.physicalUnitCode).toBe("HCM-01-002");
    await expect(page.getByRole("button", { name: "Xác nhận gán ô kho" })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test("reassignment confirmation blocks duplicates and allows retry after backend conflict", async ({
  page,
}) => {
  const f = await openReassignment(page);
  let attempts = 0;
  let release: () => void = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`**/api/bookings/${id}/assign-unit`, async (route) => {
    attempts++;
    expect(route.request().postDataJSON()).toEqual({
      physicalUnitId: f.newUnit.id,
      reason: "Khách yêu cầu đổi vị trí kho.",
    });
    if (attempts === 1) {
      await pending;
      await route.fulfill({
        status: 409,
        json: {
          success: false,
          error: { code: 409, message: "Ô kho vừa được booking khác giữ chỗ." },
        },
      });
      return;
    }
    if (!f.booking.assignedUnit) throw new Error("Expected original unit assignment");
    const assignment = {
      ...f.booking.assignedUnit,
      id: "a0000000-0000-4000-8000-000000000003",
      physicalUnitId: f.newUnit.id,
      physicalUnitCode: f.newUnit.code,
    };
    f.booking.assignedUnit = assignment;
    f.lookup.assignedUnit = assignment;
    await route.fulfill({ json: { success: true, data: assignment } });
  });
  const confirm = f.dialog.getByRole("button", { name: "Xác nhận đổi kho", exact: true });
  await confirm.click();
  await expect(confirm).toBeDisabled();
  await expect(f.dialog.getByRole("button", { name: "Hủy", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(f.dialog).toBeVisible();
  expect(attempts).toBe(1);
  release();
  await expect(f.dialog.getByRole("alert")).toHaveText("Ô kho vừa được booking khác giữ chỗ.");
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(f.dialog).toHaveCount(0);
  await expect(page.getByText("BK-2026-0001 · HCM-01-003", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Đã đổi ô kho từ HCM-01-002 sang HCM-01-003.", { exact: true }),
  ).toBeVisible();
  expect(attempts).toBe(2);
});

async function passChecklist(page: Page) {
  for (const item of HANDOVER_CHECKLIST_ITEMS) {
    await page
      .getByRole("group", { name: item.label, exact: true })
      .getByRole("radio", { name: "Đạt", exact: true })
      .check();
  }
}

test("incomplete and failed checklist drafts persist; four PASS unlock without notes or photos", async ({
  page,
}) => {
  const f = await fixture(page);
  await page.goto("/staff/check-in?bookingCode=BK-2026-0001");
  await page.getByRole("button", { name: "Xác minh booking & Chuyển sang kiểm tra kho" }).click();
  const first = page.getByRole("group", {
    name: "Đúng ô kho đã được gán cho booking",
    exact: true,
  });
  await first.getByRole("radio", { name: "Đạt", exact: true }).check();
  await page.getByRole("button", { name: "Lưu nháp", exact: true }).click();
  await expect(page.getByText("Đã lưu biên bản nháp.", { exact: true })).toBeVisible();
  expect(f.getInspection()?.results).toHaveLength(1);
  await page.reload();
  await expect(first.getByRole("radio", { name: "Đạt", exact: true })).toBeChecked();
  await expect(page.getByRole("button", { name: "Lưu và xem lại trước khi khóa" })).toBeDisabled();
  await passChecklist(page);
  const lock = page.getByRole("group", { name: "Cửa và khóa hoạt động bình thường", exact: true });
  await lock.getByRole("radio", { name: "Không đạt", exact: true }).check();
  await page.getByRole("button", { name: "Lưu nháp", exact: true }).click();
  await expect
    .poll(() => f.getInspection()?.results?.find((r) => r.itemCode === "DOOR_LOCK")?.result)
    .toBe("FAIL");
  await page.reload();
  await expect(lock.getByRole("radio", { name: "Không đạt", exact: true })).toBeChecked();
  await expect(page.getByRole("button", { name: "Lưu và xem lại trước khi khóa" })).toBeDisabled();
  await lock.getByRole("radio", { name: "Đạt", exact: true }).check();
  await page.getByRole("button", { name: "Lưu và xem lại trước khi khóa" }).click();
  expect(f.getInspection()?.conditionNotes).toBe("");
  expect(f.getInspection()?.photos).toEqual([]);
  expect(HandoverChecklistCompletionSchema.safeParse(f.getInspection()?.results).success).toBe(
    true,
  );
  await page.getByRole("checkbox", { name: /Tôi đã đối chiếu/ }).check();
  await page.getByRole("button", { name: "Hoàn tất kiểm tra ô kho (Khóa biên bản)" }).click();
  await expect(
    page.getByRole("heading", { name: "Bàn giao kho & Kích hoạt thuê kho" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Bàn giao kho & Kích hoạt thuê kho" }),
  ).toBeVisible();
  await expect(page.getByText("Cửa và khóa hoạt động bình thường", { exact: true })).toBeVisible();
});

test("dispatch does not invent NO_SHOW after slot end plus two hours", async ({ page }) => {
  await fixture(page, { role: "FACILITY_MANAGER", elapsedSlot: true });
  await page.goto("/facility-manager/dashboard?view=tasks");
  const card = page
    .locator("section")
    .filter({ has: page.getByText("BK-2026-0001", { exact: true }) });
  await expect(card.getByText("Đủ điều kiện check-in", { exact: true })).toBeVisible();
  await expect(card.getByText("Quá hạn nhận kho", { exact: true })).toHaveCount(0);
});

for (const width of [1440, 390]) {
  test(`four-item checklist accessibility and review at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await fixture(page);
    await page.goto("/staff/check-in?bookingCode=BK-2026-0001");
    await page.getByRole("button", { name: "Xác minh booking & Chuyển sang kiểm tra kho" }).click();
    await expect(
      page
        .locator("fieldset")
        .filter({ has: page.getByRole("radio", { name: "Đạt", exact: true }) }),
    ).toHaveCount(4);
    await page
      .locator("fieldset")
      .filter({ has: page.getByRole("radio", { name: "Đạt", exact: true }) })
      .first()
      .getByRole("radio", { name: "Đạt", exact: true })
      .focus();
    await page.keyboard.press("Space");
    await expect(
      page
        .locator("fieldset")
        .filter({ has: page.getByRole("radio", { name: "Đạt", exact: true }) })
        .first()
        .getByRole("radio", { name: "Đạt", exact: true }),
    ).toBeChecked();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `/tmp/storex-four-pass-inspect-${width}.png`, fullPage: true });
    await passChecklist(page);
    await page.getByRole("button", { name: "Lưu và xem lại trước khi khóa" }).click();
    await expect(page.getByText("Không có ghi chú bổ sung.", { exact: true })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: `/tmp/storex-four-pass-review-${width}.png`, fullPage: true });
  });
}

test("legacy correct-unit flag never fabricates four PASS results", async ({ page }) => {
  const f = await fixture(page);
  await page.goto("/staff/check-in?bookingCode=BK-2026-0001");
  await page.getByRole("button", { name: "Xác minh booking & Chuyển sang kiểm tra kho" }).click();
  await expect(
    page.locator("fieldset").filter({ has: page.getByRole("radio", { name: "Đạt", exact: true }) }),
  ).toHaveCount(4);
  const record = f.getInspection();
  if (!record) throw new Error("Expected inspection");
  record.correctUnit = true;
  record.results = null;
  record.checklistDefinition = null;
  record.checklistVersion = null;
  record.conditionNotes = "Ghi chú biên bản cũ";
  await page.reload();
  await expect(
    page.locator("fieldset").filter({ has: page.getByRole("radio", { name: "Đạt", exact: true }) }),
  ).toHaveCount(4);
  await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Lưu và xem lại trước khi khóa" })).toBeDisabled();
});

test("Staff realtime refreshes assigned tasks, ignores invalid recipients and deduplicates events", async ({
  page,
}) => {
  const f = await fixture(page);
  let showTask = false;
  let reads = 0;
  await page.route("**/api/bookings/assigned-to-me*", async (route) => {
    reads++;
    await route.fulfill({ json: { success: true, data: showTask ? [f.booking] : [] } });
  });
  let push: (data: string) => void = () => {};
  await page.routeWebSocket("**/api/notifications/ws", (ws) => {
    push = (data) => ws.send(data);
  });
  await page.goto("/staff/dashboard?view=tasks");
  await page.getByRole("button", { name: "Mở thông báo", exact: true }).click();
  await expect(page.getByText("Đang nhận thông báo trực tiếp", { exact: true })).toBeVisible();
  await expect.poll(() => reads).toBeGreaterThan(0);
  const before = reads;
  const event = {
    id: "event-1",
    type: "STAFF_TASK_ASSIGNED",
    recipientId: f.booking.assignedStaff?.id,
    bookingId: f.booking.id,
    occurredAt: new Date().toISOString(),
  };
  push("invalid-json");
  push(JSON.stringify({ ...event, recipientId: "another-staff" }));
  await expect(page.getByText("Bạn vừa được phân công nhiệm vụ mới.", { exact: true })).toHaveCount(
    0,
  );
  showTask = true;
  push(JSON.stringify(event));
  await expect(
    page.getByText("Bạn vừa được phân công nhiệm vụ mới.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(f.booking.bookingCode, { exact: true })).toBeVisible();
  await expect.poll(() => reads).toBeGreaterThan(before);
  push(JSON.stringify(event));
  await expect(page.getByText("Bạn vừa được phân công nhiệm vụ mới.", { exact: true })).toHaveCount(
    1,
  );
});

test("Staff realtime reconnects, refreshes missed tasks and closes when leaving the shell", async ({
  page,
}) => {
  const f = await fixture(page);
  let showTask = false;
  await page.route("**/api/bookings/assigned-to-me*", (route) =>
    route.fulfill({ json: { success: true, data: showTask ? [f.booking] : [] } }),
  );
  let connections = 0,
    closes = 0;
  let disconnect = () => {};
  await page.routeWebSocket("**/api/notifications/ws", (ws) => {
    connections++;
    disconnect = () => ws.close({ code: 1012, reason: "Test restart" });
    ws.onClose(() => closes++);
  });
  await page.goto("/staff/dashboard?view=tasks");
  await page.getByRole("button", { name: "Mở thông báo", exact: true }).click();
  await expect(page.getByText("Đang nhận thông báo trực tiếp", { exact: true })).toBeVisible();
  showTask = true;
  disconnect();
  await expect.poll(() => connections).toBeGreaterThan(1);
  await expect(page.getByText(f.booking.bookingCode, { exact: true })).toBeVisible();
  await page.goto("/login");
  await expect.poll(() => closes).toBeGreaterThan(0);
});

test("manager never opens a Staff notification socket", async ({ page }) => {
  await fixture(page, { role: "FACILITY_MANAGER" });
  let connections = 0;
  await page.routeWebSocket("**/api/notifications/ws", () => {
    connections++;
  });
  await page.goto("/facility-manager/dashboard?view=check-in");
  await expect(page.getByRole("heading", { name: "Chuẩn bị kho & Phân công Staff" })).toBeVisible();
  expect(connections).toBe(0);
  await expect(page.getByText("Đang nhận thông báo trực tiếp", { exact: true })).toHaveCount(0);
});

for (const width of [1440, 390]) {
  test(`Staff notification connection states remain accessible at ${width}px`, async ({ page }) => {
    await fixture(page);
    await page.setViewportSize({ width, height: 1000 });
    let connections = 0;
    let reject = () => {};
    await page.routeWebSocket("**/api/notifications/ws", (ws) => {
      connections++;
      reject = () => ws.close({ code: 1008, reason: "Session expired" });
    });
    await page.goto("/staff/dashboard?view=tasks");
    await page.getByRole("button", { name: "Mở thông báo", exact: true }).click();
    await expect(page.getByText("Đang nhận thông báo trực tiếp", { exact: true })).toBeVisible();
    const initialConnections = connections;
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect(
      page.getByText("Bạn đang ngoại tuyến. Kết nối lại mạng để tải nhiệm vụ mới."),
    ).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect.poll(() => connections).toBeGreaterThan(initialConnections);
    await expect(page.getByText("Đang nhận thông báo trực tiếp", { exact: true })).toBeVisible();
    const onlineConnections = connections;
    reject();
    await expect(
      page.getByText(
        "Kết nối thông báo bị từ chối. Kiểm tra lại phiên đăng nhập hoặc quyền truy cập.",
      ),
    ).toBeVisible();
    await page.waitForTimeout(1200);
    expect(connections).toBe(onlineConnections);
    await page.evaluate(() => {
      window.dispatchEvent(new Event("offline"));
      window.dispatchEvent(new Event("online"));
    });
    await expect(page.getByRole("button", { name: "Kết nối lại", exact: true })).toBeVisible();
    expect(connections).toBe(onlineConnections);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: `/tmp/storex-staff-notifications-${width}.png`, fullPage: true });
    await page.getByRole("button", { name: "Kết nối lại", exact: true }).click();
    await expect.poll(() => connections).toBeGreaterThan(onlineConnections);
    await expect(page.getByText("Đang nhận thông báo trực tiếp", { exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
}
