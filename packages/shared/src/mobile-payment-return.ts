export function parseMobilePaymentReturn(value: string | null) {
  if (!value) return null;
  try {
    const scheme = /^(metastorage|exp|exps):\/\//.exec(value)?.[1];
    if (!scheme) return null;
    // Older Android browsers treat custom schemes as opaque paths with no hostname.
    // Parse their authority and query through the consistent HTTPS URL parser.
    const url = new URL(value.replace(/^[^:]+:/, "https:"));
    const native =
      scheme === "metastorage" && url.hostname === "payment-result" && url.pathname === "/";
    const expo = ["exp", "exps"].includes(scheme) && url.pathname === "/--/payment-result";
    if ((!native && !expo) || url.username || url.password || url.hash) return null;
    const paymentId = url.searchParams.get("paymentId");
    const reservationId = url.searchParams.get("reservationId");
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!paymentId || !uuid.test(paymentId) || (reservationId && !uuid.test(reservationId)))
      return null;
    return { paymentId, reservationId: reservationId || undefined };
  } catch {
    return null;
  }
}

export function mobilePaymentReturnKey(paymentId: string) {
  return `metastorage.mobile-payment-return:${paymentId}`;
}
