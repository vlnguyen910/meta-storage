"use client";

import { formatReference } from "@metastorage/shared";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, ReceiptText } from "lucide-react";
import { useState } from "react";
import { ListPagination } from "@/components/ui/list-pagination";
import { OperationalBadge } from "@/components/ui/operational";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useFlow3Identity } from "@/features/returns/use-flow3-identity";
import { api } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { RENTAL_MESSAGES as M } from "./rentals.messages";

export function RentalPaymentHistory({ rentalId }: { rentalId: string }) {
  const identity = useFlow3Identity();
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["rental-payments", identity, rentalId],
    queryFn: ({ signal }) => api.rentalPayments(rentalId, signal),
  });
  const items = [...(query.data ?? [])].sort(
    (a, b) =>
      Date.parse(b.paidAt ?? b.createdAt) - Date.parse(a.paidAt ?? a.createdAt) ||
      b.id.localeCompare(a.id),
  );
  const currentPage = Math.min(page, Math.max(1, Math.ceil(items.length / 8)));
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
      <header className="flex items-start gap-3 border-b border-slate-100 p-5 sm:p-6">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-primary">
          <ReceiptText size={20} aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-slate-900">{M.paymentHistory}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">{M.paymentHistoryHint}</p>
        </div>
      </header>
      {query.isPending ? (
        <div className="p-6">
          <LoadingState variant="table" />
        </div>
      ) : query.isError ? (
        <div className="p-6">
          <ErrorState message={M.paymentHistoryError} onRetry={() => void query.refetch()} />
        </div>
      ) : !items.length ? (
        <div className="px-6 py-10 text-center text-sm text-slate-500">{M.noPayments}</div>
      ) : (
        <>
          <div className="hidden grid-cols-[1.3fr_1.1fr_1fr_1fr_1fr] gap-4 bg-slate-50 px-6 py-3 text-xs font-semibold text-slate-500 md:grid">
            {M.paymentHeadings.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <ul className="divide-y divide-slate-100">
            {items.slice((currentPage - 1) * 8, currentPage * 8).map((payment) => {
              const refund = payment.type === "DEPOSIT_REFUND";
              const Icon = refund ? ArrowDownLeft : ArrowUpRight;
              return (
                <li
                  key={payment.id}
                  className="grid grid-cols-2 items-center gap-3 px-5 py-4 text-sm md:grid-cols-[1.3fr_1.1fr_1fr_1fr_1fr] md:gap-4 md:px-6"
                >
                  <time
                    className="text-xs leading-5 text-slate-600"
                    dateTime={payment.paidAt ?? payment.createdAt}
                  >
                    {formatDateTime(payment.paidAt ?? payment.createdAt)}
                  </time>
                  <span className="break-all text-right font-mono text-xs font-semibold text-slate-600 md:text-left">
                    {formatReference(payment.paymentCode, "TT")}
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <Icon size={15} aria-hidden="true" />
                    {refund ? M.depositRefund : M.paymentCharge}
                  </span>
                  <strong className="text-right tabular-nums text-primary md:text-left">
                    {formatCurrency(Number(payment.totalAmount))}
                  </strong>
                  <div className="col-span-2 md:col-span-1">
                    <OperationalBadge
                      value={payment.status}
                      label={M.paymentStatuses[payment.status] ?? payment.status}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          {items.length > 8 && (
            <div className="border-t border-slate-100 p-3">
              <ListPagination
                label={M.paymentHistory}
                page={currentPage}
                pageSize={8}
                total={items.length}
                onPageChange={setPage}
                unitLabel={M.paymentUnit}
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}
