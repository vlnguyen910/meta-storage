import { describe, expect, it } from "bun:test";
import { SepayPaymentGateway } from "../../src/modules/payments/sepay.gateway";

describe("renewal checkout return", () => {
  it("returns to the rental request and preserves the reservation return route", () => {
    const gateway = new SepayPaymentGateway({
      paymentPrefix: "TEST",
      merchantId: "visual-test",
      secretKey: "test-secret",
      env: "sandbox",
      webUrl: "https://example.test",
    });
    const base = {
      paymentId: "payment",
      paymentCode: "TEST123",
      amount: 10000,
      currency: "VND",
      description: "test",
    };
    const renewal = gateway.createCheckoutSession({
      ...base,
      rentalId: "rental",
      renewalId: "renewal",
    });
    const reservation = gateway.createCheckoutSession({ ...base, reservationId: "reservation" });
    for (const key of ["success_url", "error_url", "cancel_url"]) {
      const url = new URL(String(renewal?.formFields[key]));
      expect(url.pathname).toBe("/customer/storage/rental/renew");
      expect(url.searchParams.get("renewalId")).toBe("renewal");
      expect(url.searchParams.get("paymentId")).toBe("payment");
      expect(new URL(String(reservation?.formFields[key])).pathname).toBe(
        "/customer/payments/result",
      );
    }
  });
});
