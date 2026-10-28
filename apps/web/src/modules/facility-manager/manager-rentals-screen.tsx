"use client";
import { type RentalStatus, RentalStatusSchema } from "@metastorage/contracts";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Mail, Phone, ReceiptText, UserRound, Warehouse } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  OperationalBackLink,
  OperationalBadge,
  OperationalSectionHeader,
  operationalField,
} from "@/components/ui/operational";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { PageControls } from "@/features/facility-management/management-ui";
import { api } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { ManagerTabFrame } from "./manager-tab-frame";
import { MANAGER_TABS as M } from "./manager-tabs.messages";
import type { ManagerFacilityTabProps, ManagerTicketProps } from "./manager-tabs.types";
import { useManagerKey } from "./use-manager-tabs";

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
    [status, setStatus] = useState<RentalStatus | "">("ACTIVE"),
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
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:grid-cols-[minmax(0,1fr)_14rem]">
        <label className="grid gap-2 text-xs font-semibold text-slate-600">
          {M.search}
          <input
            className={operationalField}
            type="search"
            maxLength={200}
            placeholder={M.search}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setOffset(0);
            }}
          />
        </label>
        <label className="grid gap-2 text-xs font-semibold text-slate-600">
          {M.status}
          <select
            className={operationalField}
            value={status}
            onChange={(event) => {
              const parsedStatus = RentalStatusSchema.safeParse(event.target.value);
              setStatus(parsedStatus.success ? parsedStatus.data : "");
              setOffset(0);
            }}
          >
            <option value="">{M.all}</option>
            {["ACTIVE", "RETURN_PENDING", "OVERDUE", "CLOSED"].map((s) => (
              <option key={s} value={s}>
                {M.statuses[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {query.isPending ? (
        <LoadingState variant="table" />
      ) : query.isError ? (
        <ErrorState message={M.loadingError} onRetry={() => query.refetch()} />
      ) : !query.data.items.length ? (
        <EmptyState title={M.empty} description={M.emptyHint} />
      ) : (
        <>
          <section
            className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: Scrollable tables must support keyboard scrolling.
            tabIndex={0}
            aria-label={M.rentals}
          >
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                <tr>
                  {[M.customer, M.unit, M.period, M.status, M.action].map((label) => (
                    <th key={label} className="px-5 py-3.5 font-semibold">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((rental) => (
                  <tr
                    key={rental.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"
                  >
                    <th scope="row" className="max-w-64 px-5 py-4 font-normal">
                      <span className="block break-words font-semibold text-slate-900">
                        {rental.customerName ?? M.missing}
                      </span>
                      <span className="mt-1 block break-all font-mono text-xs text-slate-500">
                        {rental.bookingCode}
                      </span>
                    </th>
                    <td className="px-5 py-4">
                      <p className="font-medium">{rental.unitCode}</p>
                      <p className="mt-1 text-xs text-slate-500">{rental.unitTypeName}</p>
                    </td>
                    <td className="px-5 py-4 text-xs leading-6 text-slate-600">
                      {formatDateTime(rental.startAt)}
                      <br />
                      {formatDateTime(rental.expectedEndAt)}
                    </td>
                    <td className="px-5 py-4">
                      <OperationalBadge value={rental.status} label={M.statuses[rental.status]} />
                    </td>
                    <td className="px-5 py-4">
                      <Link
                        href={`?rentalId=${encodeURIComponent(rental.id)}`}
                        className="inline-flex min-h-10 items-center whitespace-nowrap rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
                      >
                        {M.view}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <PageControls
            label={M.rentals}
            offset={offset}
            count={query.data.items.length}
            total={query.data.total}
            onChange={setOffset}
            pending={query.isFetching}
          />
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
      <OperationalBackLink href="/facility-manager/rentals">{M.back}</OperationalBackLink>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="break-all font-mono text-sm font-semibold text-slate-700">
          {M.bookingCode}: {rental.bookingCode}
        </p>
        <OperationalBadge value={rental.status} label={M.statuses[rental.status]} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <OperationalSectionHeader title={M.customerDetails} icon={UserRound} />
          <h2 className="text-lg font-bold text-slate-900">{rental.customerName ?? M.missing}</h2>
          <div className="mt-4 grid gap-3 text-sm">
            <p className="flex min-w-0 items-start gap-2">
              <Mail size={16} className="mt-0.5 shrink-0 text-slate-400" />
              <span className="break-all">{rental.customerEmail ?? M.missing}</span>
            </p>
            <p className="flex items-center gap-2">
              <Phone size={16} className="text-slate-400" />
              {rental.customerPhone ?? M.missing}
            </p>
          </div>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <OperationalSectionHeader title={M.rentalDetails} icon={Warehouse} />
          <p className="font-semibold text-slate-900">{rental.unitCode}</p>
          <p className="mt-1 text-sm text-slate-600">{rental.unitTypeName}</p>
          <p className="mt-3 flex items-start gap-2 text-sm leading-6 text-slate-600">
            <CalendarClock size={16} className="mt-1 shrink-0" />
            {formatDateTime(rental.startAt)} — {formatDateTime(rental.expectedEndAt)}
          </p>
          <p className="mt-3 break-all text-xs text-slate-500">
            {M.rentalReference}: {rental.id}
          </p>
        </section>
      </div>
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <OperationalSectionHeader title={M.payments} icon={ReceiptText} />
        {!payments.length ? (
          <div className="rounded-lg bg-slate-50 p-6 text-center text-sm text-slate-500">
            {M.noTransactions}
          </div>
        ) : (
          <section
            className="overflow-x-auto"
            aria-label={M.payments}
            // biome-ignore lint/a11y/noNoninteractiveTabindex: Scrollable tables must support keyboard scrolling.
            tabIndex={0}
          >
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3">{M.transaction}</th>
                  <th className="px-4 py-3 text-right">{M.amount}</th>
                  <th className="px-4 py-3">{M.paymentStatus}</th>
                  <th className="px-4 py-3">{M.time}</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-t border-slate-100">
                    <th
                      scope="row"
                      className="max-w-64 break-all px-4 py-4 font-mono text-xs font-medium"
                    >
                      {payment.paymentCode}
                    </th>
                    <td className="whitespace-nowrap px-4 py-4 text-right font-semibold tabular-nums">
                      {formatCurrency(Number(payment.totalAmount))}
                    </td>
                    <td className="px-4 py-4">
                      <OperationalBadge
                        value={payment.status}
                        label={M.paymentStatuses[payment.status]}
                      />
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-600">
                      {formatDateTime(payment.paidAt ?? payment.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </section>
    </div>
  );
}
