import { Suspense } from "react";
import { PaymentResultScreen } from "@/features/reservations/payment-result-screen";

export default function BookingPaymentResultPage() {
  return (
    <Suspense>
      <PaymentResultScreen />
    </Suspense>
  );
}
