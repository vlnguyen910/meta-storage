export type CustomerSignupCallbackTarget = "web" | "mobile";

export function getCustomerSignupCallbackUrl(
  target: CustomerSignupCallbackTarget,
  trustedOrigins: string[],
): string | undefined {
  if (target === "mobile") return "metastorage://auth/verified";

  const trustedWebOrigin = trustedOrigins.find((origin) => {
    try {
      const url = new URL(origin);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  });

  return trustedWebOrigin ? new URL("/verify-email", trustedWebOrigin).toString() : undefined;
}
