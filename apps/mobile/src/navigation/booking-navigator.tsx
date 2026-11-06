import { useEffect } from "react";
import { BackHandler, Platform } from "react-native";
import type { BookingNavigatorProps } from "../common/booking.types";
import { Button, Notice } from "../components/ui";
import { BOOKING as M } from "../features/booking/booking.messages";
import { BookingFrame } from "../features/booking/components/booking-parts";
import { useBooking } from "../features/booking/use-booking";
import { BookingDetailsScreen } from "../screens/booking-details-screen";
import { BookingPaymentScreen } from "../screens/booking-payment-screen";
import { BookingReviewScreen } from "../screens/booking-review-screen";
import { BookingSuccessScreen } from "../screens/booking-success-screen";
import { BookingUnitsScreen } from "../screens/booking-units-screen";

export function BookingNavigator(props: BookingNavigatorProps) {
  const state = useBooking(props),
    step = state.step;
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (state.busy) return true;
      if (step > 0 && step < 3 && !state.paymentUncertain) state.back();
      else props.onClose();
      return true;
    });
    return () => handler.remove();
  }, [state, step, props.onClose]);
  return (
    <BookingFrame
      state={state}
      onClose={props.onClose}
      onNext={
        step === 0
          ? state.next
          : step === 1
            ? () => void state.prepare()
            : step === 2
              ? () => void state.pay()
              : undefined
      }
      nextLabel={
        step === 0
          ? M.nextDetails
          : step === 1
            ? M.nextReview
            : step === 2
              ? M.nextPayment
              : undefined
      }
      nextDisabled={
        state.busy ||
        state.restoreError ||
        (step === 2 && !state.appointment) ||
        (step === 0 && !state.unit?.isActive) ||
        (step === 1 &&
          (!state.scheduleReady ||
            !state.availability.data?.availableCount ||
            state.availability.isFetching))
      }
    >
      {state.restoreError ? (
        <Button label={M.retry} onPress={state.retryRestore} />
      ) : state.busy && !state.draft ? (
        <Notice>{M.loading}</Notice>
      ) : null}
      {step === 0 ? (
        <BookingUnitsScreen
          state={state}
          onChangeFacility={() => void state.changeFacility(props.onChangeFacility)}
        />
      ) : step === 1 ? (
        <BookingDetailsScreen state={state} />
      ) : step === 2 ? (
        <BookingReviewScreen state={state} />
      ) : step === 3 ? (
        <BookingPaymentScreen state={state} />
      ) : (
        <BookingSuccessScreen
          state={state}
          onHome={props.onHome}
          onAppointment={props.onAppointment}
        />
      )}
    </BookingFrame>
  );
}
