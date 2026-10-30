"use client";
import { APPOINTMENT_TYPES, RENTAL_STATUSES, type RentalStatus } from "@metastorage/contracts";
import { formatReference } from "@metastorage/shared";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  OperationalBackLink,
  OperationalBadge,
  operationalField,
} from "@/components/ui/operational";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { PageControls } from "@/features/facility-management/management-ui";
import { DebtPanel, SettlementSummary } from "@/features/rentals/debt-panel";
import { api } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { ManagerTabFrame } from "./manager-tab-frame";
import { MANAGER_TABS as M } from "./manager-tabs.messages";
import { useManagerKey } from "./use-manager-tabs";

const rentalColumns = "lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_8.5rem_8rem]";
export function ManagerRentalsScreen() {
  return (
    <ManagerTabFrame title={M.rentals} description={M.rentalsHint}>
      {(facilityId) => (
        <div className="space-y-5">
          <Rentals facilityId={facilityId} />
          <DebtPanel />
        </div>
      )}
    </ManagerTabFrame>
  );
}
function Rentals({ facilityId }: { facilityId: string }) {
  const key = useManagerKey(),
    selected = useSearchParams().get("rentalId");
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState<RentalStatus | "">("ACTIVE"),
    [offset, setOffset] = useState(0);
  const list = useQuery({
    queryKey: [...key, "rentals", facilityId, search, status, offset],
    enabled: !selected,
    queryFn: () =>
      api.rentals.facilityList(facilityId, {
        search: search || undefined,
        status: status || undefined,
        limit: 20,
        offset,
      }),
  });
  if (selected) return <Detail facilityId={facilityId} id={selected} />;
  return (
    <div className="space-y-5">
      <div className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2">
        <label>
          {M.search}
          <input
            className={operationalField}
            value={search}
            maxLength={200}
            onChange={(e) => {
              setSearch(e.target.value);
              setOffset(0);
            }}
          />
        </label>
        <label>
          {M.status}
          <select
            className={operationalField}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as RentalStatus | "");
              setOffset(0);
            }}
          >
            <option value="">{M.all}</option>
            {RENTAL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {M.statuses[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {list.isPending ? (
        <LoadingState variant="table" />
      ) : list.isError ? (
        <ErrorState message={M.loadingError} onRetry={() => list.refetch()} />
      ) : !list.data.items.length ? (
        <EmptyState title={M.empty} description={M.emptyHint} />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div
              aria-hidden="true"
              className={`hidden items-center gap-5 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold text-slate-500 lg:grid ${rentalColumns}`}
            >
              <span>{M.customerDetails}</span>
              <span>{M.period}</span>
              <span className="text-center">{M.status}</span>
              <span className="text-right">{M.action}</span>
            </div>
            <ul aria-label={M.rentals} className="divide-y divide-slate-100">
              {list.data.items.map((r) => (
                <li
                  key={r.id}
                  className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 gap-y-4 p-5 ${rentalColumns}`}
                >
                  <div className="col-span-2 min-w-0 space-y-1.5 lg:col-span-1">
                    <strong className="block break-words text-sm text-slate-900">
                      {r.customer.name || M.missing}
                    </strong>
                    <p className="break-all font-mono text-xs leading-5 text-slate-500">
                      {formatReference(r.bookingCode, "BK")}
                    </p>
                    <p className="break-words text-sm text-slate-600">
                      <span className="text-slate-500">{M.unit}: </span>
                      {r.unit.code}
                    </p>
                  </div>
                  <div className="col-span-2 min-w-0 space-y-1 text-xs leading-5 text-slate-600 lg:col-span-1">
                    <p className="mb-1 font-semibold text-slate-500 lg:hidden">{M.period}</p>
                    <p>
                      <span className="mr-1 text-slate-500">{M.rentalStart}:</span>
                      <time dateTime={r.startAt}>{formatDateTime(r.startAt)}</time>
                    </p>
                    <p>
                      <span className="mr-1 text-slate-500">{M.rentalEnd}:</span>
                      <time dateTime={r.endAt}>{formatDateTime(r.endAt)}</time>
                    </p>
                  </div>
                  <div className="min-w-0 lg:justify-self-center">
                    <OperationalBadge value={r.status} />
                  </div>
                  <Link
                    className="inline-flex min-h-11 items-center justify-center justify-self-end rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-primary transition hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-primary"
                    href={`/facility-manager/rentals?rentalId=${r.id}`}
                  >
                    {M.view}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <PageControls
            label={M.rentals}
            offset={offset}
            count={list.data.items.length}
            total={list.data.total}
            onChange={setOffset}
          />
        </>
      )}
    </div>
  );
}
function Detail({ facilityId, id }: { facilityId: string; id: string }) {
  const key = useManagerKey();
  const query = useQuery({
    queryKey: [...key, "rental", facilityId, id],
    queryFn: () => api.rentals.facilityDetail(facilityId, id),
  });
  const payments = useQuery({
    queryKey: [...key, "rental-payments", facilityId, id],
    queryFn: () => api.rentals.facilityPayments(facilityId, id, { limit: 20, offset: 0 }),
  });
  const appointments = useQuery({
    queryKey: [...key, "rental-return-appointments", facilityId, id],
    queryFn: () =>
      api.appointments.listFacility(facilityId, { appointmentType: APPOINTMENT_TYPES.CHECK_OUT }),
  });
  const checkout = appointments.data?.find(
    (item) => item.rentalId === id && ["CONFIRMED", "COMPLETED"].includes(item.status),
  );
  const inspections = useQuery({
    queryKey: [...key, "rental-return-inspection", checkout?.id],
    queryFn: () => api.inspections.forAppointment(checkout?.id ?? ""),
    enabled: Boolean(checkout),
  });
  if (query.isPending) return <LoadingState variant="detail" />;
  if (query.isError) return <ErrorState message={M.loadingError} onRetry={() => query.refetch()} />;
  const r = query.data;
  return (
    <div className="space-y-5">
      <OperationalBackLink href="/facility-manager/rentals">{M.back}</OperationalBackLink>
      <section className="space-y-4 rounded-xl border bg-white p-5">
        <h2 className="text-xl font-bold">
          {r.customer.name} · {formatReference(r.bookingCode, "BK")}
        </h2>
        <OperationalBadge value={r.status} />
        <p>
          {r.customer.email} · {r.customer.phone}
        </p>
        <p>
          {r.unit.code} · {r.unit.unitTypeName}
        </p>
        <p>
          {formatDateTime(r.startAt)} – {formatDateTime(r.endAt)}
        </p>
        {r.closedAt && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm">
            {M.actualReturnDate}: <strong>{formatDateTime(r.closedAt)}</strong>
          </p>
        )}
      </section>
      <SettlementSummary settlement={r.settlement} />
      <section className="space-y-3 rounded-xl border bg-white p-5">
        <h2 className="text-lg font-bold">{M.payments}</h2>
        {payments.isPending ? (
          <LoadingState variant="table" />
        ) : payments.isError ? (
          <ErrorState message={M.loadingError} onRetry={() => payments.refetch()} />
        ) : !payments.data.items.length ? (
          <EmptyState title={M.empty} description={M.emptyHint} />
        ) : (
          <ul className="divide-y">
            {payments.data.items.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <strong>
                    {p.type === "DEPOSIT_REFUND"
                      ? M.depositRefund
                      : p.type === "DEBT_COLLECTION"
                        ? M.debtCollection
                        : M.charge}
                  </strong>
                  <p className="text-xs text-muted">{formatReference(p.paymentCode, "TT")}</p>
                </div>
                <OperationalBadge
                  value={p.status}
                  label={M.paymentStatuses[p.status] ?? p.status}
                />
                <strong>{formatCurrency(Number(p.amount))}</strong>
                {p.refundAmount && (
                  <p className="w-full text-right text-xs text-muted">
                    {M.depositRefund}: {formatCurrency(Number(p.refundAmount))}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      {checkout && (
        <section className="space-y-3 rounded-xl border bg-white p-5">
          <h2 className="text-lg font-bold">{M.returnInspection}</h2>
          {inspections.isPending ? (
            <LoadingState variant="table" />
          ) : inspections.isError ? (
            <ErrorState message={M.loadingError} onRetry={() => void inspections.refetch()} />
          ) : inspections.data?.length ? (
            inspections.data.map((record) => (
              <article
                key={record.id}
                className="space-y-2 rounded-lg border border-line p-3 text-sm"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <strong>{record.unitCode}</strong>
                  <OperationalBadge value={record.status} />
                </div>
                <p>
                  {M.returnCondition}:{" "}
                  {record.condition ? M.returnConditions[record.condition] : M.missing}
                </p>
                <p className="whitespace-pre-wrap">{record.notes || M.missing}</p>
                {record.returnContext?.fees.map((fee) => (
                  <p key={fee.code}>
                    {fee.name} · {formatCurrency(fee.amount)}
                    {fee.note ? ` · ${fee.note}` : ""}
                  </p>
                ))}
              </article>
            ))
          ) : (
            <p className="text-sm text-muted">{M.noReturnInspection}</p>
          )}
        </section>
      )}
    </div>
  );
}
