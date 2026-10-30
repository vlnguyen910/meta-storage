import { SupportTicketParamsSchema } from "@metastorage/contracts";
import { UserRole } from "@metastorage/database/schema/user-enums";
import { expect, type Page, test } from "@playwright/test";

const id = (n: number) => `95000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const now = "2026-10-29T03:00:00.000Z";
async function fixture(page: Page, role: UserRole) {
  const requests: string[] = [];
  const unexpected: string[] = [];
  const actorId = role === UserRole.FACILITY_STAFF ? id(2) : id(3);
  const types = [
    {
      id: id(7),
      facilityId: id(1),
      code: "TYPE-TEST",
      name: "Kho tiêu chuẩn",
      sizeLabel: "4 m²",
      lengthM: 2,
      widthM: 2,
      heightM: 2,
      sizeCbm: 8,
      monthlyPrice: 1000000,
      version: 1,
      updatedBy: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
  const writes: { path: string; body: Record<string, unknown> }[] = [];
  const reservation = {
    id: id(6),
    bookingCode: "SX-MIGRATION",
    facilityName: "Cơ sở kiểm thử",
  };
  const supportTicket = {
    id: id(12),
    reservationId: reservation.id,
    rentalId: id(13),
    subject: "Khóa cửa cần hỗ trợ",
    description: "Chìa khóa không mở được cửa kho.",
    status: "OPEN",
    category: "LOCK",
    createdAt: now,
  };
  const supportTickets = Array.from({ length: 10 }, (_, index) =>
    index === 0
      ? supportTicket
      : {
          ...supportTicket,
          id: id(30 + index),
          subject: `Khóa cửa cần hỗ trợ ${index + 1}`,
        },
  );
  await page.routeWebSocket("**/api/notifications/ws", () => {});
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api/, "");
    requests.push(`${request.method()} ${path}`);
    if (request.method() === "PATCH" || request.method() === "POST")
      writes.push({ path, body: request.postDataJSON() ?? {} });
    let data: unknown;
    if (path === "/auth/me")
      data = {
        id: actorId,
        role,
        name: "Người kiểm thử",
        email: "test@example.test",
        status: "ACTIVE",
        isActive: true,
        assignedFacilityId: id(1),
      };
    else if (path === "/facilities/my-assignments")
      data = [
        {
          id: id(11),
          facilityId: id(1),
          facilityCode: "HCM-TEST",
          facilityName: "Cơ sở kiểm thử",
          userId: actorId,
          role,
          isActive: true,
          endedAt: null,
          assignedAt: now,
        },
      ];
    else if (path === "/notifications") data = [];
    else if (path === "/facilities/management")
      data = [
        {
          id: id(1),
          code: "HCM-TEST",
          name: "Cơ sở kiểm thử",
          address: "Địa chỉ kiểm thử",
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
      ];
    else if (path === `/facilities/${id(1)}/unit-types`) data = types;
    else if (path === "/unit-types") {
      if (request.method() === "POST") {
        const template = types[0];
        if (!template) throw new Error("Missing type fixture");
        const type = { ...template, ...request.postDataJSON(), id: id(14), version: 1 };
        types.push(type);
        data = type;
      } else data = types;
    } else if (path === `/unit-types/${id(7)}` && request.method() === "PATCH") {
      const type = types[0];
      if (!type) throw new Error("Missing type fixture");
      Object.assign(type, request.postDataJSON(), { version: type.version + 1 });
      data = type;
    } else if (path === "/storage-units")
      data = {
        items: [
          {
            id: id(5),
            facilityId: id(1),
            unitTypeId: id(7),
            code: "HCM-TEST-01",
            status: "AVAILABLE",
            unitTypeName: "Kho tiêu chuẩn",
            unitTypeSizeLabel: "4 m²",
            createdAt: now,
            updatedAt: now,
          },
        ],
        total: 1,
        limit: 10,
        offset: 0,
      };
    else if (path === "/support/tickets") {
      if (request.method() === "POST") {
        const body = request.postDataJSON();
        Object.assign(supportTicket, {
          subject: body.subject,
          description: body.content,
          category: body.category,
        });
        data = { ticket: supportTicket, messages: { items: [], nextCursor: null } };
      } else data = { items: supportTickets, nextCursor: null };
    } else if (path === "/support/contexts")
      data = {
        items: [
          {
            id: reservation.id,
            bookingCode: reservation.bookingCode,
            facility: { id: id(1), name: reservation.facilityName },
            status: "CHECKED_IN",
          },
        ],
        nextCursor: null,
      };
    else if (path.startsWith("/support/tickets/")) {
      const ticketId = path.slice("/support/tickets/".length);
      if (!SupportTicketParamsSchema.safeParse({ ticketId }).success) {
        unexpected.push(`${request.method()} ${path}`);
        return route.fulfill({
          status: 400,
          json: { success: false, error: { message: "params/ticketId Invalid UUID" } },
        });
      }
      data = {
        ticket: supportTickets.find((ticket) => path === `/support/tickets/${ticket.id}`),
        messages: { items: [], nextCursor: null },
      };
    } else {
      unexpected.push(`${request.method()} ${path}`);
      return route.fulfill({
        status: 404,
        json: { success: false, error: { message: "Unsupported API in migrated fixture" } },
      });
    }
    return route.fulfill({ json: { success: true, data, timestamp: now } });
  });
  return {
    requests,
    unexpected,
    reservation,
    writes,
    supportTicket,
    supportTickets,
  };
}

test("FM support remains accessible without calling retired management endpoints", async ({
  page,
}) => {
  const state = await fixture(page, UserRole.FACILITY_MANAGER);
  await page.goto(`/facility-manager/support?ticketId=${id(12)}`);
  await expect(page.getByText("Điều phối hỗ trợ chưa khả dụng")).toBeVisible();
  expect(state.requests.some((path) => path.includes("/facility-workspace/support"))).toBe(false);
  expect(state.unexpected).toEqual([]);
});

test("Customer sees the saved support description without reply or image API calls", async ({
  page,
}, testInfo) => {
  const state = await fixture(page, UserRole.STORAGE_CUSTOMER);
  await page.goto(`/customer/support/tickets/${id(12)}`);
  await expect(page.getByRole("dialog", { name: "Chi tiết yêu cầu hỗ trợ" })).toBeVisible();
  await expect(page.getByText("Chìa khóa không mở được cửa kho.")).toBeVisible();
  await expect(page.getByText(/Đội ngũ hỗ trợ sẽ liên hệ qua email/)).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Xem booking liên quan" })).toHaveAttribute(
    "href",
    `/customer/reservations/${state.reservation.id}`,
  );
  await expect(page.getByRole("link", { name: "Xem kỳ thuê liên quan" })).toHaveAttribute(
    "href",
    `/customer/storage/${id(13)}`,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: `/tmp/metastorage-support-detail-${testInfo.project.name}.png`,
    fullPage: true,
  });
  expect(state.unexpected).toEqual([]);
});

test("Support popup preserves list search and pagination through Back, Forward and Escape", async ({
  page,
}, testInfo) => {
  const state = await fixture(page, UserRole.STORAGE_CUSTOMER);
  await page.goto("/customer/support");
  const search = page.getByRole("searchbox");
  await search.fill("Khóa");
  await page.getByRole("button", { name: "Tìm kiếm", exact: true }).click();
  const secondPage = page
    .getByRole("navigation", { name: "Phân trang Yêu cầu hỗ trợ" })
    .getByRole("button", { name: "2", exact: true });
  await secondPage.click();
  const opener = page.getByRole("link", { name: "Xem chi tiết", exact: true }).first();
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Chi tiết yêu cầu hỗ trợ" });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\/customer\/support\/tickets\/95000000/);
  await page.goBack();
  await expect(dialog).toHaveCount(0);
  await expect(search).toHaveValue("Khóa");
  await expect(secondPage).toHaveAttribute("aria-current", "page");
  await expect(opener).toBeFocused();
  await page.goForward();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(search).toHaveValue("Khóa");
  await expect(secondPage).toHaveAttribute("aria-current", "page");
  await opener.click();
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: `/tmp/metastorage-support-popup-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await dialog.getByRole("button", { name: "Đóng", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(search).toHaveValue("Khóa");
  expect(state.unexpected).toEqual([]);
});

test("Support deep link survives reload and long content scrolls inside the popup", async ({
  page,
}, testInfo) => {
  const state = await fixture(page, UserRole.STORAGE_CUSTOMER);
  state.supportTicket.description = "Tôi cần hỗ trợ mở khóa ô kho.\n".repeat(50);
  await page.goto(`/customer/support/tickets/${id(12)}`);
  await page.reload();
  const dialog = page.getByRole("dialog", { name: "Chi tiết yêu cầu hỗ trợ" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Khóa cửa cần hỗ trợ" })).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(bounds?.height).toBeLessThanOrEqual(page.viewportSize()?.height ?? 0);
  const scrollArea = dialog.locator(".overflow-y-auto");
  expect(await scrollArea.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(
    true,
  );
  await scrollArea.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(dialog.getByRole("button", { name: "Đóng", exact: true })).toBeInViewport();
  await page.screenshot({
    path: `/tmp/metastorage-support-popup-long-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await dialog.getByRole("button", { name: "Đóng", exact: true }).click();
  await expect(page).toHaveURL(/\/customer\/support$/);
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Yêu cầu hỗ trợ", exact: true })).toBeVisible();
  expect(state.unexpected).toEqual([]);
});

test("Creating support opens its popup over the list and closes without returning to the submitted form", async ({
  page,
}, testInfo) => {
  const state = await fixture(page, UserRole.STORAGE_CUSTOMER);
  await page.goto("/customer/support");
  await page.getByRole("button", { name: "Tạo yêu cầu mới", exact: true }).click();
  await expect(page).toHaveURL(/\/customer\/support\/new$/);
  await expect(
    page.getByRole("heading", { name: "Gửi yêu cầu hỗ trợ", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.locator("#support-category").click();
  await page.getByRole("option", { name: "Khóa", exact: true }).click();
  await page.locator("#support-booking").click();
  await page.getByRole("option", { name: /SX-MIGRATION/ }).click();
  await page.locator("#support-subject").fill("Khóa cửa không mở được");
  await page.locator("#support-content").fill("Tôi cần nhân viên kiểm tra khóa cửa.");
  await page.screenshot({
    path: `/tmp/metastorage-support-create-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.locator("form button[type=submit]").click();
  const dialog = page.getByRole("dialog", { name: "Chi tiết yêu cầu hỗ trợ" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Tôi cần nhân viên kiểm tra khóa cửa.")).toBeVisible();
  await dialog.getByRole("button", { name: "Đóng", exact: true }).click();
  await expect(page).toHaveURL(/\/customer\/support$/);
  await expect(page.getByRole("searchbox")).toBeVisible();
  expect(state.requests).not.toContain("GET /support/tickets/new");
  expect(state.writes.filter((write) => write.path === "/support/tickets")).toHaveLength(1);
  expect(state.unexpected).toEqual([]);
});

test("Empty support list opens the create form without a ticket-detail request", async ({
  page,
}) => {
  const state = await fixture(page, UserRole.STORAGE_CUSTOMER);
  state.supportTickets.splice(0);
  await page.goto("/customer/support");
  await expect(page.getByRole("heading", { name: "Chưa có yêu cầu hỗ trợ nào" })).toBeVisible();
  await page.getByRole("button", { name: "Tạo yêu cầu mới", exact: true }).last().click();
  await expect(
    page.getByRole("heading", { name: "Gửi yêu cầu hỗ trợ", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Chưa có yêu cầu hỗ trợ nào" })).toBeVisible();
  expect(state.requests.filter((request) => request.startsWith("GET /support/tickets/"))).toEqual(
    [],
  );
  expect(state.writes).toEqual([]);
  expect(state.unexpected).toEqual([]);
});

test("Legacy ticket links remain readable and malformed IDs never reach the API", async ({
  page,
}) => {
  const state = await fixture(page, UserRole.STORAGE_CUSTOMER);
  await page.goto(`/customer/support/${id(12)}`);
  await expect(page.getByRole("dialog", { name: "Chi tiết yêu cầu hỗ trợ" })).toBeVisible();
  await expect(page.getByText("Chìa khóa không mở được cửa kho.")).toBeVisible();
  for (const path of ["/customer/support/not-a-uuid", "/customer/support/tickets/not-a-uuid"]) {
    await page.goto(path);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator("h1")).toBeVisible();
  }
  expect(state.requests.filter((request) => request.startsWith("GET /support/tickets/"))).toEqual([
    `GET /support/tickets/${id(12)}`,
  ]);
  expect(state.unexpected).toEqual([]);
});

test("FM creates a facility-scoped unit type and edits the price with its version", async ({
  page,
}) => {
  const state = await fixture(page, UserRole.FACILITY_MANAGER);
  await page.goto("/facility-manager/storage-units");
  await page.getByRole("button", { name: "Loại kho & Giá thuê", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: "TYPE-TEST" });
  await row.getByRole("button", { name: "Sửa thông tin", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Giá thuê ban đầu (VND/tháng)").fill("1250000");
  await page.getByRole("dialog").getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(state.writes.find((write) => write.path === `/unit-types/${id(7)}`)?.body).toMatchObject({
    monthlyPrice: 1250000,
    expectedVersion: 1,
  });
  await page.getByRole("button", { name: "Thêm loại kho", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Mã", { exact: true }).fill("TYPE-NEW");
  await dialog.getByLabel("Tên", { exact: true }).fill("Loại kho mới");
  await dialog.getByLabel("Nhãn kích thước").fill("6 m²");
  await dialog.getByLabel("Chiều dài (m)").fill("3");
  await dialog.getByLabel("Chiều rộng (m)").fill("2");
  await dialog.getByLabel("Chiều cao (m)").fill("2");
  await dialog.getByLabel("Giá thuê ban đầu (VND/tháng)").fill("1500000");
  await dialog.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.writes.find((write) => write.path === "/unit-types")?.body).toMatchObject({
    facilityId: id(1),
    code: "TYPE-NEW",
    monthlyPrice: 1500000,
  });
  expect(state.unexpected).toEqual([]);
});

test("BOM views unit types and physical units without FM-only write actions", async ({ page }) => {
  const state = await fixture(page, UserRole.BUSINESS_OPERATIONS_MANAGER);
  await page.goto("/operations/facility-management");
  await page.getByRole("button", { name: "Danh mục loại kho", exact: true }).click();
  await expect(page.getByRole("row").filter({ hasText: "TYPE-TEST" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Thêm loại kho", exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("row").filter({ hasText: "TYPE-TEST" }).getByRole("button"),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Quản lý ô kho", exact: true }).click();
  await expect(page.getByText("HCM-TEST-01", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Thêm ô kho", exact: true })).toHaveCount(0);
  expect(state.unexpected).toEqual([]);
});
