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
import { useEffect, useState } from "react";
import { Currency } from "@/components/ui/display";
import { operationalField } from "@/components/ui/operational";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useAuthStore } from "@/features/auth/auth-store";
import { FLOW } from "@/features/facility-flow/flow.messages";
import {
  FlowButton as Button,
  FlowHeading,
  inputClass,
  Panel,
  Pill,
  titleClass,
  UnitPlaceholder,
} from "@/features/facility-flow/flow-ui";
import { readiness, useDispatch } from "@/features/facility-flow/use-dispatch";
import { formatDateTime } from "@/lib/format";
import type { FacilityBookingsViewProps } from "./facility-bookings-view.types";
import { ManagerBookingRow } from "./manager-booking-row";
import { MANAGER_BOOKING_ROW as MB } from "./manager-booking-row.messages";
import { StaffAssignmentModal } from "./staff-assignment-modal";

function slotRemainingLabel(value: string) {
  const remaining = Date.parse(value) - Date.now();
  if (remaining <= 0) return "Khung giờ đã kết thúc";
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.max(1, Math.ceil((remaining % 3_600_000) / 60_000));
  return hours > 0 ? `Còn ${hours} giờ ${minutes} phút` : `Còn ${minutes} phút`;
}

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
export function FacilityBookingsView({
  facilityId,
  facilityName,
  headingMode = "full",
}: FacilityBookingsViewProps) {
  const isStaff = useAuthStore((s) => s.session?.user.role) === UserRole.FACILITY_STAFF;
  const root = isStaff ? "/staff" : "/facility-manager";
  const d = useDispatch(facilityId, isStaff);
  const { filter, search } = d;
  const [staffBooking, setStaffBooking] = useState<BookingListItem | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 6;
  const pageCount = Math.max(1, Math.ceil(d.filtered.length / pageSize));
  const pageItems = d.filtered.slice((page - 1) * pageSize, page * pageSize);
  const headingActions = (
    <div className="flex gap-2">
      <div className="rounded-lg bg-white px-4 py-2 text-xs shadow-sm">
        <p className="text-[#5c6661]">{FLOW.syncTime}</p>
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
  );
  // Reset pagination whenever the user changes a filter or search term.
  // biome-ignore lint/correctness/useExhaustiveDependencies: filter and search intentionally reset the local page.
  useEffect(() => setPage(1), [filter, search]);
  useEffect(() => setPage((value) => Math.min(value, pageCount)), [pageCount]);
  return (
    <>
      {headingMode === "full" ? (
        <FlowHeading
          title={isStaff ? FLOW.staffTasks : FLOW.managerDispatchTitle}
          description={FLOW.dispatchDescription(facilityName ?? FLOW.noFacility)}
          actions={headingActions}
        />
      ) : (
        <div className="flex justify-end">{headingActions}</div>
      )}
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: FLOW.total, value: d.bookings.length, icon: Calendar },
          {
            label: FLOW.needsAction,
            value: d.count("NEEDS_UNIT") + d.count("NEEDS_STAFF"),
            icon: Warehouse,
          },
          { label: FLOW.waiting, value: d.count("READY"), icon: UserCheck },
          {
            label: FLOW.inProgress,
            value: d.count("INSPECTING") + d.count("READY_HANDOVER"),
            icon: ClipboardCheck,
          },
          { label: FLOW.pendingAccess, value: d.count("CHECKED_IN"), icon: ClipboardCheck },
        ].map(({ label, value, icon: Icon }) => (
          <Panel key={label} className="px-3.5 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="block truncate text-[11px] font-medium uppercase tracking-wider text-[#5c6661]">
                  {label}
                </span>
                <p
                  className={`${titleClass} mt-0.5 text-2xl font-bold leading-tight text-slate-900`}
                >
                  {value}
                </p>
              </div>
              <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#003b2f]/10 text-[#003b2f]">
                <Icon size={16} />
              </div>
            </div>
          </Panel>
        ))}
      </div>
      <Panel className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[180px] flex-1">
            <Search size={20} className="absolute left-3 top-3 text-[#5c6661]" />
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
        {!isStaff ? (
          <label className="grid gap-2 text-xs font-semibold text-slate-600">
            {MB.filters}
            <select
              aria-label={MB.filters}
              value={d.filter}
              onChange={(event) => d.setFilter(event.target.value)}
              className={operationalField}
            >
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
              ].map((value) => (
                <option key={value} value={value}>
                  {value === "ALL" ? FLOW.all : labels[value]} (
                  {value === "ALL" ? d.bookings.length : d.count(value)})
                </option>
              ))}
            </select>
          </label>
        ) : (
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
        )}
      </Panel>
      <p role="status" aria-live="polite" className="text-sm text-[#404945]">
        {d.query.isFetching ? FLOW.refreshing : FLOW.results(pageItems.length, d.filtered.length)}
      </p>
      {d.query.isError && d.query.data && (
        <p role="alert" className="rounded bg-[#ffdcc3] p-3 text-[#6e3900]">
          {FLOW.staleData}
        </p>
      )}
      {d.query.isLoading ? (
        <LoadingState label={FLOW.loading} variant="table" />
      ) : d.query.isError && !d.query.data ? (
        <ErrorState message={FLOW.listError} onRetry={() => d.query.refetch()} />
      ) : d.filtered.length === 0 ? (
        <Panel className="py-12 text-center">
          <Warehouse className="mx-auto mb-3 text-[#306858]" size={40} />
          <h2 className={`${titleClass} text-xl`}>{FLOW.noBookings}</h2>
          <p className="mt-2 text-[#5c6661]">{FLOW.noBookingsHint}</p>
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
          {pageItems.map((b) => {
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
            if (!isStaff)
              return (
                <ManagerBookingRow
                  key={b.id}
                  booking={b}
                  state={state}
                  canAssign={canAssign}
                  onAssignStaff={() => setStaffBooking(b)}
                />
              );
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
                    <p className="text-[11px] uppercase text-[#5c6661]">{FLOW.position}</p>
                    <p className="mt-1 font-semibold">
                      {b.assignedUnit?.physicalUnitCode ?? FLOW.unassigned}
                    </p>
                    <p className="text-xs text-[#404945]">
                      {b.unitTypeName} · {b.unitTypeSizeLabel}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase text-[#5c6661]">{FLOW.slot}</p>
                    <p className="mt-1 text-xs font-medium">{formatDateTime(b.checkInSlotStart)}</p>
                    <p className="text-xs text-[#404945]">{formatDateTime(b.checkInSlotEnd)}</p>
                    {b.checkInSlotEnd ? (
                      <p className="mt-2 text-xs font-semibold text-[#125345]">
                        {slotRemainingLabel(b.checkInSlotEnd)}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <p className="text-[11px] uppercase text-[#5c6661]">{FLOW.payment}</p>
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
      {pageCount > 1 ? (
        <nav
          className="flex flex-wrap items-center justify-center gap-3"
          aria-label="Phân trang booking"
        >
          <Button
            type="button"
            variant="secondary"
            disabled={page === 1}
            onClick={() => setPage((value) => value - 1)}
          >
            {FLOW.previous}
          </Button>
          <span className="text-sm font-semibold text-[#404945]">
            {FLOW.pageOf(page, pageCount)}
          </span>
          <Button
            type="button"
            variant="secondary"
            disabled={page === pageCount}
            onClick={() => setPage((value) => value + 1)}
          >
            {FLOW.paginationNext}
          </Button>
        </nav>
      ) : null}
      {staffBooking && (
        <StaffAssignmentModal booking={staffBooking} isOpen onClose={() => setStaffBooking(null)} />
      )}
    </>
  );
}
