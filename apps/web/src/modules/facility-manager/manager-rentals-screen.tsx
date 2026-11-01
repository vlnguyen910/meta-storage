"use client";

import { APPOINTMENT_TYPES, RENTAL_STATUSES, type RentalStatus } from "@metastorage/contracts";
import { formatReference } from "@metastorage/shared";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarClock,
  FileCheck,
  Mail,
  Phone,
  Receipt,
  RefreshCw,
  Search,
  UserRound,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="space-y-6">
      <OperationalBackLink href="/facility-manager/rentals">{M.back}</OperationalBackLink>

      {/* Main Rental Information Card */}
      <Card className="border-slate-200 bg-white shadow-2xs">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50 px-5 py-3.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-base font-bold text-slate-900">{r.customer.name}</h2>
            <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700">
              {formatReference(r.bookingCode, "BK")}
            </span>
          </div>
          <OperationalBadge value={r.status} />
        </CardHeader>

        <CardContent className="grid gap-6 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {/* Column 1: Customer Contact Info */}
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
              <UserRound size={13} className="text-slate-400" />
              {M.customer}
            </p>
            <div className="space-y-1.5 text-xs">
              <p className="flex items-center gap-2 font-semibold text-slate-800">
                <Mail size={13} className="shrink-0 text-slate-400" />
                <span className="truncate">{r.customer.email || M.missing}</span>
              </p>
              {r.customer.phone && (
                <p className="flex items-center gap-2 font-medium text-slate-600">
                  <Phone size={13} className="shrink-0 text-slate-400" />
                  <span>{r.customer.phone}</span>
                </p>
              )}
            </div>
          </div>

          {/* Column 2: Storage Unit Details */}
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Warehouse size={13} className="text-slate-400" />
              {M.unit}
            </p>
            <div className="space-y-1 text-xs">
              <p className="text-sm font-bold text-slate-900">{r.unit.code}</p>
              <p className="text-slate-500">{r.unit.unitTypeName}</p>
            </div>
          </div>

          {/* Column 3: Rental Period & Return */}
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
              <CalendarClock size={13} className="text-slate-400" />
              {M.period}
            </p>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-14 text-slate-400">{M.rentalStart}:</span>
                <span className="font-semibold text-slate-800">{formatDateTime(r.startAt)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-14 text-slate-400">{M.rentalEnd}:</span>
                <span className="font-semibold text-slate-800">{formatDateTime(r.endAt)}</span>
              </div>
              {r.closedAt && (
                <div className="mt-2 flex items-center gap-1.5 border-t border-slate-100 pt-1.5 text-emerald-800">
                  <span className="w-14 text-slate-500 font-medium">{M.actualReturnDate}:</span>
                  <span className="font-bold">{formatDateTime(r.closedAt)}</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Settlement Summary (if available) */}
      <SettlementSummary settlement={r.settlement} />

      {/* Return Debt Panel (only if closed) */}
      {r.status === "CLOSED" && <DebtPanel rentalId={id} />}

      {/* Payments History Card with Structured Table */}
      <Card className="border-slate-200 bg-white shadow-2xs">
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <CardTitle className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Receipt size={16} className="text-primary" />
            {M.payments}
          </CardTitle>
          {payments.data?.items && payments.data.items.length > 0 && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
              {payments.data.items.length} giao dịch
            </span>
          )}
        </CardHeader>

        <CardContent className="p-0">
          {payments.isPending ? (
            <div className="p-5">
              <LoadingState variant="table" />
            </div>
          ) : payments.isError ? (
            <div className="p-5">
              <ErrorState message={M.loadingError} onRetry={() => payments.refetch()} />
            </div>
          ) : !payments.data.items.length ? (
            <div className="p-8 text-center text-xs text-slate-500">{M.noTransactions}</div>
          ) : (
            <Table>
              <TableHeader className="border-b border-slate-200 bg-slate-50/70">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[40%] py-2.5 pl-5 text-xs font-bold uppercase tracking-wider text-slate-600">
                    Khoản mục & Mã GD
                  </TableHead>
                  <TableHead className="w-[25%] py-2.5 text-xs font-bold uppercase tracking-wider text-slate-600">
                    Thời gian
                  </TableHead>
                  <TableHead className="w-[15%] py-2.5 text-center text-xs font-bold uppercase tracking-wider text-slate-600">
                    Trạng thái
                  </TableHead>
                  <TableHead className="w-[20%] py-2.5 pr-5 text-right text-xs font-bold uppercase tracking-wider text-slate-600">
                    Số tiền
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.data.items.map((p) => (
                  <TableRow key={p.id} className="transition-colors hover:bg-slate-50/60">
                    <TableCell className="py-3 pl-5">
                      <div className="space-y-0.5">
                        <strong className="block text-xs font-bold text-slate-900">
                          {p.type === "DEPOSIT_REFUND"
                            ? M.depositRefund
                            : p.type === "DEBT_COLLECTION"
                              ? M.debtCollection
                              : M.charge}
                        </strong>
                        <span className="font-mono text-[11px] text-slate-500">
                          {formatReference(p.paymentCode, "TT")}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3 text-xs text-slate-600">
                      {p.paidAt ? formatDateTime(p.paidAt) : formatDateTime(p.createdAt)}
                    </TableCell>
                    <TableCell className="py-3 text-center">
                      <OperationalBadge
                        value={p.status}
                        label={M.paymentStatuses[p.status] ?? p.status}
                      />
                    </TableCell>
                    <TableCell className="py-3 pr-5 text-right">
                      <strong className="font-mono text-xs font-bold text-slate-900 tabular-nums">
                        {formatCurrency(Number(p.amount))}
                      </strong>
                      {p.refundAmount && (
                        <span className="block text-[11px] text-slate-500">
                          {M.depositRefund}: {formatCurrency(Number(p.refundAmount))}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Return Inspection Record (if checkout exists) */}
      {checkout && (
        <Card className="border-slate-200 bg-white shadow-2xs">
          <CardHeader className="border-b border-slate-100 px-5 py-3.5">
            <CardTitle className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <FileCheck size={16} className="text-primary" />
              {M.returnInspection}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            {inspections.isPending ? (
              <LoadingState variant="table" />
            ) : inspections.isError ? (
              <ErrorState message={M.loadingError} onRetry={() => void inspections.refetch()} />
            ) : inspections.data?.length ? (
              <div className="space-y-3">
                {inspections.data.map((record) => (
                  <div
                    key={record.id}
                    className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
                      <span className="font-mono font-bold text-slate-900">{record.unitCode}</span>
                      <OperationalBadge value={record.status} />
                    </div>
                    <div className="space-y-1 text-slate-700">
                      <p>
                        <span className="text-slate-500">{M.returnCondition}:</span>{" "}
                        <span className="font-semibold text-slate-800">
                          {record.condition ? M.returnConditions[record.condition] : M.missing}
                        </span>
                      </p>
                      {record.notes && (
                        <p className="whitespace-pre-wrap text-slate-600">
                          <span className="text-slate-500">Ghi chú:</span> {record.notes}
                        </p>
                      )}
                      {record.returnContext?.fees && record.returnContext.fees.length > 0 && (
                        <div className="mt-2 border-t border-slate-200/60 pt-2">
                          <p className="font-semibold text-slate-600 mb-1">{M.returnFees}:</p>
                          {record.returnContext.fees.map((fee) => (
                            <p key={fee.code} className="text-slate-700">
                              {fee.name}:{" "}
                              <strong className="text-slate-900 font-mono">
                                {formatCurrency(fee.amount)}
                              </strong>
                              {fee.note ? ` (${fee.note})` : ""}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">{M.noReturnInspection}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
