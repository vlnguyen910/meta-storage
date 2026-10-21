import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { selectCheckInDate } from "../e2e/support/reservation-form";
import { checkoutMessages as m } from "../src/features/reservations/checkout.messages";
import { paymentResultMessages as resultMessages } from "../src/features/reservations/payment-result.messages";

const facilityId = "12000000-0000-4000-8000-000000000001";
const unitTypeId = "12000000-0000-4000-8000-000000000002";
const slotId = "12000000-0000-4000-8000-000000000003";
const api = "http://127.0.0.1:4000/api";

async function openPayment(page: Page, typeId = unitTypeId) {
  await page.goto(`/reservations/new?facilityId=${facilityId}&unitTypeId=${typeId}&new=1`);
  await expect(page.getByRole("button", { name: m.nextContact })).toBeEnabled();
  await page.getByRole("button", { name: m.nextContact }).click();
  await page.getByLabel(m.fullName, { exact: true }).fill("Flow 1 Guest");
  await page.getByLabel(m.phone, { exact: true }).fill("0901234567");
  await page.getByLabel(m.email, { exact: true }).fill("flow1-guest@example.test");
  await selectCheckInDate(page, "2030-01-01");
  await page.locator(`input[name="checkInSlotId"][value="${slotId}"]`).check();
  await page.getByRole("button", { name: m.review, exact: true }).click();
  await page.getByRole("button", { name: m.checkout, exact: true }).click();
}

async function checkout(page: Page) {
  await openPayment(page);
  const response = page.waitForResponse(
    (r) => r.url().endsWith("/pay") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: m.checkout, exact: true }).click();
  const result = await response;
  expect(result.status()).toBe(201);
  const payment = (await result.json()).data;
  return payment as {
    bookingId: string;
    paymentId: string;
    paymentCode: string;
    expiresAt: string;
  };
}

async function providerCallback(
  page: Page,
  code: string,
  checkout?: { paymentId: string; token: string },
) {
  const response = await page.request.post(`http://127.0.0.1:4000/__test/sepay/orders/${code}`);
  expect(response.status()).toBe(200);
  if (checkout)
    await expect
      .poll(
        async () => {
          const status = await page.request.get(`${api}/payments/${checkout.paymentId}/status`, {
            headers: { "x-booking-access-token": checkout.token },
          });
          return (await status.json()).data.status;
        },
        { intervals: [2000] },
      )
      .toBe("SUCCEEDED");
}

test("guest checks out through real API, return reconciles without IPN, manager assigns the same booking", async ({
  page,
}, testInfo) => {
  const forbidden: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (
      url.startsWith(api) &&
      /\/reservations\/|confirm-sandbox|\/catalog\/|webhooks\/sepay|sepay\/ipn/.test(url)
    )
      forbidden.push(url);
  });
  const payment = await checkout(page);
  await expect(page.getByRole("heading", { name: m.successful })).toHaveCount(0);
  const context = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("metastorage.booking-checkout") ?? "null"),
  );
  expect(context.draft.id).toBe(payment.bookingId);
  expect(context.draft.pricing.totalAmount).toBe("2000000");
  expect(context).not.toHaveProperty("contact");
  await page.goto(
    `/bookings/payment-result?status=success&paymentId=${payment.paymentId}&bookingId=${payment.bookingId}`,
  );
  await expect(page.getByRole("status")).toHaveText(resultMessages.pending);
  await page.reload();
  await expect(page.getByRole("status")).toHaveText(resultMessages.pending);
  await providerCallback(page, payment.paymentCode);
  await expect(page.getByRole("heading", { name: m.successful })).toBeVisible();
  await expect(page.getByRole("img", { name: m.qrTitle })).toBeVisible();
  expect(new URL(page.url()).searchParams.has("draftAccessToken")).toBe(false);
  const violations = await new AxeBuilder({ page }).analyze();
  expect(violations.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("confirmation.png"), fullPage: true });
  await page.goto("/login");
  await page.getByRole("textbox", { name: /email/i }).fill("flow1-manager@example.test");
  await page
    .getByLabel(/mật khẩu/i)
    .first()
    .fill("Flow1-browser-test-123!");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/facility-manager/);
  await page.goto(`/facility-manager/check-in?view=assign&bookingId=${payment.bookingId}`);
  await expect(page.getByText("Flow 1 Guest", { exact: true })).toBeVisible();
  const unit = page.locator('input[type="radio"]:not(:disabled)').first();
  await unit.check();
  const chosenCode = await unit.getAttribute("aria-label");
  const eligible = (
    await (await page.request.get(`${api}/bookings/${payment.bookingId}/eligible-units`)).json()
  ).data;
  const chosenUnitId = eligible.find(
    (candidate: { id: string; code: string }) => candidate.code === chosenCode,
  ).id;
  // Another booking takes the unit after the manager has loaded the choices.
  const competingDraft = (
    await (
      await page.request.post(`${api}/bookings/drafts`, {
        data: {
          facilityId,
          unitTypeId,
          checkInDate: "2030-01-01",
          checkInSlotId: slotId,
          durationMonths: 1,
        },
      })
    ).json()
  ).data;
  const competingPaymentResponse = await page.request.post(
    `${api}/bookings/${competingDraft.id}/pay`,
    {
      data: {
        draftAccessToken: competingDraft.draftAccessToken,
        idempotencyKey: crypto.randomUUID(),
        contact: {
          fullName: "Assignment competitor",
          email: "flow1-assignment@example.test",
          phone: "+84901234567",
        },
      },
    },
  );
  expect(competingPaymentResponse.status()).toBe(201);
  await providerCallback(page, (await competingPaymentResponse.json()).data.paymentCode, {
    paymentId: (await competingPaymentResponse.json()).data.paymentId,
    token: competingDraft.draftAccessToken,
  });
  const competingAssignment = await page.request.post(
    `${api}/bookings/${competingDraft.id}/assign-unit`,
    { data: { physicalUnitId: chosenUnitId } },
  );
  expect(competingAssignment.status()).toBe(200);
  const conflict = page.waitForResponse(
    (r) => r.url().endsWith("/assign-unit") && [400, 409].includes(r.status()),
  );
  await page
    .getByRole("button", { name: /xác nhận|gán kho|gán unit/i })
    .last()
    .click();
  await conflict;
  await expect(page.getByRole("alert").filter({ hasText: /.+/ }).first()).toBeVisible();
  await page.locator('input[type="radio"]:not(:disabled)').first().check();
  const assignment = page.waitForResponse(
    (r) => r.url().endsWith("/assign-unit") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: /xác nhận|gán kho|gán unit/i })
    .last()
    .click();
  expect((await assignment).status()).toBe(200);
  await expect(page).toHaveURL(/facility-manager\/dashboard/);
  expect(forbidden).toEqual([]);
});

test("a return URL alone cannot authorize payment status or display confirmation", async ({
  page,
}) => {
  await page.goto(
    "/bookings/payment-result?status=success&paymentId=12000000-0000-4000-8000-000000000099",
  );
  await expect(page.getByRole("status")).toHaveText(resultMessages.accessRequired);
  await expect(page.getByRole("heading", { name: m.successful })).toHaveCount(0);
});

test("contact validation is accessible and does not start payment or hold capacity", async ({
  page,
}, testInfo) => {
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.url().startsWith(api) && request.method() === "POST") writes.push(request.url());
  });
  await page.goto(`/reservations/new?facilityId=${facilityId}&unitTypeId=${unitTypeId}&new=1`);
  await page.getByRole("button", { name: m.nextContact }).click();
  await page.getByRole("button", { name: m.review, exact: true }).click();
  await expect(page.getByLabel(m.fullName, { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(writes).toEqual([]);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("contact-validation.png"), fullPage: true });
});

test("lost payment response retries the same server payment and checkout survives refresh", async ({
  page,
}) => {
  await openPayment(page);
  let originalPaymentId = "";
  await page.route("**/bookings/*/pay", async (route) => {
    const response = await route.fetch();
    expect(response.status()).toBe(201);
    originalPaymentId = (await response.json()).data.paymentId;
    await route.abort("failed");
  });
  await page.getByRole("button", { name: m.checkout, exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: m.paymentFailed })).toBeVisible();
  await page.unroute("**/bookings/*/pay");
  const retry = page.waitForResponse((r) => r.url().endsWith("/pay"));
  await page.getByRole("button", { name: m.checkout, exact: true }).click();
  expect((await (await retry).json()).data.paymentId).toBe(originalPaymentId);
  await page.reload();
  await expect(page.getByRole("heading", { name: m.waitingPayment })).toBeVisible();
  await expect(page.getByRole("heading", { name: m.successful })).toHaveCount(0);
});

test("client hold countdown expiry never confirms or fails a payment on its own", async ({
  page,
}) => {
  const payment = await checkout(page);
  await page.goto(
    `/bookings/payment-result?paymentId=${payment.paymentId}&bookingId=${payment.bookingId}`,
  );
  await page.clock.install();
  await page.clock.fastForward(11 * 60 * 1000);
  await expect(page.getByRole("status")).toHaveText(resultMessages.expired);
  await expect(page.getByRole("heading", { name: m.successful })).toHaveCount(0);
});

test("capacity lost after review is rejected by real start-payment and the form can recover", async ({
  page,
}) => {
  const scarce = "12000000-0000-4000-8000-000000000005";
  await openPayment(page, scarce);
  const draftResponse = await page.request.post(`${api}/bookings/drafts`, {
    data: {
      facilityId,
      unitTypeId: scarce,
      checkInDate: "2030-01-01",
      checkInSlotId: slotId,
      durationMonths: 1,
    },
  });
  expect(draftResponse.status()).toBe(201);
  const draft = (await draftResponse.json()).data;
  const competing = await page.request.post(`${api}/bookings/${draft.id}/pay`, {
    data: {
      draftAccessToken: draft.draftAccessToken,
      idempotencyKey: crypto.randomUUID(),
      contact: {
        fullName: "Competing guest",
        email: "flow1-competitor@example.test",
        phone: "+84901234567",
      },
    },
  });
  expect(competing.status()).toBe(201);
  const payment = (await competing.json()).data;
  try {
    const rejected = page.waitForResponse((r) => r.url().endsWith("/pay") && r.status() === 409);
    await page.getByRole("button", { name: m.checkout, exact: true }).click();
    await rejected;
    await expect(page.getByRole("alert").filter({ hasText: m.paymentFailed })).toBeVisible();
    await page.getByRole("button", { name: m.back, exact: true }).click();
    await expect(page.getByRole("heading", { name: m.reviewTitle })).toBeVisible();
  } finally {
    await providerCallback(page, payment.paymentCode, {
      paymentId: payment.paymentId,
      token: draft.draftAccessToken,
    });
    const cancelled = await page.request.post(`${api}/bookings/${draft.id}/cancel`, {
      headers: { "x-booking-access-token": draft.draftAccessToken },
    });
    expect(cancelled.status()).toBe(200);
  }
});
