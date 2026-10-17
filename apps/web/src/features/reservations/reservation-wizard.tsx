"use client";
import { ErrorState, LoadingState } from "@/components/ui/states";
import fontStyles from "@/features/facilities/metastorage-fonts.module.css";
import { checkoutMessages as m } from "./checkout.messages";
import s from "./checkout.module.css";
import { CheckoutConfirmation } from "./checkout-confirmation";
import { CheckoutContact } from "./checkout-contact";
import { CheckoutProgress } from "./checkout-parts";
import { CheckoutPayment } from "./checkout-payment";
import { CheckoutReview } from "./checkout-review";
import { CheckoutSelection } from "./checkout-selection";
import { useReservationCheckout } from "./use-reservation-checkout";

export function ReservationWizard() {
  const state = useReservationCheckout();
  if (state.facilitiesQuery.isLoading) return <LoadingState label={m.loading} />;
  if (state.facilitiesQuery.isError)
    return <ErrorState message={m.facilityError} onRetry={() => state.facilitiesQuery.refetch()} />;
  return (
    <div className={`${s.checkout} ${fontStyles.page}`}>
      <CheckoutProgress step={state.step} />
      {state.step === 0 ? <CheckoutSelection state={state} /> : null}
      {state.step === 1 ? <CheckoutContact state={state} /> : null}
      {state.step === 2 ? <CheckoutReview state={state} /> : null}
      {state.step === 3 ? <CheckoutPayment state={state} /> : null}
      {state.step === 4 ? <CheckoutConfirmation state={state} /> : null}
    </div>
  );
}
