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
    expect(url.pathname).toBe("/bookings/payment-result");
    expect(url.searchParams.get("paymentId")).toBe(input.paymentId);
    expect(url.searchParams.get("reservationId")).toBe(input.reservationId);
    expect(url.searchParams.get("status")).toBe(status);
    expect(url.searchParams.has("bookingId")).toBe(false);
  }
});

const multiOriginGateway = new SepayPaymentGateway({
  paymentPrefix: "TEST",
  merchantId: "local-test",
  secretKey: "local-test-only",
  webUrl: "http://192.168.20.25:3000",
  trustedWebOrigins: ["http://localhost:3000", "http://192.168.20.25:3000", "metastorage://"],
});

test.each(["http://localhost:3000", "http://192.168.20.25:3000"])(
  "signed checkout preserves the initiating trusted web origin: %s",
  (requestOrigin) => {
    const session = multiOriginGateway.createCheckoutSession({ ...input, requestOrigin });
    for (const status of ["success", "error", "cancel"]) {
      const url = new URL(String(session?.formFields[`${status}_url`]));
      expect(url.origin).toBe(requestOrigin);
      expect(url.searchParams.get("paymentId")).toBe(input.paymentId);
      expect(url.searchParams.get("reservationId")).toBe(input.reservationId);
    }
    expect(session?.formFields.signature).toBeTruthy();
  },
);

test.each([
  undefined,
  "metastorage://",
  "exp://192.168.20.25:8081",
  "https://untrusted.example",
  "http://localhost:3000.evil.example",
  "http://localhost:3000/redirect",
  "null",
])("native or untrusted origin uses the configured callback: %s", (requestOrigin) => {
  const session = multiOriginGateway.createCheckoutSession({ ...input, requestOrigin });
  for (const status of ["success", "error", "cancel"]) {
    expect(new URL(String(session?.formFields[`${status}_url`])).origin).toBe(
      "http://192.168.20.25:3000",
    );
  }
});
