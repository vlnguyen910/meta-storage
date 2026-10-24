"use client";

import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { useFlow3Identity } from "@/features/returns/use-flow3-identity";
import { api } from "@/lib/api";
import { useMyRentals } from "./hooks";
import type { CustomerTransaction } from "./transactions.types";

export type TransactionView = "all" | "current" | "history";

export function useCustomerTransactions(view: TransactionView) {
  const identity = useFlow3Identity();
  const current = useMyRentals("current");
  const history = useMyRentals("history");
  const source = view === "current" ? current : view === "history" ? history : null;
  const rentals = useMemo(() => {
    const pages = source
      ? (source.data?.pages ?? [])
      : [...(current.data?.pages ?? []), ...(history.data?.pages ?? [])];
    const seen = new Set<string>();
    return pages
      .flatMap((page) => page.items)
      .filter((rental) => {
        if (seen.has(rental.id)) return false;
        seen.add(rental.id);
        return true;
      });
  }, [current.data?.pages, history.data?.pages, source]);
  const paymentQueries = useQueries({
    queries: rentals.map((rental) => ({
      queryKey: ["rental-payments", identity, rental.id],
      queryFn: ({ signal }: { signal: AbortSignal }) => api.rentalPayments(rental.id, signal),
      staleTime: 30_000,
    })),
  });
  const transactions = useMemo<CustomerTransaction[]>(
    () =>
      rentals.flatMap((rental, index) =>
        (paymentQueries[index]?.data ?? []).map((payment) => ({ rental, payment })),
      ),
    [paymentQueries, rentals],
  );
  const loadingRentals = source ? source.isLoading : current.isLoading || history.isLoading;
  const loadingPayments = paymentQueries.some((query) => query.isPending);
  const error =
    source?.error ??
    current.error ??
    history.error ??
    paymentQueries.find((query) => query.error)?.error;
  const fetchingMore = source
    ? source.isFetchingNextPage
    : current.isFetchingNextPage || history.isFetchingNextPage;
  const hasNext = source ? source.hasNextPage : current.hasNextPage || history.hasNextPage;
  return {
    transactions,
    loading: loadingRentals || loadingPayments,
    error,
    fetchingMore,
    hasNext,
    loadMore: () => {
      if (view === "current") return current.fetchNextPage();
      if (view === "history") return history.fetchNextPage();
      return Promise.all([
        current.hasNextPage ? current.fetchNextPage() : Promise.resolve(),
        history.hasNextPage ? history.fetchNextPage() : Promise.resolve(),
      ]);
    },
    retry: () => {
      void current.refetch();
      void history.refetch();
    },
  };
}
