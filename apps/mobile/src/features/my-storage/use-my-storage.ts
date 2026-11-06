import type { RentalListItem, RentalPageCursor } from "@metastorage/contracts";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { StorageSelection, StorageView } from "../../common/my-storage.types";
import { storageRentals, storageTransactions } from "../../common/my-storage.utils";
import { api } from "../../lib/api";
import { MY_STORAGE as M } from "./my-storage.messages";

async function loadRentals(view: "current" | "history", signal: AbortSignal) {
  const items: RentalListItem[] = [],
    seen = new Set<string>();
  let cursor: RentalPageCursor | undefined;
  do {
    if (signal.aborted) throw new Error(M.paginationError);
    const page = await api.rentals.mine({ view, limit: 100, ...cursor });
    items.push(...page.items);
    cursor = page.nextCursor ?? undefined;
    if (cursor) {
      const key = JSON.stringify(cursor);
      if (seen.has(key)) throw new Error(M.paginationError);
      seen.add(key);
    }
  } while (cursor);
  return storageRentals(items, view);
}
export function useMyStorage(owner: string, view: StorageView) {
  const [now, setNow] = useState(Date.now),
    [selection, setSelection] = useState<StorageSelection | null>(null);
  const [filter, setFilter] = useState<"all" | "succeeded">("all"),
    [oldest, setOldest] = useState(false);
  const current = useQuery({
    queryKey: ["customer-storage", owner, "current"],
    queryFn: ({ signal }) => loadRentals("current", signal),
    staleTime: 30000,
  });
  const history = useQuery({
    queryKey: ["customer-storage", owner, "history"],
    queryFn: ({ signal }) => loadRentals("history", signal),
    staleTime: 30000,
  });
  const rentals = [
    ...new Map(
      [...(current.data ?? []), ...(history.data ?? [])].map((item) => [item.id, item]),
    ).values(),
  ];
  const payments = useQueries({
    queries: rentals.map((rental) => ({
      queryKey: ["rental-payments", owner, rental.id],
      queryFn: ({ signal }: { signal: AbortSignal }) => api.rentalPayments(rental.id, signal),
      enabled: view === "transactions",
      staleTime: 30000,
    })),
  });
  const transactions = storageTransactions(
    rentals.flatMap((rental, index) =>
      (payments[index]?.data ?? []).map((payment) => ({ rental, payment })),
    ),
    oldest,
  );
  const complete = current.isSuccess && history.isSuccess && payments.every((q) => q.isSuccess);
  const detailId = selection?.kind === "rental" ? selection.id : undefined;
  const detail = useQuery({
    queryKey: ["rental", owner, detailId],
    queryFn: () => api.rentals.get(detailId ?? ""),
    enabled: Boolean(detailId),
    staleTime: 30000,
  });
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const transactionLoading =
    current.isPending || history.isPending || payments.some((q) => q.isPending);
  const transactionError = current.isError || history.isError || payments.some((q) => q.isError);
  return {
    now,
    current,
    history,
    detail,
    selection,
    setSelection,
    filter,
    setFilter,
    oldest,
    toggleSort: () => setOldest((old) => !old),
    transactions,
    visibleTransactions: transactions.filter(
      (t) => filter === "all" || t.payment.status === "SUCCEEDED",
    ),
    transactionCount: complete ? transactions.length : undefined,
    successCount: complete
      ? transactions.filter((t) => t.payment.status === "SUCCEEDED").length
      : undefined,
    transactionLoading,
    transactionError,
    refreshing: current.isRefetching || history.isRefetching || payments.some((q) => q.isFetching),
    refresh: () =>
      Promise.all([
        current.refetch(),
        history.refetch(),
        ...payments.filter((q) => q.isEnabled).map((q) => q.refetch()),
      ]),
    showRental: (id: string) => setSelection({ kind: "rental", id }),
  };
}
