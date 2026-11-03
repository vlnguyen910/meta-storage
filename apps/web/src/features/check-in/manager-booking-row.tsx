import { ArrowRight, CalendarClock, Phone, UserRound, Warehouse } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Currency } from "@/components/ui/display";
import { OperationalBadge } from "@/components/ui/operational";
import { FLOW } from "@/features/facility-flow/flow.messages";
import { formatDateTime } from "@/lib/format";
import { MANAGER_BOOKING_ROW as M } from "./manager-booking-row.messages";
import type { ManagerBookingRowProps } from "./manager-booking-row.types";

export function ManagerBookingRow({
  booking: b,
  state,
  canAssign,
  onAssignStaff,
  onViewDetails,
}: ManagerBookingRowProps) {
  const returnFlow = b.appointmentType === "CHECK_OUT";
  const url =
    returnFlow && b.rentalId
      ? `/facility-manager/rentals?rentalId=${encodeURIComponent(b.rentalId)}`
      : `/facility-manager/check-in?appointmentId=${encodeURIComponent(b.id)}`;

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs transition-colors hover:border-slate-300">
      {/* Header Row: Contact & Status */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-100 bg-slate-50/50 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-bold text-slate-900">{b.contactName}</h2>
          <span className="rounded bg-slate-200/80 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700">
            {returnFlow ? M.returnAppointment : b.bookingCode}
          </span>
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <Phone size={12} className="text-slate-400" aria-hidden="true" />
            {b.contactPhone}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <OperationalBadge value={b.status} />
          {state !== b.status && <OperationalBadge value={state} />}
        </div>
      </div>

      {/* Metadata Columns */}
      <div
        className={`grid gap-3 px-4 py-3 text-xs sm:grid-cols-2 ${returnFlow ? "xl:grid-cols-3" : "xl:grid-cols-4"}`}
      >
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="grid size-7 shrink-0 place-items-center rounded bg-slate-100 text-slate-500">
            <Warehouse size={14} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              {returnFlow ? M.rentalRef : M.unit}
            </p>
            <p className="truncate font-bold text-slate-800">
              {b.assignedUnit?.physicalUnitCode ??
                (returnFlow ? b.rentalId?.slice(0, 8) : FLOW.unassigned)}
            </p>
            <p className="truncate text-[11px] text-slate-500">
              {returnFlow ? M.openRentalRecordForUnit : b.unitTypeName}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 items-start gap-2.5">
          <div className="grid size-7 shrink-0 place-items-center rounded bg-slate-100 text-slate-500">
            <CalendarClock size={14} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              {returnFlow ? M.returnSchedule : M.schedule}
            </p>
            <p className="font-semibold text-slate-800">{formatDateTime(b.checkInSlotStart)}</p>
            <p className="text-[11px] text-slate-500">{formatDateTime(b.checkInSlotEnd)}</p>
          </div>
        </div>

        <div className="flex min-w-0 items-start gap-2.5">
          <div className="grid size-7 shrink-0 place-items-center rounded bg-slate-100 text-slate-500">
            <UserRound size={14} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              {M.staff}
            </p>
            {b.assignedStaff ? (
              <p className="truncate font-semibold text-slate-800">{b.assignedStaff.name}</p>
            ) : (
              <OperationalBadge value="NEEDS_STAFF" label={M.missingStaff} />
            )}
          </div>
        </div>

        {!returnFlow && (
          <div className="flex min-w-0 items-start gap-2.5">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                {M.payment}
              </p>
              <p className="font-bold tabular-nums text-slate-900">
                <Currency value={b.totalAmount} />
              </p>
              <div className="mt-0.5">
                <OperationalBadge
                  value={b.paidAt ? "SUCCEEDED" : "PAYMENT_PENDING"}
                  label={b.paidAt ? M.paymentRecorded : M.noPayment}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {b.status === "CHECKED_IN" && !b.assignedStaff && (
        <div className="mx-4 mb-2.5 rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
          {M.checkedInUnassigned}
        </div>
      )}

      {/* Action Buttons Row */}
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/40 px-4 py-2">
        <Button
          variant="outline"
          onClick={onViewDetails}
          className="h-8 px-3 text-xs font-medium text-slate-700 hover:bg-slate-100"
        >
          {M.details}
        </Button>
        {canAssign && b.assignedUnit && !returnFlow && (
          <Link
            href={returnFlow ? url : `${url}&view=assign&bookingId=${b.id}`}
            className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:border-primary hover:text-primary"
          >
            {FLOW.reassign}
          </Link>
        )}
        {canAssign && (
          <Button
            variant={b.assignedStaff ? "outline" : "primary"}
            onClick={onAssignStaff}
            className="h-8 px-3 text-xs font-medium"
          >
            {FLOW.staffAssign}
          </Button>
        )}
        <Link
          href={state === "NEEDS_UNIT" ? `${url}&view=assign&bookingId=${b.id}` : url}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-50 px-3 text-xs font-semibold text-primary transition-colors hover:bg-emerald-100"
        >
          {state === "NEEDS_UNIT" ? FLOW.assign : FLOW.monitor}
          <ArrowRight size={13} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
