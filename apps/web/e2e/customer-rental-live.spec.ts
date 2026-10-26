import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { CUSTOMER_WORKSPACE as M } from "@metastorage/shared";
import { expect as baseExpect, test } from "@playwright/test";

const expect = baseExpect.configure({ timeout: 20000 });
const providerTimestamp = () =>
  new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 19).replace("T", " ");

import type { CustomerLiveFixture } from "./support/customer-live.types";
import { selectCheckInDate, tomorrowInVietnam } from "./support/reservation-form";

test.describe("Customer rental flow against isolated real API", () => {
  test.skip(
    !process.env.CUSTOMER_E2E_FIXTURE,
    "Run with the isolated customer-rental-live-server fixture",
  );
  test.describe.configure({ mode: "serial" });
  test.use({ timezoneId: "America/Los_Angeles" });
  test.setTimeout(120000);
  let f: CustomerLiveFixture;
  test.beforeAll(() => {
    f = JSON.parse(readFileSync(process.env.CUSTOMER_E2E_FIXTURE!, "utf8"));
  });
  test.beforeEach(async ({ page }) => {
    const response = await page.request.post("/api/auth/sign-in/email", {
      data: { email: f.email, password: f.password },
    });
    expect(response.status(), await response.text()).toBe(200);
  });

  for (const width of [375, 1440]) {
    test(`booking recovery, multiple rentals and support conversation at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      const legacy: string[] = [];
      page.on("request", (request) => {
        if (new URL(request.url()).pathname.startsWith("/api/reservations"))
          legacy.push(request.url());
      });
      await page.goto("/customer/dashboard");
      await expect(page.getByRole("heading", { name: M.dashboard, exact: true })).toBeVisible();
      await expect(page.getByText("Qua thanh toán demo")).toHaveCount(0);
      await page.goto(`/customer/reservations/${f.bookingIds[0]}`);
      await expect(page.getByRole("img", { name: M.qr })).toBeVisible();
      await expect(page.locator("main p").filter({ hasText: M.appointment })).toContainText(
        "09:00",
      );
      await page.getByRole("link", { name: M.viewRental }).click();
      await expect(page).toHaveURL(new RegExp(`/customer/storage/${f.rentalIds[0]}`), {
        timeout: 20000,
      });
      await expect(page.getByRole("heading", { name: M.renewal, exact: true })).toBeVisible();
      await page.goto("/customer/storage");
      await expect(page.getByText("LIVE-CUSTOMER-1", { exact: true })).toBeVisible();
      await expect(page.getByText("LIVE-CUSTOMER-2", { exact: true })).toBeVisible();
      await page.goto("/customer/support/new");
      await page
        .getByRole("combobox", { name: M.booking, exact: true })
        .selectOption(f.failedBookingId);
      await page
        .getByRole("combobox", { name: M.optionalPayment, exact: true })
        .selectOption(f.failedPaymentId);
      await page.getByLabel(M.subject).fill(`Payment evidence ${width}`);
      await page
        .getByLabel(M.content, { exact: true })
        .fill("Please check this failed pre-handover payment.");
      await page.getByRole("button", { name: M.save, exact: true }).click();
      await expect(page).toHaveURL(/\/customer\/support\/[0-9a-f-]+$/);
      await expect(
        page.getByText("Please check this failed pre-handover payment.", { exact: true }),
      ).toBeVisible();
      await page.getByLabel(M.content, { exact: true }).fill("Additional customer evidence.");
      await page.getByRole("button", { name: M.reply, exact: true }).click();
      await expect(page.getByText("Additional customer evidence.", { exact: true })).toBeVisible();
      await page.getByLabel(M.chooseImage, { exact: true }).setInputFiles({
        name: "unit.png",
        mimeType: "image/png",
        buffer: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jPrsAAAAASUVORK5CYII=",
          "base64",
        ),
      });
      await page.getByRole("button", { name: M.image, exact: true }).first().click();
      await expect(page.getByRole("img", { name: "unit.png" })).toBeVisible();
      const violations = (await new AxeBuilder({ page }).analyze()).violations;
      expect(violations.map((v) => ({ id: v.id, nodes: v.nodes.length }))).toEqual([]);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await page.screenshot({
        path: `../../.gitnexus/customer190-support-${width}.png`,
        fullPage: true,
      });
      await page.reload();
      await expect(page.getByText("Additional customer evidence.", { exact: true })).toBeVisible();
      expect(legacy).toEqual([]);
    });
  }

  test("renewal quote/accept/payment applies once through the real webhook", async ({ page }) => {
    await page.goto(`/customer/storage/${f.rentalIds[0]}`);
    await page.getByRole("button", { name: M.quote, exact: true }).click();
    await expect(page).toHaveURL(/renewalId=/);
    await page.getByRole("button", { name: M.accept, exact: true }).click();
    const paymentResponse = page.waitForResponse(
      (r) =>
        r.request().method() === "POST" &&
        /\/api\/rental-charges\/.+\/payments$/.test(new URL(r.url()).pathname),
    );
    await page.getByRole("button", { name: M.payment, exact: true }).first().click();
    const response = await paymentResponse;
    expect(response.status(), await response.text()).toBe(201);
    const payment = (await response.json()).data;
    const renewalId = new URL(page.url()).searchParams.get("renewalId");
    const quote = (await (await page.request.get(`/api/rental-renewals/${renewalId}`)).json()).data;
    const event = {
      notification_type: "ORDER_PAID",
      order: {
        order_invoice_number: payment.paymentCode,
        order_status: "CAPTURED",
        order_currency: "VND",
        order_amount: quote.amount,
      },
      transaction: {
        transaction_id: `live-${Date.now()}`,
        transaction_amount: quote.amount,
        transaction_currency: "VND",
        transaction_status: "APPROVED",
        transaction_type: "PAYMENT",
        transaction_date: providerTimestamp(),
      },
    };
    for (let i = 0; i < 2; i++) {
      const webhook = await page.request.post("/api/payments/webhooks/sepay", {
        headers: { "x-secret-key": "customer-live-test-provider-secret" },
        data: event,
      });
      expect(webhook.status(), await webhook.text()).toBe(200);
    }
    await expect(page.getByText(M.renewalApplied, { exact: true })).toBeVisible({ timeout: 15000 });
    const rental = (await (await page.request.get(`/api/rentals/${f.rentalIds[0]}`)).json()).data;
    expect(rental.expectedEndAt).toBe(quote.newEndAt);
    await page.reload();
    await expect(page.getByText(M.renewalApplied, { exact: true })).toBeVisible();
  });

  test("catalog period lookup and checkout survive pending return and confirmed refresh", async ({
    page,
  }) => {
    await page.goto(
      `/customer/reservations/new?facilityId=${f.facilityId}&unitTypeId=${f.typeId}&new=1`,
    );
    await expect(page.locator('article[data-selected="true"]')).toHaveCount(1);
    await page.getByRole("button", { name: "Tiếp tục: Thông tin người thuê" }).click();
    await expect(page.getByLabel("Họ và tên", { exact: true })).toHaveValue("customer");
    await expect(page.getByLabel("Địa chỉ email", { exact: true })).toHaveValue(f.email);
    await page.getByLabel("Số điện thoại", { exact: true }).fill("0901234567");
    await selectCheckInDate(page, await tomorrowInVietnam(page));
    await page.locator('input[name="checkInSlotId"]').first().check();
    await page.getByRole("button", { name: "Xem đơn thuê", exact: true }).click();
    await page.getByRole("button", { name: "Thanh toán", exact: true }).click();
    const sessionResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        /\/api\/bookings\/.+\/pay$/.test(new URL(response.url()).pathname),
    );
    await page.getByRole("button", { name: "Thanh toán", exact: true }).click();
    const response = await sessionResponse;
    expect(response.status(), await response.text()).toBe(201);
    const session = (await response.json()).data;
    await page.goto(
      `/bookings/payment-result?paymentId=${session.paymentId}&bookingId=${session.bookingId}&status=success`,
    );
    await expect(page.getByRole("link", { name: M.openApp, exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Kiểm tra lại", exact: true })).toBeEnabled();
    await expect(page.getByText("Đặt thuê kho thành công!", { exact: true })).toHaveCount(0);
    const detail = (
      await (await page.request.get(`/api/support/contexts/${session.bookingId}/payments`)).json()
    ).data.items.find((p: { id: string }) => p.id === session.paymentId);
    const webhook = await page.request.post("/api/payments/webhooks/sepay", {
      headers: { "x-secret-key": "customer-live-test-provider-secret" },
      data: {
        notification_type: "ORDER_PAID",
        order: {
          order_invoice_number: session.paymentCode,
          order_status: "CAPTURED",
          order_currency: "VND",
          order_amount: detail.amount,
        },
        transaction: {
          transaction_id: `initial-${Date.now()}`,
          transaction_amount: detail.amount,
          transaction_currency: "VND",
          transaction_status: "APPROVED",
          transaction_type: "PAYMENT",
          transaction_date: providerTimestamp(),
        },
      },
    });
    expect(webhook.status(), await webhook.text()).toBe(200);
    await expect(
      page.getByRole("heading", { name: "Đặt thuê kho thành công!", exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: M.booking, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/customer/reservations/${session.bookingId}`));
    await page.reload();
    await expect(page.getByRole("img", { name: M.qr })).toBeVisible();
  });

  test("customer pays one approved extra and disputes another without creating obligations", async ({
    page,
    playwright,
  }) => {
    const staff = await playwright.request.newContext({ baseURL: new URL(f.api).origin });
    const manager = await playwright.request.newContext({ baseURL: new URL(f.api).origin });
    try {
      for (const [context, email] of [
        [staff, f.staffEmail],
        [manager, f.managerEmail],
      ] as const)
        expect(
          (
            await context.post("/api/auth/sign-in/email", {
              data: { email, password: f.password },
            })
          ).status(),
        ).toBe(200);
      const charges: Array<{ id: string; evidence: string }> = [];
      for (const evidence of ["Live charge to pay", "Live charge to dispute"]) {
        const created = await staff.post(`/api/rentals/${f.rentalIds[0]}/charges`, {
          data: { category: "CLEANING", amount: 25000, evidence, dueDate: "2034-01-01" },
        });
        expect(created.status(), await created.text()).toBe(201);
        const charge = (await created.json()).data;
        charges.push(charge);
        expect(
          (
            await manager.post(`/api/rental-charges/${charge.id}/decision`, {
              data: { decision: "APPROVE", reason: "Live fixture evidence verified" },
            })
          ).status(),
        ).toBe(200);
      }
      await page.goto(`/customer/storage/${f.rentalIds[0]}`);
      const disputed = page.locator("article").filter({ hasText: "Live charge to dispute" });
      await disputed.getByLabel(M.reason).fill("Please review this cleaning charge.");
      await disputed.getByRole("button", { name: M.dispute, exact: true }).click();
      await expect(disputed.getByText(/DISPUTED/)).toBeVisible();
      const payable = page.locator("article").filter({ hasText: "Live charge to pay" });
      const firstCharge = charges[0];
      if (!firstCharge) throw new Error("Missing test charge");
      const sessionResponse = page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          response.url().endsWith(`/rental-charges/${firstCharge.id}/payments`),
      );
      await payable.getByRole("button", { name: M.payment, exact: true }).click();
      const response = await sessionResponse;
      expect(response.status(), await response.text()).toBe(201);
      const payment = (await response.json()).data;
      const webhook = await page.request.post("/api/payments/webhooks/sepay", {
        headers: { "x-secret-key": "customer-live-test-provider-secret" },
        data: {
          notification_type: "ORDER_PAID",
          order: {
            order_invoice_number: payment.paymentCode,
            order_status: "CAPTURED",
            order_currency: "VND",
            order_amount: 25000,
          },
          transaction: {
            transaction_id: `extra-${Date.now()}`,
            transaction_amount: 25000,
            transaction_currency: "VND",
            transaction_status: "APPROVED",
            transaction_type: "PAYMENT",
            transaction_date: providerTimestamp(),
          },
        },
      });
      expect(webhook.status(), await webhook.text()).toBe(200);
      await expect(payable.getByText(/PAID/)).toBeVisible();
      const history = (
        await (await page.request.get(`/api/rentals/${f.rentalIds[0]}/payments`)).json()
      ).data;
      expect(history.filter((p: { id: string }) => p.id === payment.paymentId)).toHaveLength(1);
      expect(history.find((p: { id: string }) => p.id === payment.paymentId).source).toBe("EXTRA");
    } finally {
      await staff.dispose();
      await manager.dispose();
    }
  });

  for (const category of ["UNIT", "LOCK", "ACCESS_CODE", "STORED_ITEMS"] as const) {
    test(`creates ${category} support after actual handover`, async ({ page }) => {
      await page.goto("/customer/support/new");
      await page.getByLabel(M.category).selectOption(category);
      await page
        .getByRole("combobox", { name: M.booking, exact: true })
        .selectOption(f.bookingIds[0]);
      await page.getByLabel(M.subject).fill(`Support ${category}`);
      await page
        .getByLabel(M.content, { exact: true })
        .fill("Customer request linked to a handed-over rental.");
      await page.getByRole("button", { name: M.save, exact: true }).click();
      await expect(
        page.getByRole("heading", { name: `Support ${category}`, exact: true }),
      ).toBeVisible();
    });
  }

  test("private ticket and PDF cannot be read with another customer's session", async ({
    request,
    playwright,
  }) => {
    await request.post("/api/auth/sign-in/email", {
      data: { email: f.email, password: f.password },
    });
    const owned = await request.get(
      `/api/bookings/${f.bookingIds[0]}/contracts/${f.contractId}/pdf`,
    );
    expect(owned.status()).toBe(200);
    expect(owned.headers()["content-type"]).toContain("application/pdf");
    const tickets = (await (await request.get("/api/support/tickets")).json()).data.items;
    let ticketId: string | undefined;
    let imageId: string | undefined;
    for (const ticket of tickets) {
      const messages = (
        await (await request.get(`/api/support/tickets/${ticket.id}/messages`)).json()
      ).data.items;
      const image = messages.flatMap(
        (m: { attachments: Array<{ id: string }> }) => m.attachments,
      )[0];
      if (image) {
        ticketId = ticket.id;
        imageId = image.id;
        break;
      }
    }
    expect(ticketId).toBeTruthy();
    expect(imageId).toBeTruthy();
    const other = await playwright.request.newContext({ baseURL: new URL(f.api).origin });
    try {
      const login = await other.post("/api/auth/sign-in/email", {
        data: { email: f.otherEmail, password: f.password },
      });
      expect(login.status(), await login.text()).toBe(200);
      expect((await other.get(`/api/support/tickets/${ticketId}`)).status()).toBe(404);
      expect(
        (await other.get(`/api/support/tickets/${ticketId}/attachments/${imageId}`)).status(),
      ).toBe(404);
      expect((await other.get(`/api/rentals/${f.rentalIds[0]}`)).status()).toBe(404);
      expect(
        (
          await other.get(`/api/bookings/${f.bookingIds[0]}/contracts/${f.contractId}/pdf`)
        ).status(),
      ).toBe(404);
    } finally {
      await other.dispose();
    }
  });
});
