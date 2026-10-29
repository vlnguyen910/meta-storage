"use client";
import type { CheckoutSessionInput, CreateReservationDraftInput } from "@metastorage/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useFlow3Identity } from "@/features/returns/use-flow3-identity";
import { api } from "@/lib/api";

export function useBookingSlots() {
  return useQuery({ queryKey: ["bookings", "slots"], queryFn: api.appointments.slots });
}
export function useBookingDraft() {
  return useMutation({
    meta: { globalLoading: true },
    mutationFn: (input: CreateReservationDraftInput) => api.reservations.createDraft(input),
  });
}
export function useBookingPayment() {
  return useMutation({
    meta: { globalLoading: true },
    mutationFn: ({ bookingId, input }: { bookingId: string; input: CheckoutSessionInput }) =>
      api.reservations.pay(bookingId, input),
  });
}
export function useCheckoutPaymentStatus(
  paymentId: string | null,
  accessToken?: string,
  enabled = true,
) {
  const identity = useFlow3Identity();
  return useQuery({
    queryKey: [
      "booking-checkout",
      identity,
      paymentId,
      "status",
      accessToken ? "guest" : "account",
    ],
    queryFn: () => api.payments.status(paymentId ?? "", accessToken),
    enabled: Boolean(paymentId) && enabled,
    retry: false,
    refetchInterval: (query) => {
      const error = query.state.error;
      if (axios.isAxiosError(error) && [400, 401, 403, 404].includes(error.response?.status ?? 0))
        return false;
      if (error || query.state.dataUpdateCount >= 150) return false;
      return !query.state.data || query.state.data.status === "PENDING" || false ? 2000 : false;
    },
  });
}
