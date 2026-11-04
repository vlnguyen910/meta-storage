import { CUSTOMER_WORKSPACE as M, mobilePaymentReturnKey } from "@metastorage/shared";
import { render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, expect, it } from "vitest";
import { MobileCheckoutBridgeScreen } from "./mobile-checkout-bridge";

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

it("preserves the mobile return URL in this browser tab before submitting to SePay", () => {
  const paymentId = "00000000-0000-4000-8000-000000000001";
  const returnUrl = `exp://192.168.20.25:8081/--/payment-result?paymentId=${paymentId}`;
  window.location.hash = encodeURIComponent(
    JSON.stringify({
      checkoutUrl: "https://pay-sandbox.sepay.vn/v1/checkout/init",
      checkoutFormFields: { order_invoice_number: "test-payment" },
      returnUrl,
    }),
  );
  render(
    <StrictMode>
      <MobileCheckoutBridgeScreen />
    </StrictMode>,
  );
  expect(screen.getByRole("button", { name: M.openCheckout })).toBeTruthy();
  expect(sessionStorage.getItem(mobilePaymentReturnKey(paymentId))).toBe(returnUrl);
});

it.each(["pay-sandbox.sepay.vn", "pay.sepay.vn"])(
  "opens SDK checkout URL for %s despite React effect replay",
  (host) => {
    const checkoutUrl = `https://${host}/v1/checkout/init`;
    window.location.hash = encodeURIComponent(
      JSON.stringify({
        checkoutUrl,
        checkoutFormFields: { order_invoice_number: "test-payment", order_amount: 900000 },
      }),
    );
    render(
      <StrictMode>
        <MobileCheckoutBridgeScreen />
      </StrictMode>,
    );
    const button = screen.getByRole("button", { name: M.openCheckout });
    expect(button.closest("form")?.getAttribute("action")).toBe(checkoutUrl);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(window.location.hash).toBe("");
  },
);

it("rejects missing checkout data", () => {
  render(
    <StrictMode>
      <MobileCheckoutBridgeScreen />
    </StrictMode>,
  );
  expect(screen.getByRole("alert").textContent).toBe(M.error);
  expect(screen.queryByRole("button", { name: M.openCheckout })).toBeNull();
});

it.each([
  "https://example.com/v1/checkout/init",
  "https://pay-sandbox.sepay.vn.attacker.test/v1/checkout/init",
  "http://pay-sandbox.sepay.vn/v1/checkout/init",
  "https://pay-sandbox.sepay.vn/v1/init",
  "https://user:password@pay-sandbox.sepay.vn/v1/checkout/init",
])("rejects invalid checkout destination %s", (checkoutUrl) => {
  window.location.hash = encodeURIComponent(
    JSON.stringify({
      checkoutUrl,
      checkoutFormFields: { order_invoice_number: "test-payment" },
    }),
  );
  render(
    <StrictMode>
      <MobileCheckoutBridgeScreen />
    </StrictMode>,
  );
  expect(screen.getByRole("alert").textContent).toBe(M.error);
});
