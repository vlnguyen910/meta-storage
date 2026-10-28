"use client";

import {
  ArrowLeft,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  Clock,
  HelpCircle,
  Info,
  MapPin,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { Suspense, useState } from "react";
import { Card, PageHeader, StatusBadge } from "@/components/ui/display";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { customerRoutes } from "@/config/routes";
import { CustomerReturnPanel } from "@/features/returns/customer-return-panel";
import { useRentalReturns } from "@/features/returns/hooks";
import { F3 } from "@/features/returns/integration.messages";
import { formatDate } from "@/lib/format";
import { useRental } from "./hooks";
import { RentalFinancePanel } from "./rental-finance-panel";
import { RENTAL_MESSAGES as M } from "./rentals.messages";

function remainingLabel(value: string) {
  const remaining = Date.parse(value) - Date.now();
  if (remaining <= 0)
    return `Đã quá hạn ${Math.max(1, Math.ceil(Math.abs(remaining) / 86_400_000))} ngày`;
  const days = Math.floor(remaining / 86_400_000);
  if (days > 0) return `Còn ${days} ngày`;
  return `Còn ${Math.max(1, Math.ceil(remaining / 3_600_000))} giờ`;
}

export function RentalDetail({ rentalId }: { rentalId: string }) {
  const query = useRental(rentalId);
  const returnsQuery = useRentalReturns(rentalId);
  const [hasActiveRenewal, setHasActiveRenewal] = useState(false);

  if (query.isLoading) return <LoadingState variant="detail" />;
  if (query.isError || !query.data) {
    return <ErrorState message={M.notFoundOrForbidden} onRetry={() => query.refetch()} />;
  }
  const rental = query.data;

  const returnRequests = returnsQuery.data ?? [];
  const openReturnRequest = returnRequests.find((request) =>
    ["PENDING", "CONFIRMED", "INSPECTING", "FAILED"].includes(request.status),
  );
  const hasActiveReturn =
    Boolean(openReturnRequest) || rental.status === "RETURN_PENDING" || rental.status === "CLOSED";
  return (
    <>
      <PageHeader
        eyebrow="Kho của tôi"
        title={rental.bookingCode}
        description={`${rental.facility.name} · ${rental.unitType.name}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href={`${customerRoutes.supportNew}?bookingId=${encodeURIComponent(rental.bookingId)}`}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <HelpCircle size={15} />
              <span>Gửi yêu cầu hỗ trợ</span>
            </Link>
            <Link
              href={customerRoutes.rentals}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <ArrowLeft size={15} />
              <span>{M.backToStorage}</span>
            </Link>
          </div>
        }
      />
      <Card className="rounded-2xl border border-slate-200/80 p-6 shadow-2xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="inline-block rounded-md border border-slate-200/70 bg-slate-100 px-2.5 py-0.5 font-mono text-xs font-bold tracking-wider text-slate-600 uppercase">
              {rental.bookingCode}
            </span>
            <h2 className="mt-2 text-2xl font-bold text-ink">
              {rental.unitType.name} · {rental.unitType.sizeLabel}
            </h2>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
              <MapPin size={15} className="shrink-0 text-slate-400" />
              <span>{rental.facility.address}</span>
            </p>
          </div>
          <StatusBadge value={rental.status} />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3.5 border-t border-slate-100 pt-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-3.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-emerald-100/70 text-primary">
              <Calendar size={18} />
            </div>
            <div>
              <span className="block text-[11px] font-semibold tracking-wider text-muted uppercase">
                {M.startDate}
              </span>
              <strong className="text-sm font-bold text-ink">{formatDate(rental.startAt)}</strong>
            </div>
          </div>

          <div className="flex items-center gap-3.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-emerald-100/70 text-primary">
              <CalendarCheck size={18} />
            </div>
            <div>
              <span className="block text-[11px] font-semibold tracking-wider text-muted uppercase">
                {M.endDate}
              </span>
              <strong className="text-sm font-bold text-ink">
                {formatDate(rental.expectedEndAt)}
              </strong>
            </div>
          </div>

          <div className="flex items-center gap-3.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-sky-100/70 text-sky-800">
              <Warehouse size={18} />
            </div>
            <div>
              <span className="block text-[11px] font-semibold tracking-wider text-muted uppercase">
                {M.unitLabel}
              </span>
              <strong className="font-mono text-sm font-bold text-ink">
                {rental.physicalUnit?.code ?? M.notAssigned}
              </strong>
            </div>
          </div>

          <div className="flex items-center gap-3.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-emerald-100/70 text-emerald-800">
              <CheckCircle2 size={18} />
            </div>
            <div>
              <span className="block text-[11px] font-semibold tracking-wider text-muted uppercase">
                {M.bookingStatus}
              </span>
              <strong className="text-sm font-bold text-ink">
                {F3.status[rental.bookingStatus as keyof typeof F3.status] ?? rental.bookingStatus}
              </strong>
            </div>
          </div>
        </div>

        {/* Ô thời gian đến hạn trả kho xếp ngay dưới 4 icon nhỏ trạng thái kho */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm text-amber-950">
          <div>
            <span className="block text-xs font-semibold uppercase tracking-wide text-amber-800">
              {M.remainingTime}
            </span>
            <strong className="mt-1 block text-base font-bold text-amber-950">
              {remainingLabel(rental.expectedEndAt)}
            </strong>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
            <Clock size={15} />
            <span>Hạn dự kiến: {formatDate(rental.expectedEndAt)}</span>
          </div>
        </div>
      </Card>

      <div className="mt-6 flex items-start gap-3.5 rounded-2xl border border-emerald-200/80 bg-emerald-50/60 p-4 text-emerald-950 shadow-2xs">
        <Info size={19} className="mt-0.5 shrink-0 text-primary" />
        <div>
          <strong className="block text-sm font-bold">{M.permissionsTitle}</strong>
          <p className="mb-0 mt-0.5 text-xs leading-relaxed text-emerald-800">
            {F3.customerReturnHelp}
          </p>
        </div>
      </div>

      {/* Renewal section: hidden when return is in progress or storage is closed */}
      <Suspense>
        <RentalFinancePanel
          rentalId={rentalId}
          rentalStatus={rental.status}
          rentalExpectedEndAt={rental.expectedEndAt}
          hasActiveReturn={hasActiveReturn}
          onActiveRenewalChange={setHasActiveRenewal}
        />
      </Suspense>

      {/* Return section: hidden when renewal is active / in progress */}
      {!hasActiveRenewal && (
        <CustomerReturnPanel rentalId={rental.id} rentalStatus={rental.status} />
      )}
    </>
  );
}
