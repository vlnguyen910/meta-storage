"use client";
import { CUSTOMER_WORKSPACE as M } from "@metastorage/shared";
import { useEffect, useState } from "react";
import { CheckoutPostForm } from "./checkout-post-form";
import type { MobileCheckoutBridge } from "./mobile-checkout-bridge.types";

export function MobileCheckoutBridgeScreen() {
  const [checkout, setCheckout] = useState<MobileCheckoutBridge>();
  const [error, setError] = useState(false);
  useEffect(() => {
    try {
      const input = JSON.parse(
        decodeURIComponent(window.location.hash.slice(1)),
      ) as MobileCheckoutBridge;
      const url = new URL(input.checkoutUrl);
      if (
        url.protocol !== "https:" ||
        !["pay.sepay.vn", "sandbox.pay.sepay.vn"].includes(url.hostname) ||
        !/^\/v[0-9]+\/init$/.test(url.pathname) ||
        url.username ||
        url.password ||
        !input.checkoutFormFields ||
        Object.values(input.checkoutFormFields).some(
          (v) => typeof v !== "string" && typeof v !== "number",
        )
      )
        throw new Error();
      setCheckout(input);
      window.history.replaceState(null, "", window.location.pathname);
    } catch {
      setError(true);
    }
  }, []);
  return (
    <main className="mx-auto grid max-w-xl gap-6 p-8">
      <h1 className="text-2xl font-bold">{M.payment}</h1>
      {error ? (
        <p role="alert">{M.error}</p>
      ) : checkout ? (
        <CheckoutPostForm checkoutUrl={checkout.checkoutUrl} fields={checkout.checkoutFormFields} />
      ) : (
        <p role="status">{M.loading}</p>
      )}
    </main>
  );
}
