import { readFileSync } from "node:fs";
import { CUSTOMER_WORKSPACE as M } from "@metastorage/shared";
import { expect, test } from "@playwright/test";
import type { CustomerLiveFixture } from "./support/customer-live.types";
import { tomorrowInVietnam } from "./support/reservation-form";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function customerFixture(): CustomerLiveFixture {
  return JSON.parse(readFileSync(requiredEnv("CUSTOMER_E2E_FIXTURE"), "utf8"));
}

test.describe("Expo customer workspace with real API", () => {
  test.skip(
    !process.env.CUSTOMER_E2E_FIXTURE || !process.env.CUSTOMER_E2E_MOBILE_URL,
    "Requires the exported API-mode Expo app and isolated customer fixture",
  );
  for (const { width, height } of [
    { width: 375, height: 667 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 844, height: 390 },
  ]) {
    test(`session, booking recovery, rentals and support at ${width}x${height}`, async ({
      page,
    }) => {
      const f = customerFixture();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setViewportSize({ width, height });
      await page.goto(requiredEnv("CUSTOMER_E2E_MOBILE_URL"));
      await page.getByPlaceholder("customer@example.test").fill(f.email);
      await page.getByPlaceholder("Pass@123456").fill(f.password);
      await page.getByRole("button", { name: "Đăng nhập ngay", exact: true }).click();
      await expect(page.getByRole("heading", { name: M.dashboard, exact: true })).toBeVisible();
      await page.reload();
      await expect(page.getByRole("heading", { name: M.dashboard, exact: true })).toBeVisible();
      await page.getByRole("button", { name: M.bookings, exact: true }).click();
      await page.getByRole("button", { name: M.choose, exact: true }).first().click();
      await expect(page.getByLabel(M.qr)).toBeVisible();
      await page.getByRole("button", { name: M.storage, exact: true }).click();
      await page.getByRole("button", { name: M.choose, exact: true }).first().click();
      await expect(page.getByText(M.documents, { exact: true })).toBeVisible();
      await page.getByRole("button", { name: M.newTicket, exact: true }).first().click();
      await page.getByLabel(M.subject, { exact: true }).fill(`Expo support ${width}`);
      await page.getByLabel(M.content, { exact: true }).fill("Real API mobile support evidence.");
      await page.getByRole("button", { name: M.save, exact: true }).click();
      await expect(
        page.getByRole("heading", { name: `Expo support ${width}`, exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await page.screenshot({
        path: `../../.gitnexus/customer190-expo-${width}.png`,
        fullPage: true,
      });
      expect(errors).toEqual([]);
    });
  }

  test("creates and pays a native-workspace draft, then recovers its confirmed booking", async ({
    page,
  }) => {
    const f = customerFixture();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(requiredEnv("CUSTOMER_E2E_MOBILE_URL"));
    await page.getByPlaceholder("customer@example.test").fill(f.email);
    await page.getByPlaceholder("Pass@123456").fill(f.password);
    await page.getByRole("button", { name: "Đăng nhập ngay", exact: true }).click();
    await expect(page.getByRole("heading", { name: M.dashboard, exact: true })).toBeVisible();
    await page.getByRole("button", { name: M.facility, exact: true }).click();
    await page
      .getByRole("heading", { name: "Flow 5 local", exact: true })
      .locator("..")
      .getByRole("button", { name: M.choose, exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Customer available type", exact: true })
      .locator("..")
      .getByRole("button", { name: M.newBooking, exact: true })
      .click();
    await page.getByLabel(M.checkInDate, { exact: true }).fill(await tomorrowInVietnam(page));
    await page.getByRole("button", { name: /Customer live slot/ }).click();
    await page.getByRole("button", { name: M.choose, exact: true }).click();
    await page.getByLabel(M.contactPhone, { exact: true }).fill("0901234567");
    const sessionResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        /\/api\/bookings\/.+\/pay$/.test(new URL(response.url()).pathname),
    );
    await page.getByRole("button", { name: M.payment, exact: true }).click();
    const response = await sessionResponse;
    expect(response.status()).toBe(201);
    const session = (await response.json()).data;
    await expect(page.getByRole("button", { name: M.openCheckout, exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: M.openCheckout, exact: true })).toBeVisible();
    const apiBase = `${new URL(response.url()).origin}/api`;
    const attempts = (
      await (
        await page.request.get(`${apiBase}/support/contexts/${session.bookingId}/payments`)
      ).json()
    ).data.items;
    const amount = attempts.find((item: { id: string }) => item.id === session.paymentId).amount;
    const webhook = await page.request.post(`${apiBase}/payments/webhooks/sepay`, {
      headers: { "x-secret-key": "customer-live-test-provider-secret" },
      data: {
        notification_type: "ORDER_PAID",
        order: {
          order_invoice_number: session.paymentCode,
          order_status: "CAPTURED",
          order_currency: "VND",
          order_amount: amount,
        },
        transaction: {
          transaction_id: `expo-${Date.now()}`,
          transaction_amount: amount,
          transaction_currency: "VND",
          transaction_status: "APPROVED",
          transaction_type: "PAYMENT",
          transaction_date: new Date(Date.now() + 7 * 3600000)
            .toISOString()
            .slice(0, 19)
            .replace("T", " "),
        },
      },
    });
    expect(webhook.status(), await webhook.text()).toBe(200);
    await expect(page.getByLabel(M.qr)).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: M.booking, exact: true }).click();
    await expect(page.getByLabel(M.qr)).toBeVisible();
  });
});
