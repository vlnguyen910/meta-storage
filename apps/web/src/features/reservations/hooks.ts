"use client";

import type {
  ConfirmReservationInput,
  PaymentCheckoutInput,
  PaymentStatusResponse,
  ReservationDraftInput,
  ReservationQuoteInput,
} from "@metastorage/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const reservationKeys = {
  all: ["reservations"] as const,
  mine: ["reservations", "mine"] as const,
  detail: (id: string) => ["reservations", "detail", id] as const,
};

export function useMyReservations() {
  return useQuery({ queryKey: reservationKeys.mine, queryFn: api.reservations.mine });
}

export function useReservation(id: string) {
  return useQuery({
    queryKey: reservationKeys.detail(id),
    queryFn: () => api.reservations.get(id),
  });
}

export function useReservationQuote() {
  return useMutation({
    mutationFn: (input: ReservationQuoteInput) => api.reservations.quote(input),
  });
}

export function useReservationDraft() {
  return useMutation({
    meta: { globalLoading: true },
    mutationFn: (input: ReservationDraftInput) => api.reservations.createDraft(input),
  });
}

export function useReservationHold() {
  return useMutation({
    meta: { globalLoading: true },
    mutationFn: ({ draftId, draftAccessToken }: { draftId: string; draftAccessToken: string }) =>
      api.reservations.createHold(draftId, draftAccessToken),
  });
}

export function useReservationPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { globalLoading: true },
    mutationFn: ({ draftId, input }: { draftId: string; input: PaymentCheckoutInput }) =>
      api.reservations.pay(draftId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reservationKeys.all }),
  });
}

export function usePaymentStatus(paymentId: string | null) {
  return useQuery<PaymentStatusResponse>({
    queryKey: ["payments", paymentId, "status"],
    queryFn: () => api.payments.status(paymentId ?? ""),
    enabled: Boolean(paymentId),
    refetchInterval: (query) => (query.state.data?.status === "PENDING" ? 2_000 : false),
  });
}

export function useConfirmReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { globalLoading: true },
    mutationFn: (input: ConfirmReservationInput) => api.reservations.confirm(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reservationKeys.all }),
  });
}
