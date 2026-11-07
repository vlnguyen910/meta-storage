import { useQueries } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useCustomerRentals } from "./customer-api.hooks";

export function useCustomerTransactions(owner: string) {
  const current = useCustomerRentals(owner, "current");
  const history = useCustomerRentals(owner, "history");
  const rentals = [
    ...new Map(
      [...(current.data?.pages ?? []), ...(history.data?.pages ?? [])]
        .flatMap((page) => page.items)
        .map((r) => [r.id, r]),
    ).values(),
  ];
  const payments = useQueries({
    queries: rentals.map((rental) => ({
      queryKey: ["rental-payments", owner, rental.id],
      queryFn: ({ signal }: { signal: AbortSignal }) => api.rentalPayments(rental.id, signal),
    })),
  });
  const items = rentals
    .flatMap((rental, index) =>
      (payments[index]?.data ?? []).map((payment) => ({ rental, payment })),
    )
    .sort(
      (a, b) =>
        Date.parse(b.payment.paidAt ?? b.payment.createdAt) -
        Date.parse(a.payment.paidAt ?? a.payment.createdAt),
    );
  return {
    items,
    isPending: current.isPending || history.isPending || payments.some((q) => q.isPending),
    isError: current.isError || history.isError || payments.some((q) => q.isError),
    error: current.error ?? history.error ?? payments.find((q) => q.error)?.error,
    refetch: () =>
      Promise.all([current.refetch(), history.refetch(), ...payments.map((q) => q.refetch())]),
    hasNextPage: current.hasNextPage || history.hasNextPage,
    isFetchingNextPage: current.isFetchingNextPage || history.isFetchingNextPage,
    more: () =>
      Promise.all([
        ...(current.hasNextPage ? [current.fetchNextPage()] : []),
        ...(history.hasNextPage ? [history.fetchNextPage()] : []),
      ]),
  };
}
