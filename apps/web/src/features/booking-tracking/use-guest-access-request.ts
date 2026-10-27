"use client";
import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { bookingLookupMessages as m } from "./booking-lookup.messages";
import type { BookingLookupFormValues, GuestAccessAttempt } from "./booking-lookup.types";

export function useGuestAccessRequest() {
  const [submitted, setSubmitted] = useState(false);
  const attempt = useRef<GuestAccessAttempt | null>(null);
  const busy = useRef(false);
  const mutation = useMutation({
    meta: { globalLoading: true },
    mutationFn: api.bookings.requestGuestAccessLink,
    retry: false,
    onSuccess: () => setSubmitted(true),
    onSettled: () => {
      busy.current = false;
    },
  });
  function request(values: BookingLookupFormValues) {
    if (busy.current) return;
    const bookingCode = values.bookingCode.trim().toUpperCase();
    const email = values.email.trim().toLowerCase();
    const identity = JSON.stringify([bookingCode, email]);
    if (attempt.current?.identity !== identity) {
      attempt.current = { identity, idempotencyKey: crypto.randomUUID() };
    }
    busy.current = true;
    mutation.mutate({ bookingCode, email, idempotencyKey: attempt.current.idempotencyKey });
  }
  function reset() {
    mutation.reset();
    attempt.current = null;
    setSubmitted(false);
  }
  return {
    submitted,
    pending: mutation.isPending,
    error: mutation.isError
      ? isAxiosError(mutation.error) && mutation.error.response?.status === 429
        ? m.rateLimited
        : m.failure
      : null,
    request,
    reset,
  };
}
