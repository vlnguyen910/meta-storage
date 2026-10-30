"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useFlow3Identity } from "@/features/returns/use-flow3-identity";
import { api } from "@/lib/api";
import { RENEWAL_MESSAGES as M } from "./renewal.messages";

// Persist before sending so a lost response can be retried without a second command.
export function renewalCommandKey(owner: string, command: string) {
  const name = `renewal:${owner}:${command}`;
  try {
    const existing = localStorage.getItem(name);
    if (existing) return existing;
    const key = crypto.randomUUID();
    localStorage.setItem(name, key);
    return key;
  } catch {
    throw new Error(M.storageError);
  }
}
export function useRenewalHistory(rentalId: string, offset: number) {
  const identity = useFlow3Identity();
  return useQuery({
    queryKey: ["renewals", identity, rentalId, offset],
    queryFn: () => api.renewals.list(rentalId, offset),
    enabled: !identity.startsWith("anonymous:"),
  });
}
export function useRenewal(rentalId: string, renewalId: string | null) {
  const identity = useFlow3Identity();
  const client = useQueryClient();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const detail = useQuery({
    queryKey: ["renewal", identity, rentalId, renewalId],
    queryFn: () => api.renewals.get(rentalId, renewalId ?? ""),
    enabled: Boolean(renewalId) && !identity.startsWith("anonymous:"),
    retry: false,
    refetchInterval: (q) =>
      q.state.error ||
      q.state.dataUpdateCount >= 150 ||
      ["APPLIED", "REFUND_REQUIRED"].includes(q.state.data?.status ?? "")
        ? false
        : 5000,
  });
  const payment = useQuery({
    queryKey: ["renewal-payment", identity, detail.data?.paymentId],
    queryFn: () => api.payments.status(detail.data?.paymentId ?? ""),
    enabled: Boolean(detail.data?.paymentId),
    retry: false,
    refetchInterval: (q) =>
      q.state.error ||
      q.state.dataUpdateCount >= 150 ||
      (q.state.data && !["PENDING", "REFUND_PENDING"].includes(q.state.data.status))
        ? false
        : 5000,
  });
  useEffect(() => {
    if (payment.data?.status === "SUCCEEDED") void detail.refetch();
  }, [payment.data?.status, detail.refetch]);
  useEffect(() => {
    if (detail.data?.status === "APPLIED") {
      for (const key of ["rentals", "renewals", "rental-payments"])
        void client.invalidateQueries({ queryKey: [key] });
    }
  }, [detail.data?.status, client]);
  const quote = useMutation({
    mutationFn: (months: number) =>
      api.renewals.quote(rentalId, {
        months,
        idempotencyKey: renewalCommandKey(identity, `${rentalId}:quote:${months}`),
      }),
    onSuccess: (_, months) => {
      localStorage.removeItem(`renewal:${identity}:${rentalId}:quote:${months}`);
      return client.invalidateQueries({ queryKey: ["renewals"] });
    },
  });
  const checkout = useMutation({
    mutationFn: () =>
      api.renewals.pay(rentalId, renewalId ?? "", {
        idempotencyKey: renewalCommandKey(identity, `${renewalId}:payment`),
      }),
  });
  return { detail, payment, quote, checkout, now, identity };
}
