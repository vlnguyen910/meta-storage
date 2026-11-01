"use client";

import { APPOINTMENT_TYPES, RENTAL_STATUSES, type RentalStatus } from "@metastorage/contracts";
import { formatReference } from "@metastorage/shared";
import { useQuery } from "@tanstack/react-query";
import { Phone, RefreshCw, Search, Warehouse } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ListPagination } from "@/components/ui/list-pagination";
import { OperationalBackLink, OperationalBadge } from "@/components/ui/operational";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DebtPanel, SettlementSummary } from "@/features/rentals/debt-panel";
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
  const key = useManagerKey();
  const selected = useSearchParams().get("rentalId");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<RentalStatus | "">("ACTIVE");
  const [offset, setOffset] = useState(0);
  const pageSize = 10;

  const list = useQuery({
    queryKey: [...key, "rentals", facilityId, search, status, offset],
    enabled: !selected,
    queryFn: () =>
      api.rentals.facilityList(facilityId, {
        search: search || undefined,
        status: status || undefined,
        limit: pageSize,
        offset,
      }),
  });

  if (selected) return <Detail facilityId={facilityId} id={selected} />;

  return (
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-md">
          <Search size={16} className="absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder={M.search}
            value={search}
            maxLength={200}
            onChange={(e) => {
              setSearch(e.target.value);
              setOffset(0);
            }}
            className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 transition-colors focus:border-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">
            {M.status}:
          </span>
          <Select
            value={status || "ALL"}
            onValueChange={(val) => {
              setStatus(val === "ALL" ? "" : (val as RentalStatus));
              setOffset(0);
            }}
          >
            <SelectTrigger className="h-10 w-44 rounded-lg border-slate-200 bg-white text-xs font-semibold">
              <SelectValue placeholder={M.status} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{M.all}</SelectItem>
              {RENTAL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {M.statuses[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={() => list.refetch()}
            loading={list.isFetching}
            className="h-10 px-3 text-xs font-medium"
            title="Làm mới"
          >
            <RefreshCw size={14} />
          </Button>
        </div>
      </div>

      {/* Main Data Table */}
      {list.isPending ? (
        <LoadingState variant="table" />
      ) : list.isError ? (
        <ErrorState message={M.loadingError} onRetry={() => list.refetch()} />
      ) : !list.data.items.length ? (
        <EmptyState title={M.empty} description={M.emptyHint} />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
            <Table>
              <TableHeader className="border-b border-slate-200 bg-slate-50/80">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[35%] py-3 pl-5 text-xs font-bold uppercase tracking-wider text-slate-600">
                    {M.customerDetails}
                  </TableHead>
                  <TableHead className="w-[35%] py-3 text-xs font-bold uppercase tracking-wider text-slate-600">
                    {M.period}
                  </TableHead>
                  <TableHead className="w-[15%] py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-600">
                    {M.status}
                  </TableHead>
                  <TableHead className="w-[15%] py-3 pr-5 text-right text-xs font-bold uppercase tracking-wider text-slate-600">
                    {M.action}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.items.map((r) => (
                  <TableRow key={r.id} className="transition-colors hover:bg-slate-50/70">
                    <TableCell className="py-3.5 pl-5">
                      <div className="space-y-1">
                        <strong className="block text-sm font-bold text-slate-900">
                          {r.customer.name || M.missing}
                        </strong>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-600">
                            {formatReference(r.bookingCode, "BK")}
                          </span>
                          <span className="flex items-center gap-1 text-xs font-medium text-slate-700">
                            <Warehouse size={13} className="text-slate-400" />
                            <span>
                              {M.unit}: <strong className="text-slate-900">{r.unit.code}</strong>
                            </span>
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3.5 text-xs text-slate-700">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-slate-400">{M.rentalStart}:</span>
                          <span className="font-semibold text-slate-800">
                            {formatDateTime(r.startAt)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-slate-400">{M.rentalEnd}:</span>
                          <span className="font-semibold text-slate-800">
                            {formatDateTime(r.endAt)}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3.5 text-center">
                      <OperationalBadge value={r.status} />
                    </TableCell>
                    <TableCell className="py-3.5 pr-5 text-right">
                      <Link
                        className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:border-primary hover:bg-emerald-50/40 hover:text-primary"
                        href={`/facility-manager/rentals?rentalId=${r.id}`}
                      >
                        {M.view}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ListPagination
            label={M.rentals}
            unitLabel="hợp đồng thuê"
            page={Math.floor(offset / pageSize) + 1}
            pageSize={pageSize}
            total={list.data.total}
            onPageChange={(page) => setOffset((page - 1) * pageSize)}
            pending={list.isFetching}
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

      <Card className="border-slate-200 bg-white shadow-2xs">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50 px-5 py-3.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-base font-bold text-slate-900">{r.customer.name}</h2>
            <span className="rounded bg-slate-200/80 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700">
              {formatReference(r.bookingCode, "BK")}
            </span>
          </div>
          <OperationalBadge value={r.status} />
        </CardHeader>

        <CardContent className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              {M.contact}
            </p>
            <p className="truncate font-semibold text-slate-900">{r.customer.email}</p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
              <Phone size={12} className="text-slate-400" />
              {r.customer.phone}
            </p>
          </div>

          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              {M.unit}
            </p>
            <p className="truncate font-bold text-slate-900">{r.unit.code}</p>
            <p className="mt-0.5 text-xs text-slate-500">{r.unit.unitTypeName}</p>
          </div>

          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              {M.period}
            </p>
            <p className="text-xs font-semibold text-slate-800">{formatDateTime(r.startAt)}</p>
            <p className="mt-0.5 text-xs text-slate-500">đến {formatDateTime(r.endAt)}</p>
          </div>

          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              {M.actualReturnDate}
            </p>
            {r.closedAt ? (
              <span className="font-semibold text-emerald-800">{formatDateTime(r.closedAt)}</span>
            ) : (
              <span className="text-xs text-slate-500">—</span>
            )}
          </div>
        </CardContent>
      </Card>

      <SettlementSummary settlement={r.settlement} />
      {r.status === "CLOSED" && <DebtPanel rentalId={id} />}

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
        <h2 className="text-base font-bold text-slate-900">{M.payments}</h2>
        {payments.isPending ? (
          <LoadingState variant="table" />
        ) : payments.isError ? (
          <ErrorState message={M.loadingError} onRetry={() => payments.refetch()} />
        ) : !payments.data.items.length ? (
          <EmptyState title={M.empty} description={M.emptyHint} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {payments.data.items.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
              >
                <div>
                  <strong className="text-slate-900">
                    {p.type === "DEPOSIT_REFUND"
                      ? M.depositRefund
                      : p.type === "DEBT_COLLECTION"
                        ? M.debtCollection
                        : M.charge}
                  </strong>
                  <p className="font-mono text-xs text-slate-500">
                    {formatReference(p.paymentCode, "TT")}
                  </p>
                </div>
                <OperationalBadge
                  value={p.status}
                  label={M.paymentStatuses[p.status] ?? p.status}
                />
                <strong className="tabular-nums text-slate-900 font-bold">
                  {formatCurrency(Number(p.amount))}
                </strong>
                {p.refundAmount && (
                  <p className="w-full text-right text-xs text-slate-500">
                    {M.depositRefund}: {formatCurrency(Number(p.refundAmount))}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {checkout && (
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <h2 className="text-base font-bold text-slate-900">{M.returnInspection}</h2>
          {inspections.isPending ? (
            <LoadingState variant="table" />
          ) : inspections.isError ? (
            <ErrorState message={M.loadingError} onRetry={() => void inspections.refetch()} />
          ) : inspections.data?.length ? (
            inspections.data.map((record) => (
              <article
                key={record.id}
                className="space-y-2 rounded-lg border border-slate-200 p-3.5 text-sm"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <strong className="text-slate-900">{record.unitCode}</strong>
                  <OperationalBadge value={record.status} />
                </div>
                <p className="text-slate-700">
                  {M.returnCondition}:{" "}
                  <span className="font-medium">
                    {record.condition ? M.returnConditions[record.condition] : M.missing}
                  </span>
                </p>
                <p className="whitespace-pre-wrap text-slate-600 text-xs">
                  {record.notes || M.missing}
                </p>
                {record.returnContext?.fees.map((fee) => (
                  <p key={fee.code} className="text-xs text-slate-700">
                    {fee.name} · {formatCurrency(fee.amount)}
                    {fee.note ? ` · ${fee.note}` : ""}
                  </p>
                ))}
              </article>
            ))
          ) : (
            <p className="text-sm text-slate-500">{M.noReturnInspection}</p>
          )}
        </section>
      )}
    </div>
  );
}
