import { ArrowRight, CalendarClock, UserRound, Warehouse } from "lucide-react";
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
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="min-w-0">
          <h2 className="break-words text-base font-bold text-slate-950">{b.contactName}</h2>
          <p className="mt-1 break-all font-mono text-xs text-slate-500">
            {returnFlow ? M.returnAppointment : b.bookingCode} · {b.contactPhone}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <OperationalBadge value={b.status} />
          {state !== b.status && <OperationalBadge value={state} />}
        </div>
      </div>
      <div
        className={`grid gap-4 px-5 py-4 text-sm sm:grid-cols-2 ${returnFlow ? "xl:grid-cols-3" : "xl:grid-cols-4"}`}
      >
        <div className="min-w-0">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs text-slate-500">
            <Warehouse size={14} aria-hidden="true" />
            {returnFlow ? M.rentalRef : M.unit}
          </p>
          <p className="break-words font-semibold text-slate-800">
            {b.assignedUnit?.physicalUnitCode ??
              (returnFlow ? b.rentalId?.slice(0, 8) : FLOW.unassigned)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {returnFlow ? M.openRentalRecordForUnit : b.unitTypeName}
          </p>
        </div>
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs text-slate-500">
            <CalendarClock size={14} aria-hidden="true" />
            {returnFlow ? M.returnSchedule : M.schedule}
          </p>
          <p className="font-medium text-slate-800">{formatDateTime(b.checkInSlotStart)}</p>
          <p className="mt-1 text-xs text-slate-500">{formatDateTime(b.checkInSlotEnd)}</p>
        </div>
        <div className="min-w-0">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs text-slate-500">
            <UserRound size={14} aria-hidden="true" />
            {M.staff}
          </p>
          {b.assignedStaff ? (
            <p className="break-words font-medium text-slate-800">{b.assignedStaff.name}</p>
          ) : (
            <OperationalBadge value="NEEDS_STAFF" label={M.missingStaff} />
          )}
        </div>
        {!returnFlow && (
          <div>
            <p className="mb-1.5 text-xs text-slate-500">{M.payment}</p>
            <OperationalBadge
              value={b.paidAt ? "SUCCEEDED" : "PAYMENT_PENDING"}
              label={b.paidAt ? M.paymentRecorded : M.noPayment}
            />
            <p className="mt-1.5 font-semibold tabular-nums text-slate-900">
              <Currency value={b.totalAmount} />
            </p>
          </div>
        )}
      </div>
      {b.status === "CHECKED_IN" && !b.assignedStaff && (
        <p className="mx-5 mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {M.checkedInUnassigned}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-3">
        <Button variant="outline" onClick={onViewDetails} className="min-h-10 text-sm">
          {M.details}
        </Button>
        {canAssign && b.assignedUnit && !returnFlow && (
          <Link
            href={returnFlow ? url : `${url}&view=assign&bookingId=${b.id}`}
            className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 hover:border-primary hover:text-primary"
          >
            {FLOW.reassign}
          </Link>
        )}
        {canAssign && (
          <Button
            variant={b.assignedStaff ? "outline" : "primary"}
            onClick={onAssignStaff}
            className="min-h-10 text-sm"
          >
            {FLOW.staffAssign}
          </Button>
        )}
        <Link
          href={state === "NEEDS_UNIT" ? `${url}&view=assign&bookingId=${b.id}` : url}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3.5 text-sm font-semibold text-primary hover:bg-emerald-50"
        >
          {state === "NEEDS_UNIT" ? FLOW.assign : FLOW.monitor}
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
