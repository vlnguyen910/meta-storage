import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AppState } from "react-native";
import type { SavedBooking } from "../../common/booking.types";
import { isBookingPayment, isPaidReservation } from "../../common/booking.utils";
import { api } from "../../lib/api";
import { BOOKING as M } from "./booking.messages";

export function useBookingPayment(payment?: SavedBooking["payment"]) {
  const client = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const query = useQuery({
    queryKey: ["mobile-booking-payment", payment?.paymentId],
    queryFn: async () => {
      if (!payment) throw new Error(M.error);
      const result = await api.payments.status(payment.paymentId);
      if (!isBookingPayment(result, payment)) throw new Error(M.error);
      return result;
    },
    enabled: Boolean(payment),
    refetchInterval: (q) =>
      !q.state.data || q.state.data.status === "PENDING" || q.state.data.status === "REFUND_PENDING"
        ? 15000
        : false,
    retry: 1,
  });
  const status = query.data?.status;
  const receipt = useQuery({
    queryKey: ["mobile-booking-receipt", payment?.reservationId, payment?.paymentId],
    queryFn: async () => {
      if (!payment) throw new Error(M.error);
      const result = await api.reservations.get(payment.reservationId);
      if (result.id !== payment.reservationId || !isPaidReservation(result))
        throw new Error(M.waiting);
      return result;
    },
    enabled: status === "SUCCEEDED",
    retry: 2,
    refetchInterval: (q) => (q.state.data ? false : 15000),
  });
  useEffect(() => {
    if (!payment) return;
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const active = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        setNow(Date.now());
        void client.invalidateQueries({ queryKey: ["mobile-booking-payment", payment.paymentId] });
      }
    });
    return () => {
      clearInterval(tick);
      active.remove();
    };
  }, [payment, client]);
  const seconds = payment
    ? Math.max(0, Math.ceil((Date.parse(payment.expiresAt) - now) / 1000))
    : 0;
  return {
    query,
    receipt,
    status,
    seconds,
    expired: Boolean(payment) && seconds <= 0,
    refresh: async () => {
      await query.refetch();
      if (status === "SUCCEEDED") await receipt.refetch();
    },
  };
}
