// SePay hosted checkout is a signed form POST; the browser leaves for the provider's QR page.
export function submitSepayCheckout(session: {
  checkoutUrl?: string;
  checkoutFormFields?: Record<string, string | number>;
}) {
  if (!session.checkoutUrl || !session.checkoutFormFields) throw new Error("Missing checkout");
  const target = new URL(session.checkoutUrl);
  if (
    target.protocol !== "https:" &&
    !(target.protocol === "http:" && target.hostname === "localhost")
  )
    throw new Error("Untrusted checkout URL");
  const element = document.createElement("form");
  element.method = "POST";
  element.action = target.href;
  for (const [name, value] of Object.entries(session.checkoutFormFields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = String(value);
    element.append(input);
  }
  document.body.append(element);
  element.submit();
  element.remove();
}
