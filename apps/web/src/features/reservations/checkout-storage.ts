import { authStore } from "@/features/auth/auth-store";
import type { CheckoutContext } from "./booking-checkout.types";

const key = () =>
  `metastorage.booking-checkout:${authStore.getState().session?.user.id ?? "anonymous"}`;

export function clearCheckoutContext() {
  sessionStorage.removeItem(key());
}

export function readCheckoutContext(): CheckoutContext | null {
  if (typeof window === "undefined") return null;
  try {
    const context = JSON.parse(sessionStorage.getItem(key()) ?? "null") as CheckoutContext | null;
    return context?.draft?.id && context.idempotencyKey ? context : null;
  } catch {
    return null;
  }
}

export function saveCheckoutContext(context: CheckoutContext) {
  // Required before leaving this tab for SePay. Surface storage failures to the
  // checkout so a guest is never redirected without a return credential.
  sessionStorage.setItem(key(), JSON.stringify(context));
}
