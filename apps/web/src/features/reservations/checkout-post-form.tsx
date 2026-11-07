"use client";
import { CUSTOMER_WORKSPACE as M } from "@metastorage/shared";
import { Button } from "@/components/ui/button";
export function CheckoutPostForm({
  checkoutUrl,
  fields,
}: {
  checkoutUrl: string;
  fields: Record<string, string | number>;
}) {
  return (
    <form action={checkoutUrl} method="POST">
      {Object.entries(fields).map(([name, value]) => (
        <input type="hidden" name={name} value={value} key={name} />
      ))}
      <Button>{M.openCheckout}</Button>
    </form>
  );
}
