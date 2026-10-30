import { expect, test } from "bun:test";
import { SepayPaymentGateway } from "../../src/modules/payments/sepay.gateway";

const gateway = new SepayPaymentGateway({
  paymentPrefix: "TEST",
  merchantId: "local-test",
  secretKey: "local-test-only",
  webUrl: "http://localhost:3000/",
});
const input = {
  paymentId: "00000000-0000-4000-8000-000000000001",
  reservationId: "00000000-0000-4000-8000-000000000002",
  paymentCode: "TEST123",
  amount: 2000000,
  currency: "VND",
  description: "Storage reservation",
};

test("signed checkout returns success, error and cancellation to the existing Web page", () => {
  const session = gateway.createCheckoutSession(input);
  expect(session).not.toBeNull();
  for (const status of ["success", "error", "cancel"]) {
    const url = new URL(String(session?.formFields[`${status}_url`]));
    expect(url.origin).toBe("http://localhost:3000");
    expect(url.pathname).toBe("/customer/payments/result");
    expect(url.searchParams.get("paymentId")).toBe(input.paymentId);
    expect(url.searchParams.get("reservationId")).toBe(input.reservationId);
    expect(url.searchParams.get("status")).toBe(status);
    expect(url.searchParams.has("bookingId")).toBe(false);
  }
});
