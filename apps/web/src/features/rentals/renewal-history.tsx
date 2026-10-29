"use client";
import Link from "next/link";
import { useState } from "react";
import { Button, buttonClassName } from "@/components/ui/button";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { useRenewalHistory } from "./renewal.hooks";
import { RENEWAL_MESSAGES as M } from "./renewal.messages";
export function RenewalHistory({ rentalId }: { rentalId: string }) {
  const [offset, setOffset] = useState(0);
  const query = useRenewalHistory(rentalId, offset);
  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-xl font-bold text-ink">{M.history}</h2>
      {query.isPending && <p role="status">{M.loading}</p>}
      {query.isError && (
        <div role="alert">
          <p>{M.error}</p>
          <Button onClick={() => query.refetch()}>{M.retry}</Button>
        </div>
      )}
      {query.data?.items.length === 0 && <p className="text-secondary">{M.empty}</p>}
      {query.data?.items.map((item) => (
        <div
          key={item.id}
          className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 py-4"
        >
          <div className="space-y-1">
            <p className="font-semibold">{M.status[item.status]}</p>
            <p className="text-sm text-secondary">
              {item.months} {M.month} · {formatCurrency(Number(item.amount))}
            </p>
            <p className="text-sm">
              {formatDateTime(item.oldEndAt)} → {formatDateTime(item.newEndAt)}
            </p>
          </div>
          <Link
            className={buttonClassName("outline")}
            href={`/customer/storage/${rentalId}/renew?renewalId=${item.id}`}
          >
            {M.open}
          </Link>
        </div>
      ))}
      {query.data && query.data.total > 10 && (
        <nav className="flex justify-between" aria-label={M.history}>
          <Button variant="outline" disabled={offset === 0} onClick={() => setOffset(offset - 10)}>
            {M.previous}
          </Button>
          <Button
            variant="outline"
            disabled={offset + 10 >= query.data.total}
            onClick={() => setOffset(offset + 10)}
          >
            {M.next}
          </Button>
        </nav>
      )}
    </section>
  );
}
