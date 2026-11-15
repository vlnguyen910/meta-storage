"use client";

import { useMemo } from "react";
import { useMyRentals } from "./hooks";
import type { CustomerTransaction } from "./transactions.types";

export type TransactionView = "all" | "current" | "history";

export function useCustomerTransactions(view: TransactionView) {
  const current = useMyRentals("current", view !== "history", true);
  const history = useMyRentals("history", view !== "current", true);
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
  const transactions = useMemo<CustomerTransaction[]>(
    () =>
      rentals
        .flatMap((rental) => (rental.payments ?? []).map((payment) => ({ rental, payment })))
        .sort(
          (a, b) =>
            Date.parse(b.payment.paidAt ?? b.payment.createdAt) -
              Date.parse(a.payment.paidAt ?? a.payment.createdAt) ||
            a.payment.id.localeCompare(b.payment.id),
        ),
    [rentals],
  );
  const loadingRentals = source ? source.isLoading : current.isLoading || history.isLoading;
  const error = source ? source.error : (current.error ?? history.error);
  const fetchingMore = source
    ? source.isFetchingNextPage
    : current.isFetchingNextPage || history.isFetchingNextPage;
  const hasNext = source ? source.hasNextPage : current.hasNextPage || history.hasNextPage;
  return {
    transactions,
    loading: loadingRentals,
    error,
    fetchingMore,
    refreshing: current.isRefetching || history.isRefetching,
    hasNext,
    loadMore: () => {
      if (view === "current") return current.fetchNextPage();
      if (view === "history") return history.fetchNextPage();
      return Promise.all([
        current.hasNextPage ? current.fetchNextPage() : Promise.resolve(),
        history.hasNextPage ? history.fetchNextPage() : Promise.resolve(),
      ]);
    },
    retry: () =>
      Promise.all([...(source ? [source.refetch()] : [current.refetch(), history.refetch()])]),
  };
}
