"use client";
import { ArrowRight, CalendarClock, Check, Copy, Phone, UserRound, Warehouse } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { buttonClassName } from "@/components/ui/button";
import { OperationalBadge } from "@/components/ui/operational";
import { FLOW } from "@/features/facility-flow/flow.messages";
import { cn } from "@/lib/utils";
import { formatBookingAmount, formatBookingDateTime } from "./booking-display";
import { MANAGER_BOOKING_ROW as M } from "./manager-booking-row.messages";
import type { ManagerBookingRowProps } from "./manager-booking-row.types";

const actionClass =
  "min-h-9 rounded-lg px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const labelClass = "mb-0.5 text-xs font-medium text-slate-600";
const iconClass = "grid size-7 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary";

export function ManagerBookingRow({
  booking: b,
  state,
  canAssign,
  onAssignStaff,
  onViewDetails,
}: ManagerBookingRowProps) {
  const [copyFeedback, setCopyFeedback] = useState("");
  const returnFlow = b.appointmentType === "CHECK_OUT";
  const url =
    returnFlow && b.rentalId
      ? `/facility-manager/rentals?rentalId=${encodeURIComponent(b.rentalId)}`
      : `/facility-manager/check-in?appointmentId=${encodeURIComponent(b.id)}`;
  const canReassign = canAssign && Boolean(b.assignedUnit) && !returnFlow;
  const reassignHint = returnFlow
    ? M.returnUnitUnavailable
    : !canAssign
      ? M.assignmentUnavailable
      : M.unitRequired;

  async function copyBooking() {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(b.bookingCode);
      else {
        const input = document.createElement("textarea");
        input.value = b.bookingCode;
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        try {
          input.select();
          if (!document.execCommand("copy")) throw new Error("Copy unavailable");
        } finally {
          input.remove();
        }
      }
      setCopyFeedback(M.copied);
    } catch {
      setCopyFeedback(M.copyFailed);
    }
  }

  return (
    <article className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-surface text-ink shadow-2xs transition-colors hover:border-primary/30">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line px-4 py-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
          <h2 className="text-sm font-bold text-ink">{b.contactName}</h2>
          {returnFlow && (
            <span className="text-xs font-medium text-slate-600">{M.returnAppointment}</span>
          )}
          <span className="inline-flex items-center gap-1 rounded-md border border-line bg-slate-50 pl-2">
            <span className="select-all font-mono text-xs font-semibold tracking-wider text-slate-700">
              {b.bookingCode}
            </span>
            <button
              type="button"
              aria-label={M.copyBooking}
              title={copyFeedback || M.copyBooking}
              onClick={() => void copyBooking()}
              className="grid size-8 cursor-pointer place-items-center rounded-md text-slate-600 transition-colors hover:bg-primary-soft hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
            >
              {copyFeedback === M.copied ? (
                <Check size={13} aria-hidden="true" />
              ) : (
                <Copy size={13} aria-hidden="true" />
              )}
            </button>
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
            <Phone size={13} aria-hidden="true" />
            {b.contactPhone}
          </span>
          <span role="status" className="sr-only">
            {copyFeedback}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <OperationalBadge value={b.status} />
          {state !== b.status && !["NEEDS_STAFF", "PAYMENT_PENDING"].includes(state) && (
            <OperationalBadge value={state} />
          )}
        </div>
      </div>

      <div
        className={cn(
          "grid gap-x-5 gap-y-3 px-4 py-2.5 text-sm sm:grid-cols-2",
          returnFlow ? "xl:grid-cols-3" : "xl:grid-cols-4",
        )}
      >
        <div className="flex min-w-0 items-start gap-2">
          <div className={iconClass}>
            <Warehouse size={14} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className={labelClass}>{returnFlow ? M.rentalRef : M.unit}</p>
            <p className="truncate font-semibold text-ink" title={b.assignedUnit?.physicalUnitCode}>
              {b.assignedUnit?.physicalUnitCode ??
                (returnFlow ? b.rentalId?.slice(0, 8) : FLOW.unassigned)}
            </p>
            <p
              className="truncate text-xs font-medium text-slate-600"
              title={returnFlow ? M.openRentalRecordForUnit : b.unitTypeName}
            >
              {returnFlow ? M.openRentalRecordForUnit : b.unitTypeName}
            </p>
          </div>
        </div>
        <div className="flex min-w-0 items-start gap-2">
          <div className={iconClass}>
            <CalendarClock size={14} aria-hidden="true" />
          </div>
          <dl className="min-w-0 space-y-1 text-xs">
            <div>
              <dt className={labelClass}>{M.slotStart}</dt>
              <dd className="font-semibold tabular-nums text-ink">
                {formatBookingDateTime(b.checkInSlotStart)}
              </dd>
            </div>
            <div>
              <dt className="inline text-slate-600">{M.slotEnd}: </dt>
              <dd className="inline font-medium tabular-nums text-slate-700">
                {formatBookingDateTime(b.checkInSlotEnd)}
              </dd>
            </div>
          </dl>
        </div>
        <div className="flex min-w-0 items-start gap-2">
          <div className={iconClass}>
            <UserRound size={14} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className={labelClass}>{M.staff}</p>
            {b.assignedStaff ? (
              <p className="truncate font-semibold text-ink" title={b.assignedStaff.name}>
                {b.assignedStaff.name}
              </p>
            ) : (
              <OperationalBadge value="NEEDS_STAFF" label={M.missingStaff} />
            )}
          </div>
        </div>
        {!returnFlow && (
          <div className="min-w-0">
            <p className={labelClass}>{M.payment}</p>
            <p className="font-bold tabular-nums text-ink">{formatBookingAmount(b.totalAmount)}</p>
            <div className="mt-1">
              <OperationalBadge
                value={b.paidAt ? "SUCCEEDED" : "PAYMENT_PENDING"}
                label={b.paidAt ? M.paymentRecorded : M.noPayment}
              />
            </div>
          </div>
        )}
      </div>

      {b.status === "CHECKED_IN" && !b.assignedStaff && (
        <div className="mx-4 mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
          {M.checkedInUnassigned}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-slate-50/50 px-4 py-2">
        <button
          type="button"
          onClick={onViewDetails}
          className={cn(
            buttonClassName("outline"),
            actionClass,
            "border border-slate-300 bg-surface text-slate-700 hover:bg-slate-100",
          )}
        >
          {M.details}
        </button>
        <div className="flex flex-wrap items-center gap-2">
          {canReassign ? (
            <Link
              href={`${url}&view=assign&bookingId=${b.id}`}
              className={cn(
                actionClass,
                "inline-flex items-center border border-slate-300 bg-surface text-slate-700 transition-colors hover:border-primary hover:text-primary",
              )}
            >
              {FLOW.reassign}
            </Link>
          ) : (
            <span
              title={reassignHint}
              className="rounded-lg focus-visible:outline-2 focus-visible:outline-primary"
            >
              <button
                type="button"
                disabled
                className={cn(buttonClassName("outline"), actionClass, "pointer-events-none")}
              >
                {FLOW.reassign}
              </button>
            </span>
          )}
          <span
            title={canAssign ? undefined : M.assignmentUnavailable}
            className="rounded-lg focus-visible:outline-2 focus-visible:outline-primary"
          >
            <button
              type="button"
              disabled={!canAssign}
              onClick={onAssignStaff}
              className={cn(
                buttonClassName(
                  canAssign && !b.assignedStaff && state !== "NEEDS_UNIT" ? "primary" : "outline",
                ),
                actionClass,
                !canAssign && "pointer-events-none",
              )}
            >
              {FLOW.staffAssign}
            </button>
          </span>
          <Link
            href={state === "NEEDS_UNIT" ? `${url}&view=assign&bookingId=${b.id}` : url}
            className={cn(
              actionClass,
              "inline-flex min-w-32 items-center justify-center gap-1.5 border transition-colors",
              state === "NEEDS_UNIT"
                ? "border-primary bg-primary text-white hover:bg-primary-dark"
                : "border-slate-300 bg-surface text-primary hover:border-primary hover:bg-primary-soft",
            )}
          >
            {state === "NEEDS_UNIT" ? FLOW.assign : FLOW.monitor}
            <ArrowRight size={13} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}
