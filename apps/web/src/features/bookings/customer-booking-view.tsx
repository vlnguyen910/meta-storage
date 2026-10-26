"use client";
import { CUSTOMER_WORKSPACE as M } from "@metastorage/shared";
import { CalendarClock, CircleDollarSign, MapPin, Warehouse } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent, Card as ShadcnCard } from "@/components/ui/card";
import { Card, PageHeader, StatusBadge } from "@/components/ui/display";
import { ListPagination } from "@/components/ui/list-pagination";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { customerRoutes } from "@/config/routes";
import { customerApiError } from "@/features/bookings/customer-error";
import { money } from "@/features/returns/integration-utils";
import { formatDateTime } from "@/lib/format";
import {
  useCancelCustomerBooking,
  useCustomerBooking,
  useCustomerBookings,
} from "./customer-bookings.hooks";

export function CustomerBookingList() {
  const query = useCustomerBookings();
  const [page, setPage] = useState(1);
  const pageSize = 6;
  useEffect(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
  }, [query.hasNextPage, query.isFetchingNextPage, query.fetchNextPage]);
  const bookings = query.data?.pages.flatMap((p) => p.items) ?? [];
  const safePage = Math.min(page, Math.max(1, Math.ceil(bookings.length / pageSize)));
  const visibleBookings = bookings.slice((safePage - 1) * pageSize, safePage * pageSize);
  const statusLabel: Record<string, string> = {
    CONFIRMED: "Đã xác nhận",
    CHECKED_IN: "Đã check-in",
    NO_SHOW: "Không đến",
    CANCELLED: "Đã hủy",
  };
  const statusClass: Record<string, string> = {
    CONFIRMED: "border-emerald-200 bg-emerald-50 text-emerald-800",
    CHECKED_IN: "border-sky-200 bg-sky-50 text-sky-800",
    NO_SHOW: "border-rose-200 bg-rose-50 text-rose-800",
    CANCELLED: "border-slate-200 bg-slate-100 text-slate-700",
  };
  return (
    <>
      <PageHeader
        title={M.bookings}
        description={M.appointment}
        action={
          <Link
            className="inline-flex min-h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            href={customerRoutes.newReservation}
          >
            {M.newBooking}
          </Link>
        }
      />
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState message={customerApiError(query.error)} onRetry={() => query.refetch()} />
      ) : (
        <>
          {!bookings.length && <p>{M.empty}</p>}
          <div className="grid gap-4">
            {visibleBookings.map((b) => (
              <ShadcnCard
                key={b.id}
                className="overflow-hidden border-slate-200/80 bg-white transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
              >
                <Link href={customerRoutes.reservation(b.id)}>
                  <CardContent className="space-y-4 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <strong className="text-lg font-bold tracking-tight text-slate-900">
                        {b.bookingCode ?? b.id}
                      </strong>
                      <Badge
                        className={
                          statusClass[b.status] ?? "border-slate-200 bg-slate-100 text-slate-700"
                        }
                      >
                        {statusLabel[b.status] ?? b.status}
                      </Badge>
                    </div>
                    <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                      <span className="flex items-center gap-2 sm:col-span-2">
                        <Warehouse className="size-4 text-primary" aria-hidden="true" />
                        {b.facility.name} · {b.unitType.name} · {b.unitType.sizeLabel}
                      </span>
                      <span className="flex items-center gap-2">
                        <MapPin className="size-4 text-slate-400" aria-hidden="true" />
                        {b.facility.address}
                      </span>
                      <span className="flex items-center gap-2">
                        <CalendarClock className="size-4 text-slate-400" aria-hidden="true" />
                        {formatDateTime(b.checkInSlotStart)}
                      </span>
                      <span
                        className={`flex items-center gap-2 ${b.paymentStatus === "SUCCEEDED" ? "text-emerald-700" : "text-slate-500"}`}
                      >
                        <CircleDollarSign className="size-4" aria-hidden="true" />
                        {b.paymentStatus === "SUCCEEDED" ? "Đã thanh toán" : b.paymentStatus}
                      </span>
                    </div>
                  </CardContent>
                </Link>
              </ShadcnCard>
            ))}
          </div>
          <ListPagination
            label={M.bookings}
            page={safePage}
            pageSize={pageSize}
            total={bookings.length}
            pending={query.isFetchingNextPage}
            onPageChange={setPage}
          />
          {query.isFetchNextPageError && <p role="alert">{M.error}</p>}
        </>
      )}
    </>
  );
}

export function CustomerBookingDetail({ id }: { id: string }) {
  const query = useCustomerBooking(id);
  const cancel = useCancelCustomerBooking(id);
  const [qr, setQr] = useState<string>();
  const qrUrl = query.data?.confirmation?.qrUrl;
  useEffect(() => {
    setQr(undefined);
    let active = true;
    if (qrUrl)
      QRCode.toDataURL(qrUrl)
        .then((url) => {
          if (active) setQr(url);
        })
        .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [qrUrl]);
  if (query.isPending) return <LoadingState />;
  if (query.isError)
    return <ErrorState message={customerApiError(query.error)} onRetry={() => query.refetch()} />;
  const b = query.data;
  return (
    <>
      <PageHeader
        title={b.bookingCode ?? b.id}
        description={`${b.facility.name} · ${b.unitType.name}`}
      />
      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <StatusBadge value={b.status} />
          <p>{b.facility.address}</p>
          <p>
            {M.appointment}: {formatDateTime(b.checkInSlotStart)} –{" "}
            {formatDateTime(b.checkInSlotEnd)}
          </p>
          <p>
            {M.assigned}: {b.assignedUnit?.code ?? M.noUnit}
          </p>
          <p>
            {M.handover}: {b.handoverStage}
          </p>
          {b.rentalId && <Link href={customerRoutes.rental(b.rentalId)}>{M.viewRental}</Link>}
        </Card>
        <Card>
          <h2>{M.payment}</h2>
          <p>{b.paymentStatus}</p>
          <p>
            {M.monthlyRate}: {money(b.pricing.monthlyRateSnapshot)}
          </p>
          <p>
            {M.initialRent}: {money(b.pricing.rentalFeeAmount)}
          </p>
          <p>
            {M.deposit}: {money(b.pricing.depositAmount)}
          </p>
          <p>
            {M.total}: {money(b.pricing.totalAmount)}
          </p>
          {qr ? (
            <Image unoptimized src={qr} width={240} height={240} alt={M.qr} />
          ) : (
            <p>{M.noQr}</p>
          )}
        </Card>
      </div>
      <div className="my-5 flex flex-wrap gap-4">
        {b.status === "CONFIRMED" && (
          <Button
            variant="outline"
            disabled={cancel.isPending}
            onClick={() => {
              if (window.confirm(M.cancelConfirm)) cancel.mutate();
            }}
          >
            {M.cancel}
          </Button>
        )}
        <Link href={`${customerRoutes.supportNew}?bookingId=${encodeURIComponent(id)}`}>
          {M.newTicket}
        </Link>
        <Link href={customerRoutes.reservations}>{M.back}</Link>
      </div>
      {cancel.isError && <p role="alert">{customerApiError(cancel.error)}</p>}
    </>
  );
}
