"use client";
import { RENTAL_STATUSES, type RentalStatus } from "@metastorage/contracts";
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
import { api } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { ManagerTabFrame } from "./manager-tab-frame";
import { MANAGER_TABS as M } from "./manager-tabs.messages";
import { useManagerKey } from "./use-manager-tabs";
export function ManagerRentalsScreen() {
  return (
    <ManagerTabFrame title={M.rentals} description={M.rentalsHint}>
      {(facilityId) => <Rentals facilityId={facilityId} />}
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
          <ul className="divide-y rounded-xl border bg-white">
            {list.data.items.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <strong>{r.customer.name}</strong>
                  <p>
                    {r.bookingCode} · {r.unit.code}
                  </p>
                  <p>
                    {formatDateTime(r.startAt)} – {formatDateTime(r.endAt)}
                  </p>
                </div>
                <OperationalBadge value={r.status} />
                <Link
                  className="font-semibold text-primary underline"
                  href={`/facility-manager/rentals?rentalId=${r.id}`}
                >
                  {M.view}
                </Link>
              </li>
            ))}
          </ul>
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
  if (query.isPending) return <LoadingState variant="detail" />;
  if (query.isError) return <ErrorState message={M.loadingError} onRetry={() => query.refetch()} />;
  const r = query.data;
  return (
    <div className="space-y-5">
      <OperationalBackLink href="/facility-manager/rentals">{M.back}</OperationalBackLink>
      <section className="space-y-4 rounded-xl border bg-white p-5">
        <h2 className="text-xl font-bold">
          {r.customer.name} · {r.bookingCode}
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
      </section>
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
              <li key={p.id} className="flex flex-wrap justify-between gap-2 py-3">
                <span>{p.paymentCode}</span>
                <OperationalBadge value={p.status} />
                <strong>{formatCurrency(Number(p.amount))}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
