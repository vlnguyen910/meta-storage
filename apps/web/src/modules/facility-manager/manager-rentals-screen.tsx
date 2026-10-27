"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { ManagerTabFrame } from "./manager-tab-frame";
import { MANAGER_TABS as M } from "./manager-tabs.messages";
import type { ManagerFacilityTabProps, ManagerTicketProps } from "./manager-tabs.types";
import { useManagerKey } from "./use-manager-tabs";

const field = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm";
export function ManagerRentalsScreen() {
  return (
    <ManagerTabFrame title={M.rentals} description={M.rentalsHint}>
      {(facilityId) => <Rentals facilityId={facilityId} />}
    </ManagerTabFrame>
  );
}
function Rentals({ facilityId }: ManagerFacilityTabProps) {
  const key = useManagerKey(),
    selected = useSearchParams().get("rentalId");
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState("ACTIVE"),
    [offset, setOffset] = useState(0);
  const query = useQuery({
    queryKey: [...key, "rentals", facilityId, search, status, offset],
    queryFn: ({ signal }) =>
      api.facilityWorkspace.rentals(
        { facilityId, search: search || undefined, status: status || undefined, limit: 20, offset },
        signal,
      ),
    enabled: !selected,
  });
  if (selected) return <RentalDetail facilityId={facilityId} id={selected} />;
  return (
    <div className="space-y-5">
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_16rem]">
        <input
          aria-label={M.search}
          placeholder={M.search}
          className={field}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOffset(0);
          }}
        />
        <select
          aria-label={M.status}
          className={field}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setOffset(0);
          }}
        >
          <option value="">{M.all}</option>
          {["ACTIVE", "RETURN_PENDING", "OVERDUE", "CLOSED", "ABANDONED_REVIEW"].map((s) => (
            <option key={s} value={s}>
              {M.statuses[s]}
            </option>
          ))}
        </select>
      </div>
      {query.isPending ? (
        <LoadingState variant="table" />
      ) : query.isError ? (
        <ErrorState message={M.loadingError} onRetry={() => query.refetch()} />
      ) : !query.data.items.length ? (
        <EmptyState title={M.empty} description={M.emptyHint} />
      ) : (
        <>
          <ul className="grid list-none gap-4 p-0 lg:grid-cols-2">
            {query.data.items.map((rental) => (
              <li
                key={rental.id}
                className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <h2 className="text-lg font-bold">{rental.customerName ?? M.missing}</h2>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900">
                    {M.statuses[rental.status] ?? rental.status}
                  </span>
                </div>
                <p className="text-sm text-slate-600">
                  {rental.bookingCode} · {rental.unitCode} · {rental.unitTypeName}
                </p>
                <p className="text-sm text-slate-600">
                  {formatDate(rental.startAt)} — {formatDate(rental.expectedEndAt)}
                </p>
                <Link
                  href={`?rentalId=${encodeURIComponent(rental.id)}`}
                  className="inline-flex min-h-11 items-center rounded-xl bg-emerald-900 px-4 text-sm font-semibold text-white"
                >
                  {M.view}
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">{M.page(offset / 20 + 1, query.data.total)}</p>
            <div className="flex gap-2">
              <Button variant="outline" disabled={!offset} onClick={() => setOffset(offset - 20)}>
                {M.previous}
              </Button>
              <Button
                variant="outline"
                disabled={offset + 20 >= query.data.total}
                onClick={() => setOffset(offset + 20)}
              >
                {M.next}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
function RentalDetail({ id, facilityId }: ManagerTicketProps) {
  const key = useManagerKey();
  const query = useQuery({
    queryKey: [...key, "rental", facilityId, id],
    queryFn: ({ signal }) => api.facilityWorkspace.rental(id, signal),
  });
  if (query.isPending) return <LoadingState variant="detail" />;
  if (query.isError || query.data.rental.facilityId !== facilityId)
    return <ErrorState message={M.loadingError} onRetry={() => query.refetch()} />;
  const { rental, payments } = query.data;
  return (
    <div className="space-y-5">
      <Link
        href="/facility-manager/rentals"
        className="inline-flex min-h-11 items-center font-semibold text-emerald-900"
      >
        {M.back}
      </Link>
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-xl font-bold">{rental.customerName ?? M.missing}</h2>
        <p>
          {rental.customerEmail ?? M.missing} · {rental.customerPhone ?? M.missing}
        </p>
        <p>
          {rental.bookingCode} · {rental.unitCode} · {rental.unitTypeName}
        </p>
        <p>
          {formatDate(rental.startAt)} — {formatDate(rental.expectedEndAt)}
        </p>
        <p>{M.statuses[rental.status] ?? rental.status}</p>
      </section>
      <section
        aria-label={M.payments}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: Enable keyboard scrolling of the overflowing transaction table.
        tabIndex={0}
        className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-5"
      >
        <h2 className="mb-4 text-xl font-bold">{M.payments}</h2>
        {!payments.length ? (
          <p>{M.empty}</p>
        ) : (
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead>
              <tr>
                {[M.transaction, M.amount, M.paymentStatus, M.time].map((label) => (
                  <th key={label} className="p-3">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className="border-t border-slate-100">
                  <th scope="row" className="p-3">
                    {payment.paymentCode}
                  </th>
                  <td className="p-3">{formatCurrency(Number(payment.totalAmount))}</td>
                  <td className="p-3">{M.paymentStatuses[payment.status] ?? payment.status}</td>
                  <td className="p-3">{formatDateTime(payment.paidAt ?? payment.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
