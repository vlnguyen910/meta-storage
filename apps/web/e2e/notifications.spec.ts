import AxeBuilder from "@axe-core/playwright";
import { type LifecycleNotificationItem, UserRole } from "@metastorage/contracts";
import { expect, type Page, test } from "@playwright/test";
import { STAFF_NOTIFICATIONS as S } from "../src/features/facility-flow/staff-task-notifications.messages";
import { NOTIFICATIONS as M } from "../src/features/notifications/notifications.messages";

const id = (n: number) => `98000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const now = new Date("2026-10-25T05:00:00.000Z");
const notifications: LifecycleNotificationItem[] = Array.from({ length: 53 }, (_, i) => ({
  id: id(100 + (i === 20 ? 19 : i)),
  type: i % 3 === 0 ? "PAYMENT_CONFIRMED" : i % 3 === 1 ? "RETURN_SCHEDULED" : "UPCOMING_EXPIRY",
  bookingId: id(3),
  subject: i === 2 ? "Cập nhật hồ sơ ".repeat(30) : `Cập nhật kho số ${i + 1}`,
  body:
    i === 2
      ? "Nội_dung_dài_không_có_khoảng_trắng".repeat(30)
      : "Hồ sơ kho của bạn có cập nhật mới. Vui lòng kiểm tra thông tin trước lịch hẹn nhận kho.",
  occurredAt: new Date(now.getTime() - i * 3600000).toISOString(),
}));

async function setup(page: Page, role: UserRole = UserRole.STORAGE_CUSTOMER) {
  await page.clock.setFixedTime(now);
  const reads: number[] = [];
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api/, "");
    let data: unknown = [];
    if (path === "/auth/me")
      data = {
        id: id(1),
        name: "Người kiểm thử",
        email: "test@example.test",
        role,
        isActive: true,
        assignedFacilityId: id(2),
      };
    else if (path === "/facilities/my-assignments")
      data = [{ facilityId: id(2), facilityName: "StoreX Sài Gòn", isActive: true }];
    else if (path === "/notifications") {
      const offset = Number(url.searchParams.get("offset") ?? 0);
      reads.push(offset);
      data = notifications.slice(offset, offset + 20);
    } else if (path === "/business-rules/pricing")
      data = {
        version: 1,
        depositMonths: 2,
        updatedAt: now.toISOString(),
        updatedBy: id(1),
        prices: [],
      };
    return route.fulfill({ json: { success: true, data } });
  });
  return { reads };
}

async function accessible(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(
    violations.map(({ id, nodes }) => ({
      id,
      nodes: nodes.map(({ html, failureSummary }) => ({ html, failureSummary })),
    })),
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

for (const role of [UserRole.STORAGE_CUSTOMER, UserRole.FACILITY_MANAGER]) {
  for (const width of [1440, 375]) {
    test(`${role} bell, bounded popup and full-page history at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 375 ? 812 : 1000 });
      const { reads } = await setup(page, role);
      const root = role === UserRole.STORAGE_CUSTOMER ? "/customer" : "/facility-manager";
      await page.goto(`${root}/notifications`);
      await expect(
        page.getByRole("heading", { name: M.title, exact: true, level: 1 }),
      ).toBeVisible();
      await expect(page.locator("main li")).toHaveCount(20);
      expect(reads).toEqual([0]);
      const bell = page.getByRole("banner").getByRole("button", { name: M.open });
      await expect(bell).toBeVisible();
      await expect(page.locator("main").getByRole("button", { name: M.open })).toHaveCount(0);
      await bell.click();
      const dialog = page.getByRole("dialog", { name: M.title, exact: true });
      await expect(dialog.getByRole("listitem")).toHaveCount(8);
      await expect(dialog.getByRole("button", { name: M.close })).toBeFocused();
      const bounds = await dialog.boundingBox();
      expect(bounds).not.toBeNull();
      if (bounds) {
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(width === 375 ? 812 : 1000);
      }
      const scroll = dialog.getByRole("region", { name: M.list });
      expect(await scroll.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
      await accessible(page);
      await expect(page).toHaveScreenshot(`bell-${role}-${width}.png`);
      await scroll.focus();
      await page.keyboard.press("PageDown");
      await expect.poll(() => scroll.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
      await expect(dialog.getByRole("link", { name: M.viewAll })).toBeInViewport();
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(bell).toBeFocused();
      await bell.click();
      await page.getByRole("banner").click({ position: { x: 4, y: 4 } });
      await expect(dialog).toHaveCount(0);
      await bell.click();
      await dialog.getByRole("link", { name: M.viewAll }).click();
      await expect(dialog).toHaveCount(0);
      await expect(page).toHaveURL(new RegExp(`${root}/notifications$`));
      await page.getByRole("button", { name: M.loadMore }).click();
      await expect(page.locator("main li")).toHaveCount(39);
      await page.getByRole("button", { name: M.loadMore }).click();
      await expect(page.locator("main li")).toHaveCount(52);
      await expect(page.getByRole("button", { name: M.loadMore })).toHaveCount(0);
      await expect(page.getByText(M.end)).toBeVisible();
      expect(reads).toEqual([0, 20, 40]);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await accessible(page);
      await page.screenshot({ path: `test-results/notifications-page-${role}-${width}.png` });
    });
  }
}

test("popup handles short viewports, empty data and retry without losing loaded notifications", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 414 });
  await setup(page);
  let fail = true;
  let empty = false;
  await page.route("**/api/notifications?*", (route) =>
    route.fulfill(
      fail
        ? { status: 503, json: { success: false, error: { code: 503, message: "Unavailable" } } }
        : { json: { success: true, data: empty ? [] : notifications.slice(0, 20) } },
    ),
  );
  await page.goto("/customer/notifications");
  const bell = page.getByRole("button", { name: M.open });
  await bell.click();
  const dialog = page.getByRole("dialog", { name: M.title, exact: true });
  await expect(dialog.getByText(M.error, { exact: true })).toBeVisible();
  fail = false;
  empty = true;
  await dialog.getByRole("button", { name: M.retry }).click();
  await expect(dialog.getByText(M.empty, { exact: true })).toBeVisible();
  await accessible(page);
  await page.screenshot({ path: "test-results/notifications-empty-short.png" });
  await dialog.getByRole("link", { name: M.viewAll }).click();
  empty = false;
  await page.getByRole("button", { name: M.refresh }).click();
  await expect(page.locator("main li")).toHaveCount(20);
  fail = true;
  await page.getByRole("button", { name: M.refresh }).click();
  await expect(page.getByText(M.partialError)).toBeVisible();
  await expect(page.locator("main li")).toHaveCount(20);
  await page.screenshot({ path: "test-results/notifications-partial-error.png" });
});

test("Staff keeps one socket and bounded session events through popup and page navigation", async ({
  page,
}) => {
  const { reads } = await setup(page, UserRole.FACILITY_STAFF);
  let connections = 0;
  let closes = 0;
  let push = (_data: string) => {};
  let disconnect = () => {};
  await page.routeWebSocket("**/api/notifications/ws", (socket) => {
    connections++;
    push = (data) => socket.send(data);
    disconnect = () => socket.close({ code: 1012, reason: "Test restart" });
    socket.onClose(() => closes++);
  });
  await page.goto("/staff/dashboard?view=tasks");
  await page.getByRole("button", { name: M.open }).click();
  await expect(page.getByText(S.connected, { exact: true })).toBeVisible();
  const initialConnections = connections;
  expect(connections - closes).toBe(1);
  const event = {
    id: "staff-event-0",
    type: "STAFF_TASK_ASSIGNED",
    recipientId: id(1),
    bookingId: id(3),
    occurredAt: now.toISOString(),
  };
  push("invalid-json");
  push(JSON.stringify({ ...event, recipientId: id(9) }));
  await expect(page.getByText(M.staffEmpty)).toBeVisible();
  for (let i = 0; i < 105; i++)
    push(
      JSON.stringify({
        ...event,
        id: `staff-event-${i}`,
        occurredAt: new Date(now.getTime() - i * 1000).toISOString(),
      }),
    );
  push(JSON.stringify(event));
  const dialog = page.getByRole("dialog", { name: M.title, exact: true });
  await expect(dialog.getByRole("listitem")).toHaveCount(8);
  await expect(page.getByText(S.received, { exact: true })).toHaveCount(1);
  await dialog
    .getByRole("link", { name: new RegExp(M.staffSubject) })
    .first()
    .click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: M.open }).click();
  await dialog.getByRole("link", { name: M.viewAll }).click();
  await expect(page).toHaveURL(/\/staff\/notifications$/);
  await expect(page.locator("main li")).toHaveCount(100);
  await expect(page.getByText(M.sessionLimit)).toBeVisible();
  expect(connections).toBe(initialConnections);
  expect(reads).toEqual([]);
  disconnect();
  await expect.poll(() => connections).toBe(initialConnections + 1);
  await expect(page.locator("main li")).toHaveCount(100);
  await page.getByRole("button", { name: M.open }).click();
  await expect(page.getByText(S.connected, { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await accessible(page);
  await page.screenshot({ path: "test-results/notifications-staff-session.png" });
  const closesBeforeExit = closes;
  await page.goto("/login");
  await expect.poll(() => closes).toBeGreaterThan(closesBeforeExit);
});

test("only supported roles see inbox and Customer sessions cannot open the Staff page", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/staff/notifications");
  await expect(page).toHaveURL(/\/forbidden$/);
});
