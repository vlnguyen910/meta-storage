"use client";
import { type BookingListItem, UserRole } from "@metastorage/contracts";
import {
  ArrowRight,
  Calendar,
  ClipboardCheck,
  Phone,
  Printer,
  RefreshCw,
  Search,
  UserCheck,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Currency } from "@/components/ui/display";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useAuthStore } from "@/features/auth/auth-store";
import { FLOW } from "@/features/facility-flow/flow.messages";
import {
  FlowButton as Button,
  FlowHeading,
  FlowHelp,
  inputClass,
  Panel,
  Pill,
  titleClass,
  UnitPlaceholder,
} from "@/features/facility-flow/flow-ui";
import { readiness, useDispatch } from "@/features/facility-flow/use-dispatch";
import { formatDateTime } from "@/lib/format";
import type { FacilityBookingsViewProps } from "./facility-bookings-view.types";
import { StaffAssignmentModal } from "./staff-assignment-modal";

const labels: Record<string, string> = {
  READY: FLOW.ready,
  NEEDS_UNIT: FLOW.needsUnit,
  NEEDS_STAFF: FLOW.needsStaff,
  TOO_EARLY: FLOW.early,
  NO_SHOW: FLOW.noShow,
  CHECKED_IN: FLOW.checkedIn,
  PAYMENT_PENDING: FLOW.unpaid,
  CANCELLED: FLOW.cancelled,
  INSPECTING: FLOW.inspecting,
  READY_HANDOVER: FLOW.readyHandover,
  SLOT_MISSING: FLOW.reasons.CHECKIN_SLOT_NOT_CONFIGURED ?? FLOW.notEligible,
};
export function FacilityBookingsView({ facilityId, facilityName }: FacilityBookingsViewProps) {
  const isStaff = useAuthStore((s) => s.session?.user.role) === UserRole.FACILITY_STAFF;
  const root = isStaff ? "/staff" : "/facility-manager";
  const d = useDispatch(facilityId, isStaff);
  const [staffBooking, setStaffBooking] = useState<BookingListItem | null>(null);
  return (
    <>
      <FlowHeading
        title={isStaff ? FLOW.staffTasks : FLOW.managerDispatchTitle}
        description={FLOW.dispatchDescription(facilityName ?? FLOW.noFacility)}
        actions={
          <div className="flex gap-2">
            <div className="rounded-lg bg-white px-4 py-2 text-xs shadow-sm">
              <p className="text-[#707975]">{FLOW.syncTime}</p>
              <strong>
                {d.query.dataUpdatedAt
                  ? new Date(d.query.dataUpdatedAt).toLocaleTimeString("vi-VN", {
                      timeZone: "Asia/Ho_Chi_Minh",
                    })
                  : "—"}
              </strong>
            </div>
            <Button variant="secondary" onClick={() => window.print()} icon={<Printer size={18} />}>
              {FLOW.print}
            </Button>
          </div>
        }
      />
      <FlowHelp />
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-7">
        {[
          { label: FLOW.total, value: d.bookings.length, icon: Calendar },
          { label: FLOW.needsUnit, value: d.count("NEEDS_UNIT"), icon: Warehouse },
          { label: FLOW.waiting, value: d.count("READY"), icon: UserCheck },
          { label: FLOW.inspecting, value: d.count("INSPECTING"), icon: ClipboardCheck },
          { label: FLOW.readyHandover, value: d.count("READY_HANDOVER"), icon: ClipboardCheck },
          {
            label: FLOW.needsStaff,
            value: d.bookings.filter((b) => !b.assignedStaff && b.status === "CONFIRMED").length,
            icon: ClipboardCheck,
          },
          { label: FLOW.pendingAccess, value: d.count("CHECKED_IN"), icon: ClipboardCheck },
        ].map(({ label, value, icon: Icon }) => (
          <Panel key={label}>
            <div className="flex items-center justify-between gap-1 text-[11px] uppercase tracking-wider text-[#707975]">
              <span>{label}</span>
              <Icon size={20} className="text-[#003b2f]" />
            </div>
            <p className={`${titleClass} mt-3 text-5xl leading-[56px]`}>{value}</p>
          </Panel>
        ))}
      </div>
      <Panel className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[180px] flex-1">
            <Search size={20} className="absolute left-3 top-3 text-[#707975]" />
            <input
              className={`${inputClass} pl-10`}
              aria-label={FLOW.searchLabel}
              placeholder={FLOW.search}
              value={d.search}
              onChange={(e) => d.setSearch(e.target.value)}
            />
          </div>
          <Button
            variant="secondary"
            onClick={() => d.query.refetch()}
            loading={d.query.isFetching}
            icon={<RefreshCw size={18} />}
          >
            {FLOW.refresh}
          </Button>
          {isStaff && (
            <Link
              href={`${root}/check-in`}
              className="rounded bg-[#003b2f] px-4 py-3 text-sm font-semibold text-white"
            >
              {isStaff ? FLOW.lookup : FLOW.monitor}
            </Link>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            "ALL",
            "NEEDS_UNIT",
            "NEEDS_STAFF",
            "READY",
            "INSPECTING",
            "READY_HANDOVER",
            "TOO_EARLY",
            "NO_SHOW",
            "CHECKED_IN",
          ].map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={d.filter === id}
              onClick={() => d.setFilter(id)}
              className={`rounded-md px-3 py-2 text-xs font-semibold ${d.filter === id ? "bg-[#003b2f] text-white" : "bg-[#f2f3ff] text-[#404945]"}`}
            >
              {id === "ALL" ? FLOW.all : labels[id]}{" "}
              <span className="ml-1 opacity-70">
                {id === "ALL" ? d.bookings.length : d.count(id)}
              </span>
            </button>
          ))}
        </div>
      </Panel>
      <p role="status" aria-live="polite" className="text-sm text-[#404945]">
        {d.query.isFetching ? FLOW.refreshing : FLOW.results(d.filtered.length, d.bookings.length)}
      </p>
      {d.query.isError && d.query.data && (
        <p role="alert" className="rounded bg-[#ffdcc3] p-3 text-[#6e3900]">
          {FLOW.staleData}
        </p>
      )}
      {d.query.isLoading ? (
        <LoadingState label={FLOW.loading} />
      ) : d.query.isError && !d.query.data ? (
        <ErrorState message={FLOW.listError} onRetry={() => d.query.refetch()} />
      ) : d.filtered.length === 0 ? (
        <Panel className="py-12 text-center">
          <Warehouse className="mx-auto mb-3 text-[#306858]" size={40} />
          <h2 className={`${titleClass} text-xl`}>{FLOW.noBookings}</h2>
          <p className="mt-2 text-[#707975]">{FLOW.noBookingsHint}</p>
          <Button
            className="mt-4"
            variant="secondary"
            onClick={() => {
              d.setFilter("ALL");
              d.setSearch("");
            }}
          >
            {FLOW.clearFilters}
          </Button>
        </Panel>
      ) : (
        <div className="grid gap-4">
          {d.filtered.map((b) => {
            const state = readiness(b, d.now);
            const canAssign =
              !isStaff &&
              [
                "READY",
                "NEEDS_UNIT",
                "NEEDS_STAFF",
                "INSPECTING",
                "READY_HANDOVER",
                "TOO_EARLY",
              ].includes(state);
            const url = `${root}/check-in?bookingCode=${encodeURIComponent(b.bookingCode)}`;
            return (
              <Panel
                key={b.id}
                className="flex flex-col gap-4 p-4 xl:flex-row xl:items-center xl:justify-between xl:p-6"
              >
                <div className="flex items-center gap-4 xl:w-[30%]">
                  <UnitPlaceholder />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-xs text-[#003b2f]">{b.bookingCode}</strong>
                      <Pill
                        tone={
                          ["NO_SHOW", "CANCELLED"].includes(state)
                            ? "red"
                            : state === "NEEDS_UNIT" || state === "PAYMENT_PENDING"
                              ? "amber"
                              : "green"
                        }
                      >
                        {labels[state]}
                      </Pill>
                    </div>
                    <h2 className={`${titleClass} mt-1 text-lg`}>{b.contactName}</h2>
                    <p className="mt-1 flex items-center gap-1 text-xs text-[#404945]">
                      <Phone size={14} />
                      {b.contactPhone}
                    </p>
                  </div>
                </div>
                <div className="grid flex-1 gap-4 rounded-lg bg-[#f2f3ff]/60 p-4 sm:grid-cols-3">
                  <div>
                    <p className="text-[11px] uppercase text-[#707975]">{FLOW.position}</p>
                    <p className="mt-1 font-semibold">
                      {b.assignedUnit?.physicalUnitCode ?? FLOW.unassigned}
                    </p>
                    <p className="text-xs text-[#404945]">
                      {b.unitTypeName} · {b.unitTypeSizeLabel}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase text-[#707975]">{FLOW.slot}</p>
                    <p className="mt-1 text-xs font-medium">{formatDateTime(b.checkInSlotStart)}</p>
                    <p className="text-xs text-[#404945]">{formatDateTime(b.checkInSlotEnd)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase text-[#707975]">{FLOW.payment}</p>
                    <p className="mt-1 text-xs font-semibold text-[#125345]">
                      {b.paidAt ? FLOW.paid : FLOW.unpaid}
                    </p>
                    <Currency value={b.totalAmount} />
                    <p className="mt-2 text-xs text-[#404945]">
                      {FLOW.assignedStaff}:{" "}
                      <strong>{b.assignedStaff?.name ?? FLOW.needsStaff}</strong>
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 xl:w-[22%]">
                  {canAssign ||
                  ["READY", "INSPECTING", "READY_HANDOVER", "CHECKED_IN"].includes(state) ? (
                    <Link
                      href={
                        state === "NEEDS_UNIT" && !isStaff
                          ? `${url}&view=assign&bookingId=${b.id}`
                          : isStaff && ["READY_HANDOVER", "CHECKED_IN"].includes(state)
                            ? `${url}&view=handover`
                            : isStaff && state === "INSPECTING"
                              ? `${url}&view=inspect`
                              : url
                      }
                      className="flex items-center justify-center gap-2 rounded-lg bg-[#b4efda] px-4 py-3 text-center text-sm font-semibold text-[#002018] hover:bg-[#98d2be]"
                    >
                      {!isStaff
                        ? state === "NEEDS_UNIT"
                          ? FLOW.assign
                          : FLOW.monitor
                        : state === "CHECKED_IN"
                          ? FLOW.monitor
                          : state === "READY_HANDOVER"
                            ? FLOW.continueHandover
                            : state === "INSPECTING"
                              ? FLOW.continueInspect
                              : FLOW.receive}
                      <ArrowRight size={18} />
                    </Link>
                  ) : (
                    <Link
                      href={url}
                      className="rounded-lg bg-[#eaedff] px-4 py-3 text-center text-xs font-semibold"
                    >
                      {FLOW.lookup}
                    </Link>
                  )}
                  <div className="flex flex-wrap justify-end gap-3 text-[11px]">
                    {canAssign && b.assignedUnit && (
                      <Link
                        href={`${url}&view=assign&bookingId=${b.id}`}
                        className="text-[#306858] underline"
                      >
                        {FLOW.reassign}
                      </Link>
                    )}
                    {!isStaff && b.status === "CONFIRMED" && (
                      <button
                        type="button"
                        className="text-[#306858] underline"
                        onClick={() => setStaffBooking(b)}
                      >
                        {FLOW.staffAssign}
                      </button>
                    )}
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
      {staffBooking && (
        <StaffAssignmentModal booking={staffBooking} isOpen onClose={() => setStaffBooking(null)} />
      )}
    </>
  );
}
