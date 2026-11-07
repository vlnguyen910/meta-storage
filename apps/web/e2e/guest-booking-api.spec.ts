import AxeBuilder from "@axe-core/playwright";
import type { BookingTracking } from "@metastorage/contracts";
import { expect, type Page, test } from "@playwright/test";
import { bookingLookupMessages as L } from "../src/features/booking-tracking/booking-lookup.messages";
import { trackingMessages as M } from "../src/features/booking-tracking/tracking.messages";
import { F3 } from "../src/features/returns/integration.messages";

const code = "SX-GUEST-TEST";
const token = "a".repeat(64);
const instant = "2026-10-23T03:00:00.000Z";
const booking: BookingTracking = {
  bookingCode: code,
  status: "CHECKED_IN",
  facility: { name: "Test facility", address: "Test address" },
  unitType: { name: "Standard", sizeLabel: "4 m²" },
  checkInSlotStart: instant,
  checkInSlotEnd: instant,
  rentalEndAt: "2027-01-23T03:00:00.000Z",
  durationMonths: 3,
  contact: { fullName: "Private guest", email: "guest@example.test", phone: "0901234567" },
  pricing: {
    currency: "VND",
    monthlyRateSnapshot: "1000000",
    rentalFeeAmount: "3000000",
    depositAmount: "1000000",
    totalAmount: "4000000",
  },
  payment: {
    status: "SUCCEEDED",
    paidAt: instant,
    refundAmount: null,
    depositForfeitedAmount: "0",
  },
};

async function fixture(page: Page) {
  const calls: Array<{ path: string; method: string; body: Record<string, unknown> | null }> = [];
  const state = {
    session: false,
    expiredToken: false,
    requestFailure: 0,
    rentalMissing: false,
    trackingFailure: false,
  };
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api/, "");
    const headers = {
      "Access-Control-Allow-Origin": new URL(
        page.url() === "about:blank" ? "http://localhost:3000" : page.url(),
      ).origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "content-type,authorization",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    calls.push({ path, method: request.method(), body: request.postDataJSON() });
    const send = (data: unknown, status = 200) =>
      route.fulfill({
        status,
        headers,
        json: { success: status < 400, data, message: status >= 400 ? "Test failure" : "OK" },
      });
    if (path === "/auth/me") return send(null, 401);
    if (path === "/booking/access-link")
      return state.requestFailure
        ? send(null, state.requestFailure)
        : send({ message: "Accepted without confirming recipient" }, 202);
    if (path === "/booking/magic-link/exchange") {
      if (state.expiredToken) return send(null, 401);
      state.session = true;
      return send({
        bookingCode: code,
        expiresAt: new Date(Date.now() + 1800000).toISOString(),
        booking,
      });
    }
    if (path === "/booking/session/revoke") {
      state.session = false;
      return route.fulfill({ status: 204, headers });
    }
    if (path.startsWith("/booking/tracking/")) {
      if (!state.session || path.split("/")[3] !== code) return send(null, 401);
      if (path === `/booking/tracking/${code}`)
        return state.trackingFailure ? send(null, 503) : send(booking);
      if (path.endsWith("/rental"))
        return state.rentalMissing
          ? send(null, 404)
          : send({
              id: "85000000-0000-4000-8000-000000000003",
              bookingId: "50000000-0000-4000-8000-000000000001",
              bookingCode: code,
              facility: { id: "30000000-0000-4000-8000-000000000001", ...booking.facility },
              unitType: { id: "40000000-0000-4000-8000-000000000001", ...booking.unitType },
              physicalUnit: { id: "40000000-0000-4000-8000-000000000002", code: "TEST-UNIT-03" },
              status: "ACTIVE",
              bookingStatus: "CHECKED_IN",
              startAt: instant,
              expectedEndAt: booking.rentalEndAt,
              actions: { canCancel: false, canReschedule: false, note: "Read only" },
              timeline: [],
              actualReturnAt: null,
              closedAt: null,
              depositAmount: "1000000",
              checkInSlotStart: instant,
              checkInSlotEnd: instant,
            });
      if (path.endsWith("/payments")) return send([]);
      if (path.endsWith("/contracts"))
        return send([
          { id: "40000000-0000-4000-8000-000000000001", version: 1, filename: "contract.pdf" },
        ]);
      if (path.endsWith("/pdf"))
        return route.fulfill({
          headers: { ...headers, "Content-Type": "application/pdf" },
          body: "%PDF-1.4\n%%EOF",
        });
    }
    return send(null, 404);
  });
  return { state, calls };
}

async function inspect(page: Page, name: string) {
  await page.evaluate(() => scrollTo(0, 0));
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: `test-results/guest-api-${name}-${page.viewportSize()?.width}.png`,
    fullPage: true,
  });
}

test("expired link can return to lookup without reloading the same route", async ({ page }) => {
  const { state, calls } = await fixture(page);
  state.expiredToken = true;
  await page.goto(`/booking/tracking#token=${token}`);
  await expect(page.getByRole("main").getByRole("alert")).toContainText(M.invalid);
  expect(new URL(page.url()).hash).toBe("");
  await page.getByText(L.lookupAgain, { exact: true }).click();
  await expect(page.getByLabel(L.bookingCode, { exact: true })).toBeVisible();
  expect(calls.filter((call) => call.path.endsWith("/magic-link/exchange"))).toHaveLength(1);
  await inspect(page, "expired-recovery");
});

test("access-link retry keeps its key and preserves the entered contact", async ({ page }) => {
  const { state, calls } = await fixture(page);
  state.requestFailure = 503;
  await page.goto("/booking/tracking");
  await page.getByLabel(L.bookingCode, { exact: true }).fill(code.toLowerCase());
  await page.getByLabel(L.email, { exact: true }).fill("Guest@Example.test");
  await page.getByRole("button", { name: L.submit, exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(L.failure);
  await expect(page.getByLabel(L.email, { exact: true })).toHaveValue("Guest@Example.test");
  state.requestFailure = 0;
  await page.getByRole("button", { name: L.submit, exact: true }).click();
  await expect(page.getByRole("status")).toContainText(L.success);
  const attempts = calls.filter((call) => call.path === "/booking/access-link");
  expect(attempts).toHaveLength(2);
  expect(attempts[1]?.body).toMatchObject({
    bookingCode: code,
    email: "guest@example.test",
    idempotencyKey: attempts[0]?.body?.idempotencyKey,
  });
  expect(calls.some((call) => call.path.includes("/tracking/"))).toBe(false);
  await inspect(page, "request-sent");
  await page.getByRole("button", { name: L.tryAgain, exact: true }).click();
  await page.getByLabel(L.bookingCode, { exact: true }).fill("SX-OTHER-GUEST");
  await page.getByLabel(L.email, { exact: true }).fill("other@example.test");
  await page.getByRole("button", { name: L.submit, exact: true }).click();
  await expect(page.getByRole("status")).toContainText(L.success);
  const next = calls.filter((call) => call.path === "/booking/access-link")[2];
  expect(next?.body?.idempotencyKey).not.toBe(attempts[0]?.body?.idempotencyKey);
});

test("rate limiting keeps the form recoverable without promising an email", async ({ page }) => {
  const { state } = await fixture(page);
  state.requestFailure = 429;
  await page.goto("/booking/tracking");
  await page.getByLabel(L.bookingCode, { exact: true }).fill(code);
  await page.getByLabel(L.email, { exact: true }).fill("guest@example.test");
  await page.getByRole("button", { name: L.submit, exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(L.rateLimited);
  await expect(page.getByLabel(L.email, { exact: true })).toHaveValue("guest@example.test");
  await expect(page.getByRole("button", { name: L.submit, exact: true })).toBeEnabled();
  await inspect(page, "rate-limited");
});

test("magic link opens read-only storage, survives reload and ends the private session", async ({
  page,
}) => {
  const { calls } = await fixture(page);
  await page.goto(`/booking/tracking#token=${token}`);
  await expect(page.getByText("Private guest", { exact: true })).toBeVisible();
  await expect(page.getByText("TEST-UNIT-03", { exact: true })).toBeVisible();
  expect(new URL(page.url()).hash).toBe("");
  expect(calls.filter((call) => call.path.endsWith("/magic-link/exchange"))).toHaveLength(1);
  expect(
    await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
  ).not.toContain(token);
  await expect(page.getByRole("button", { name: /Gửi yêu cầu trả kho|Đổi kho/ })).toHaveCount(0);
  await inspect(page, "private-storage");
  await page.reload();
  await expect(page.getByText("TEST-UNIT-03", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: F3.viewPdf, exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: F3.close, exact: true }).click();
  await page.getByRole("button", { name: M.revoke, exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(M.revoked);
  await expect(page.getByText("Private guest", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: L.lookupAgain, exact: true }).click();
  await expect(page.getByLabel(L.bookingCode, { exact: true })).toBeVisible();
});

test("booking code alone does not expose private data", async ({ page }) => {
  const { calls } = await fixture(page);
  await page.goto(`/booking/tracking?bookingCode=${code}`);
  await expect(page.getByRole("main").getByRole("alert")).toContainText(M.invalid);
  await expect(page.getByText("Private guest", { exact: true })).toHaveCount(0);
  expect(calls.some((call) => call.path.endsWith("/rental"))).toBe(false);
  await inspect(page, "unauthorized");
});

test("a guest session cannot display another booking", async ({ page }) => {
  await fixture(page);
  await page.goto(`/booking/tracking#token=${token}`);
  await expect(page.getByText("Private guest", { exact: true })).toBeVisible();
  await page.goto(`/booking/tracking?bookingCode=${code}-OTHER`);
  await expect(page.getByRole("main").getByRole("alert")).toContainText(M.invalid);
  await expect(page.getByText("Private guest", { exact: true })).toHaveCount(0);
  await expect(page.getByText("TEST-UNIT-03", { exact: true })).toHaveCount(0);
});

test("session expiry removes private data and offers lookup again", async ({ page }) => {
  await page.clock.install();
  await fixture(page);
  await page.goto(`/booking/tracking#token=${token}`);
  await expect(page.getByText("Private guest", { exact: true })).toBeVisible();
  await page.clock.fastForward(1801000);
  await expect(page.getByRole("main").getByRole("alert")).toContainText(M.invalid);
  await expect(page.getByText("Private guest", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: L.lookupAgain, exact: true }).click();
  await expect(page.getByLabel(L.bookingCode, { exact: true })).toBeVisible();
});

test("booking still displays before a rental has been handed over", async ({ page }) => {
  const { state } = await fixture(page);
  state.rentalMissing = true;
  await page.goto(`/booking/tracking#token=${token}`);
  await expect(page.getByText("Private guest", { exact: true })).toBeVisible();
  await expect(page.getByText(F3.guestNoRental, { exact: true })).toBeVisible();
  await expect(page.getByText("TEST-UNIT-03", { exact: true })).toHaveCount(0);
});
