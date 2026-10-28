"use client";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";
import { useFlow3Identity } from "@/features/returns/use-flow3-identity";
import { api } from "@/lib/api";

export function useRentalFinance(rentalId: string) {
  const identity = useFlow3Identity();
  const client = useQueryClient();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const renewalId = params.get("renewalId");
  const paymentId = params.get("paymentId");
  const setParams = (values: Record<string, string>) => {
    const next = new URLSearchParams(params);
    if (values.renewalId) {
      next.delete("paymentId");
      next.delete("chargeId");
    }
    for (const [k, v] of Object.entries(values)) next.set(k, v);
    router.replace(`${pathname}?${next}`, { scroll: false });
  };
  const invalidate = useCallback(async () => {
    await Promise.all(
      [
        "rentals",
        "rental-payments",
        "customer-transactions",
        "rental-charges",
        "rental-renewals",
        "rental-renewal",
      ].map((key) => client.invalidateQueries({ queryKey: [key] })),
    );
  }, [client]);
  const commandKey = (operation: string) => {
    const key = `customer-finance:${identity}:${rentalId}:${operation}`;
    const saved = sessionStorage.getItem(key);
    if (saved) return saved;
    const value = crypto.randomUUID();
    sessionStorage.setItem(key, value);
    return value;
  };
  const renewal = useQuery({
    queryKey: ["rental-renewal", identity, renewalId],
    queryFn: ({ signal }) => {
      if (!renewalId) throw new Error();
      return api.renewals.get(renewalId, signal);
    },
    enabled: Boolean(renewalId),
    refetchInterval: (q) =>
      !q.state.error && q.state.data?.status === "AWAITING_PAYMENT" && q.state.dataUpdateCount < 60
        ? 3000
        : false,
  });
  const history = useInfiniteQuery({
    queryKey: ["rental-renewals", identity, rentalId],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api.renewals.list(rentalId, { limit: 20, offset: pageParam }),
    getNextPageParam: (page, pages) => (page.length === 20 ? pages.length * 20 : undefined),
  });
  const charges = useInfiniteQuery({
    queryKey: ["rental-charges", identity, rentalId],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      api.rentalCharges.list(rentalId, { limit: 20, offset: pageParam }, signal),
    getNextPageParam: (page) =>
      page.offset + page.items.length < page.total ? page.offset + page.items.length : undefined,
  });
  const payment = useQuery({
    queryKey: ["rental-charge-payment", identity, paymentId],
    queryFn: () => {
      if (!paymentId) throw new Error();
      return api.payments.status(paymentId);
    },
    enabled: Boolean(paymentId),
    refetchInterval: (q) =>
      !q.state.error && q.state.data?.status === "PENDING" && q.state.dataUpdateCount < 150
        ? 2000
        : false,
  });
  const paymentStatus = payment.data?.status;
  useEffect(() => {
    if (paymentStatus && paymentStatus !== "PENDING") void invalidate();
  }, [paymentStatus, invalidate]);
  const quote = useMutation({
    mutationFn: (months: number) =>
      api.renewals.quote(rentalId, { months, idempotencyKey: commandKey(`quote:${months}`) }),
    onSuccess: (result) => {
      sessionStorage.removeItem(`customer-finance:${identity}:${rentalId}:quote:${result.months}`);
      setParams({ renewalId: result.id });
      void invalidate();
    },
  });
  const accept = useMutation({
    mutationFn: () => {
      if (!renewalId || !renewal.data) throw new Error();
      return api.renewals.accept(renewalId, {
        acceptedTerms: true,
        termsVersion: renewal.data.termsVersion,
      });
    },
    onSuccess: invalidate,
  });
  const pay = useMutation({
    mutationFn: (chargeId: string) =>
      api.rentalCharges.pay(chargeId, { idempotencyKey: commandKey(`pay:${chargeId}`) }),
    onError: (error, chargeId) => {
      if (isAxiosError(error) && error.response?.status === 409)
        sessionStorage.removeItem(`customer-finance:${identity}:${rentalId}:pay:${chargeId}`);
    },
    onSuccess: (result) => {
      setParams({ chargeId: result.chargeId, paymentId: result.paymentId });
      void invalidate();
    },
  });
  const dispute = useMutation({
    mutationFn: ({ chargeId, reason }: { chargeId: string; reason: string }) =>
      api.rentalCharges.dispute(chargeId, { reason }),
    onSuccess: invalidate,
  });
  return {
    renewal,
    history,
    charges,
    payment,
    quote,
    accept,
    pay,
    dispute,
    selectRenewal: (id: string) => setParams({ renewalId: id }),
  };
}
