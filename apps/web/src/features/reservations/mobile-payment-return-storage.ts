import { mobilePaymentReturnKey, parseMobilePaymentReturn } from "@metastorage/shared";

// The URL is navigation data, never a credential. Keep it across tabs on the same origin.
export function saveMobilePaymentReturn(url: string) {
  const parsed = parseMobilePaymentReturn(url);
  if (!parsed) return false;
  for (const name of ["sessionStorage", "localStorage"] as const) {
    try {
      window[name].setItem(mobilePaymentReturnKey(parsed.paymentId), url);
    } catch {
      // Browser privacy settings may disable either store; returning to the app still works.
    }
  }
  return true;
}

export function readMobilePaymentReturn(paymentId: string, reservationId?: string | null) {
  for (const name of ["sessionStorage", "localStorage"] as const) {
    try {
      const url = window[name].getItem(mobilePaymentReturnKey(paymentId));
      const parsed = parseMobilePaymentReturn(url);
      if (
        parsed?.paymentId === paymentId &&
        (!reservationId || parsed.reservationId === reservationId)
      )
        return url ?? undefined;
    } catch {
      // Try the other store. A missing link must not prevent web sign-in or native recovery.
    }
  }
  return undefined;
}
