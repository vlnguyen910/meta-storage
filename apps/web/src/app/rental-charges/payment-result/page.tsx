import { Suspense } from "react";
import { ChargePaymentResult } from "@/features/rentals/charge-payment-result";
export default function Page() {
  return (
    <Suspense>
      <ChargePaymentResult />
    </Suspense>
  );
}
