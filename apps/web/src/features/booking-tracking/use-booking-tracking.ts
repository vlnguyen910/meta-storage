"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { trackingMessages as m } from "./tracking.messages";

const queryRoot = ["booking-tracking"] as const;
function accessError(error: unknown): string {
  const status = isAxiosError(error) ? error.response?.status : undefined;
  return status === 429
    ? m.rateLimited
    : status === 401 || status === 404 || status === 400
      ? m.invalid
      : m.unavailable;
}
export function useBookingTracking() {
  const client = useQueryClient();
  const initialized = useRef(false);
  const [bookingCode, setBookingCode] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const exchange = useMutation({
    meta: { globalLoading: true },
    mutationFn: api.bookings.exchangeMagicLink,
    gcTime: 0,
    retry: false,
  });
  const { mutateAsync, reset } = exchange;
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const url = new URL(window.location.href);
    const token = new URLSearchParams(url.hash.slice(1)).get("token");
    // Remove the credential from the visible URL before any request is made.
    url.hash = "";
    if (token) url.search = "";
    window.history.replaceState(null, "", url);
    client.removeQueries({ queryKey: queryRoot });
    if (!token) {
      const code = url.searchParams.get("bookingCode");
      setBookingCode(code);
      if (!code) setMessage(m.invalid);
      setInitializing(false);
      return;
    }
    void mutateAsync(token)
      .then((session) => {
        client.setQueryData([...queryRoot, session.bookingCode], session.booking);
        setBookingCode(session.bookingCode);
        setExpiresAt(Date.parse(session.expiresAt));
        url.searchParams.set("bookingCode", session.bookingCode);
        window.history.replaceState(null, "", url);
      })
      .catch((error: unknown) => setMessage(accessError(error)))
      .finally(() => {
        reset();
        setInitializing(false);
      });
  }, [client, mutateAsync, reset]);
  const query = useQuery({
    queryKey: [...queryRoot, bookingCode],
    queryFn: () => api.bookings.tracking(bookingCode ?? ""),
    enabled: Boolean(bookingCode) && !message,
    retry: false,
    staleTime: 30_000,
    gcTime: 0,
    refetchOnWindowFocus: "always",
    refetchInterval: 30_000,
  });
  useEffect(() => {
    if (!expiresAt) return;
    const timer = window.setTimeout(
      () => {
        setMessage(m.invalid);
        setBookingCode(null);
        client.removeQueries({ queryKey: queryRoot });
      },
      Math.max(0, expiresAt - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [expiresAt, client]);
  const revoke = useMutation({
    meta: { globalLoading: true },
    mutationFn: api.bookings.revokeTrackingSession,
    onSuccess: async () => {
      // Cancel outstanding requests before removing cached private data.
      await client.cancelQueries({ queryKey: queryRoot });
      setBookingCode(null);
      setExpiresAt(null);
      setMessage(m.revoked);
      client.removeQueries({ queryKey: queryRoot });
      window.history.replaceState(null, "", window.location.pathname);
    },
  });
  return {
    booking: query.isError || message ? undefined : query.data,
    loading: initializing || (Boolean(bookingCode) && query.isPending),
    message: message ?? (query.isError ? accessError(query.error) : null),
    revokeError: revoke.isError ? m.revokeFailed : null,
    revoke: () => revoke.mutate(),
    revoking: revoke.isPending,
    retry: !message && query.isError ? () => void query.refetch() : undefined,
  };
}
