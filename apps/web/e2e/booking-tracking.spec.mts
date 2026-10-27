import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { createTrackingFixture } from "../../api/tests/fixtures/booking-tracking";
import { bookingLookupMessages as L } from "../src/features/booking-tracking/booking-lookup.messages";

test.skip(
  process.env.BOOKING_TRACKING_E2E !== "1",
  "Use playwright.tracking.config.ts with an isolated database and Redis",
);

test("email link opens a private booking, supports refresh and revokes the session", async ({
  page,
  context,
}, testInfo) => {
  const fixture = await createTrackingFixture();
  try {
    let exchanges = 0;
    let trackingReads = 0;
    page.on("request", (request) => {
      if (request.url().endsWith("/booking/magic-link/exchange")) exchanges++;
      if (request.url().includes("/api/booking/tracking/")) trackingReads++;
    });
    await page.goto(fixture.trackingUrl);
    await expect(page.getByText(fixture.code, { exact: true })).toBeVisible();
    expect(exchanges).toBe(1);
    expect(new URL(page.url()).hash).toBe("");
    await expect(page.getByText("Khách kiểm thử", { exact: true })).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(trackingReads).toBe(0);
    expect(
      (await context.cookies()).find((cookie) => cookie.name === "metastorage_booking_session")
        ?.httpOnly,
    ).toBe(true);
    expect(await page.evaluate(() => document.cookie)).not.toContain("metastorage_booking_session");
    expect(
      await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
    ).not.toContain("token=");
    await page.reload();
    await expect(page.getByText(fixture.code, { exact: true })).toBeVisible();
    expect(exchanges).toBe(1);
    expect(trackingReads).toBeGreaterThan(0);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath("tracking.png"),
      fullPage: true,
      mask: [page.getByText(fixture.code, { exact: true })],
    });
    const revoke = page.getByRole("button", { name: "Kết thúc phiên tra cứu" });
    await revoke.focus();
    await expect(revoke).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("main").getByRole("alert")).toContainText("Đã kết thúc phiên");
    await expect(page.getByText("Khách kiểm thử", { exact: true })).toHaveCount(0);
    await page.goto(`/booking/tracking?bookingCode=${fixture.code}`);
    await expect(page.getByRole("main").getByRole("alert")).toContainText("hết hạn");
  } finally {
    await fixture.cleanup();
  }
});
test("expired and missing links show a usable error without private information", async ({
  page,
}) => {
  const fixture = await createTrackingFixture();
  try {
    await fixture.expire();
    await page.goto(fixture.trackingUrl);
    await expect(page.getByRole("main").getByRole("alert")).toContainText("hết hạn");
    await expect(page.getByText("Khách kiểm thử", { exact: true })).toHaveCount(0);
    expect(new URL(page.url()).hash).toBe("");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.goto("/booking/tracking");
    await expect(page.getByRole("heading", { name: L.title, exact: true })).toBeVisible();
    await expect(page.getByLabel(L.email, { exact: true })).toBeVisible();
    await expect(page.getByText("Khách kiểm thử", { exact: true })).toHaveCount(0);
  } finally {
    await fixture.cleanup();
  }
});
