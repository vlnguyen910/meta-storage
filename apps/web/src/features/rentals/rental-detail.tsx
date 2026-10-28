"use client";

import {
  Calendar,
  CalendarCheck,
  CheckCircle2,
  Clock,
  HelpCircle,
  MapPin,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/display";
import { OperationalBackLink } from "@/components/ui/operational";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { formatDate } from "@/lib/format";
import { useRental } from "./hooks";
import { RentalPayments } from "./rental-records";
import { RENTAL_MESSAGES as M } from "./rentals.messages";

function remainingLabel(endAt: string): string {
  const diffDays = Math.ceil((new Date(endAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return `Đã quá hạn ${Math.abs(diffDays)} ngày`;
  if (diffDays === 0) return "Hết hạn hôm nay";
  return `Còn ${diffDays} ngày`;
}

export function RentalDetail({ rentalId }: { rentalId: string }) {
  const query = useRental(rentalId);

  if (query.isPending) return <LoadingState variant="detail" />;
  if (query.isError)
    return <ErrorState message={M.notFoundOrForbidden} onRetry={() => query.refetch()} />;

  const r = query.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <OperationalBackLink href="/customer/storage">{M.backToStorage}</OperationalBackLink>
        <Link
          href={`/customer/support/new?bookingId=${encodeURIComponent(r.bookingId)}`}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900"
        >
          <HelpCircle className="size-3.5 text-primary" />
          <span>{M.support}</span>
        </Link>
      </div>

      <Card className="rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="inline-block rounded-md border border-slate-200/70 bg-slate-100 px-2.5 py-0.5 font-mono text-xs font-bold tracking-wider text-slate-600 uppercase">
              {r.bookingCode}
            </span>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              {r.unitType.name.includes(r.unitType.sizeLabel)
                ? r.unitType.name
                : `${r.unitType.name} · ${r.unitType.sizeLabel}`}
            </h2>
            <p className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-500">
              <MapPin size={15} className="shrink-0 text-slate-400" />
              <span>{r.facility.address}</span>
            </p>
          </div>
          <StatusBadge value={r.status} />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3.5 border-t border-slate-100 pt-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-3.5 rounded-xl border border-slate-100 bg-slate-50/70 p-4 transition-all hover:bg-slate-50">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-100/70 text-[#165f4d]">
              <Calendar size={20} />
            </div>
            <div>
              <span className="block text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                {M.startDate}
              </span>
              <strong className="text-sm font-bold text-slate-900">{formatDate(r.startAt)}</strong>
            </div>
          </div>

          <div className="flex items-center gap-3.5 rounded-xl border border-slate-100 bg-slate-50/70 p-4 transition-all hover:bg-slate-50">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-100/70 text-[#165f4d]">
              <CalendarCheck size={20} />
            </div>
            <div>
              <span className="block text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                {M.endDate}
              </span>
              <strong className="text-sm font-bold text-slate-900">{formatDate(r.endAt)}</strong>
            </div>
          </div>

          <div className="flex items-center gap-3.5 rounded-xl border border-slate-100 bg-slate-50/70 p-4 transition-all hover:bg-slate-50">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-sky-100/70 text-sky-800">
              <Warehouse size={20} />
            </div>
            <div>
              <span className="block text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                {M.unitLabel}
              </span>
              <strong className="font-mono text-sm font-bold text-slate-900">
                {r.storageUnit?.code ?? M.notAssigned}
              </strong>
            </div>
          </div>

          <div className="flex items-center gap-3.5 rounded-xl border border-slate-100 bg-slate-50/70 p-4 transition-all hover:bg-slate-50">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-100/70 text-emerald-800">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <span className="block text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                {M.bookingStatus}
              </span>
              <strong className="text-sm font-bold text-slate-900">{r.bookingStatus}</strong>
            </div>
          </div>
        </div>

        {/* Thời gian đến hạn trả kho */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950">
          <div>
            <span className="block text-xs font-bold uppercase tracking-wide text-amber-800">
              {M.remainingTime}
            </span>
            <strong className="mt-1 block text-base font-bold text-amber-950">
              {remainingLabel(r.endAt)}
            </strong>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-white/80 border border-amber-200/60 px-3 py-1.5 rounded-lg shadow-2xs">
            <Clock size={14} className="text-amber-700" />
            <span>Hạn dự kiến: {formatDate(r.endAt)}</span>
          </div>
        </div>
      </Card>

      <RentalPayments rentalId={rentalId} />
    </div>
  );
}
