"use client";
import type { BookingDraftInput, BookingPaymentInput } from "@metastorage/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";
import axios from "axios";
import { api } from "@/lib/api";

export function useBookingSlots() {
  return useQuery({ queryKey: ["bookings", "slots"], queryFn: api.bookings.checkInSlots });
}
export function useBookingDraft() {
  return useMutation({ mutationFn: (input: BookingDraftInput) => api.bookings.createDraft(input) });
}
export function useBookingPayment() {
  return useMutation({
    mutationFn: ({ bookingId, input }: { bookingId: string; input: BookingPaymentInput }) =>
      api.bookings.pay(bookingId, input),
  });
}
export function useCheckoutPaymentStatus(
  paymentId: string | null,
  accessToken?: string,
  enabled = true,
) {
  return useQuery({
    queryKey: ["booking-checkout", paymentId, "status", accessToken ? "guest" : "account"],
    queryFn: () => api.payments.status(paymentId ?? "", accessToken),
    enabled: Boolean(paymentId) && enabled,
    retry: false,
    refetchInterval: (query) => {
      const error = query.state.error;
      if (axios.isAxiosError(error) && [400, 401, 403, 404].includes(error.response?.status ?? 0))
        return false;
      return !query.state.data ||
        query.state.data.status === "PENDING" ||
        (query.state.data.status === "SUCCEEDED" && !query.state.data.confirmation)
        ? 2000
        : false;
    },
  });
}
