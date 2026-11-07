import { authStore } from "@/features/auth/auth-store";
import type { CheckoutContext } from "./booking-checkout.types";

const key = () =>
  `metastorage.reservation-checkout:v2:${authStore.getState().session?.user.id ?? "anonymous"}`;

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
  // Persist before leaving this tab so payment and appointment retries keep the same context.
  sessionStorage.setItem(key(), JSON.stringify(context));
}
