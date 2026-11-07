import { Suspense } from "react";
import { PaymentResultScreen } from "@/features/reservations/payment-result-screen";

export default function CustomerPaymentResultPage() {
  return (
    <Suspense>
      <PaymentResultScreen />
    </Suspense>
  );
}
