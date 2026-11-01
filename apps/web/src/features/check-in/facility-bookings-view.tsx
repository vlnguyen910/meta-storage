"use client";
import { APPOINTMENT_TYPES } from "@metastorage/contracts";
import { UserRole } from "@metastorage/database/schema/user-enums";
import { formatReference } from "@metastorage/shared";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Phone, RefreshCw, Search, Warehouse } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Currency } from "@/components/ui/display";
import { ListPagination } from "@/components/ui/list-pagination";
import { OperationalBadge } from "@/components/ui/operational";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useAuthStore } from "@/features/auth/auth-store";
import { FLOW } from "@/features/facility-flow/flow.messages";
import {
  FlowButton as Button,
  FlowHeading,
  Panel,
  Pill,
  titleClass,
  UnitPlaceholder,
} from "@/features/facility-flow/flow-ui";
import type { DispatchAppointmentType, DispatchItem } from "@/features/facility-flow/use-dispatch";
import { readiness, useDispatch } from "@/features/facility-flow/use-dispatch";
import { api } from "@/lib/api";
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
  SCHEDULED: FLOW.scheduled,
  CONFIRMED: FLOW.confirmed,
  COMPLETED: FLOW.completed,
};
export function FacilityBookingsView({
  facilityId,
  facilityName,
  headingMode = "full",
}: FacilityBookingsViewProps) {
  const isStaff = useAuthStore((s) => s.session?.user.role) === UserRole.FACILITY_STAFF;
  const root = isStaff ? "/staff" : "/facility-manager";
  const appointmentType = (isStaff ? APPOINTMENT_TYPES.CHECK_IN : "ALL") as DispatchAppointmentType;
  const showingReturns = appointmentType === APPOINTMENT_TYPES.CHECK_OUT;
  const showingAll = appointmentType === "ALL";
  const d = useDispatch(facilityId, isStaff, appointmentType);
  const { filter, search } = d;
  const [staffBooking, setStaffBooking] = useState<DispatchItem | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 6;
  const pageCount = Math.max(1, Math.ceil(d.filtered.length / pageSize));
  const pageItems = d.filtered.slice((page - 1) * pageSize, page * pageSize);
  const details = d.bookings.find((item) => item.id === detailsId) ?? null;
  const detailsRentalId = details?.rentalId ?? "";
  const detailsRental = useQuery({
    queryKey: ["manager-appointment-rental-detail", facilityId, detailsRentalId],
    queryFn: () => api.rentals.facilityDetail(facilityId, detailsRentalId),
    enabled: Boolean(detailsRentalId) && details?.appointmentType === APPOINTMENT_TYPES.CHECK_OUT,
  });
  // Reset pagination whenever the user changes a filter or search term.
  // biome-ignore lint/correctness/useExhaustiveDependencies: filter and search intentionally reset the local page.
  useEffect(() => setPage(1), [filter, search]);
  useEffect(() => setPage((value) => Math.min(value, pageCount)), [pageCount]);
  return (
    <>
      {headingMode === "full" && (
        <FlowHeading
          title={
            isStaff
              ? FLOW.staffTasks
              : showingAll
                ? FLOW.managerAppointmentsTitle
                : showingReturns
                  ? FLOW.managerReturnDispatchTitle
                  : FLOW.managerDispatchTitle
          }
          description={
            showingAll
              ? FLOW.managerAppointmentsDescription(facilityName ?? FLOW.noFacility)
              : showingReturns
                ? FLOW.returnDispatchDescription(facilityName ?? FLOW.noFacility)
                : FLOW.dispatchDescription(facilityName ?? FLOW.noFacility)
          }
        />
      )}
      <Panel className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-[200px] flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              aria-label={FLOW.searchLabel}
              placeholder={FLOW.search}
              value={d.search}
              onChange={(e) => d.setSearch(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 transition-colors focus:border-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => d.query.refetch()}
              disabled={d.query.isFetching}
              className="flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:border-primary hover:bg-slate-50 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
              title={FLOW.refresh}
              aria-label={FLOW.refresh}
            >
              <RefreshCw
                size={14}
                className={d.query.isFetching ? "animate-spin text-primary" : "text-slate-500"}
              />
              <span>{FLOW.refresh}</span>
            </button>

            {isStaff && (
              <Link
                href={`${root}/check-in`}
                className="flex h-10 items-center rounded-lg bg-primary px-3.5 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-primary-dark"
              >
                {isStaff ? FLOW.lookup : FLOW.monitor}
              </Link>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-600">{MB.filters}</p>
          <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label={MB.filters}>
            {(showingAll
              ? [
                  "ALL",
                  "NEEDS_UNIT",
                  "NEEDS_STAFF",
                  "PAYMENT_PENDING",
                  "READY",
                  "SLOT_MISSING",
                  "INSPECTING",
                  "READY_HANDOVER",
                  "TOO_EARLY",
                  "CHECKED_IN",
                  "SCHEDULED",
                  "CONFIRMED",
                  "COMPLETED",
                  "CANCELLED",
                  "NO_SHOW",
                ]
              : appointmentType === APPOINTMENT_TYPES.CHECK_IN
                ? [
                    "ALL",
                    "NEEDS_UNIT",
                    "NEEDS_STAFF",
                    "READY",
                    "INSPECTING",
                    "READY_HANDOVER",
                    "TOO_EARLY",
                    "NO_SHOW",
                    "CHECKED_IN",
                  ]
                : ["ALL", "SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELLED"]
            ).map((id) => {
              const active = d.filter === id;
              const itemCount = id === "ALL" ? d.bookings.length : d.count(id);
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => d.setFilter(id)}
                  className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                    active
                      ? "bg-[#003b2f] text-white shadow-sm ring-1 ring-[#003b2f]"
                      : "border border-transparent bg-[#f2f3ff] text-[#404945] hover:bg-[#e4e7fa]"
                  }`}
                >
                  <span>{id === "ALL" ? FLOW.all : labels[id]}</span>
                  <span
                    className={`ml-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      active ? "bg-white/20 text-white" : "bg-slate-200/80 text-slate-700"
                    }`}
                  >
                    {itemCount}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
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
            const returnFlow = b.appointmentType === APPOINTMENT_TYPES.CHECK_OUT;
            const canAssign =
              !isStaff &&
              (returnFlow
                ? ["SCHEDULED", "CONFIRMED"]
                : [
                    "READY",
                    "NEEDS_UNIT",
                    "NEEDS_STAFF",
                    "INSPECTING",
                    "READY_HANDOVER",
                    "TOO_EARLY",
                  ]
              ).includes(state);
            const url = returnFlow
              ? "/staff/tasks"
              : `${root}/check-in?appointmentId=${encodeURIComponent(b.id)}`;
            if (!isStaff)
              return (
                <ManagerBookingRow
                  key={b.id}
                  booking={b}
                  state={state}
                  canAssign={canAssign}
                  onAssignStaff={() => setStaffBooking(b)}
                  onViewDetails={() => setDetailsId(b.id)}
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
                            : state === "NEEDS_UNIT" ||
                                state === "PAYMENT_PENDING" ||
                                (returnFlow && state === "SCHEDULED")
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
                    <p className="text-[11px] uppercase text-[#5c6661]">
                      {returnFlow ? FLOW.rentalReference : FLOW.position}
                    </p>
                    <p className="mt-1 font-semibold">
                      {returnFlow
                        ? (b.rentalId?.slice(0, 8) ?? FLOW.unassigned)
                        : (b.assignedUnit?.physicalUnitCode ?? FLOW.unassigned)}
                    </p>
                    <p className="text-xs text-[#404945]">
                      {returnFlow
                        ? FLOW.returnUnitLookup
                        : `${b.unitTypeName} · ${b.unitTypeSizeLabel}`}
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
                  {returnFlow ? (
                    <div>
                      <p className="text-[11px] uppercase text-[#5c6661]">
                        {FLOW.returnAppointmentType}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-[#125345]">
                        {FLOW.checkOutAppointments}
                      </p>
                      <p className="mt-2 text-xs text-[#404945]">
                        {FLOW.assignedStaff}:{" "}
                        <strong>{b.assignedStaff?.name ?? FLOW.needsStaff}</strong>
                      </p>
                    </div>
                  ) : (
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
                  )}
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
                      {returnFlow ? FLOW.openReturnTask : FLOW.lookup}
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
                    {!isStaff && canAssign && (
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
      {d.filtered.length > 0 && (
        <ListPagination
          label="danh sách booking"
          unitLabel="booking"
          page={page}
          pageSize={pageSize}
          total={d.filtered.length}
          onPageChange={setPage}
          pending={d.query.isFetching}
        />
      )}
      {staffBooking && (
        <StaffAssignmentModal booking={staffBooking} isOpen onClose={() => setStaffBooking(null)} />
      )}
      <Sheet open={Boolean(details)} onOpenChange={(open) => !open && setDetailsId(null)}>
        <SheetContent className="w-full max-w-xl p-5 sm:p-7">
          {details && (
            <>
              <SheetHeader className="pr-12">
                <SheetTitle>{FLOW.appointmentDetails}</SheetTitle>
                <OperationalBadge value={details.appointmentStatus} />
              </SheetHeader>
              <section className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2">
                <DetailValue
                  label={FLOW.appointmentType}
                  value={
                    details.appointmentType === APPOINTMENT_TYPES.CHECK_OUT
                      ? FLOW.checkOutAppointments
                      : FLOW.checkInAppointments
                  }
                />
                <DetailValue label={MB.customer} value={details.contactName} />
                <DetailValue
                  label={FLOW.schedule}
                  value={formatDateTime(details.checkInSlotStart)}
                />
                <DetailValue
                  label={FLOW.assignedStaff}
                  value={details.assignedStaff?.name ?? FLOW.needsStaff}
                />
                {details.appointmentType === APPOINTMENT_TYPES.CHECK_IN ? (
                  <>
                    <DetailValue label={FLOW.bookingReference} value={details.bookingCode} />
                    <DetailValue
                      label={FLOW.unitType}
                      value={`${details.unitTypeName}${details.unitTypeSizeLabel ? ` · ${details.unitTypeSizeLabel}` : ""}`}
                    />
                    {details.assignedUnit && (
                      <DetailValue
                        label={FLOW.unit}
                        value={details.assignedUnit.physicalUnitCode}
                      />
                    )}
                  </>
                ) : (
                  <>
                    <DetailValue
                      label={FLOW.rentalReference}
                      value={formatReference(details.rentalId, "KT")}
                    />
                    {detailsRental.isPending ? (
                      <LoadingState variant="detail" />
                    ) : detailsRental.isError ? (
                      <ErrorState
                        message={MB.relatedLoadError}
                        onRetry={() => void detailsRental.refetch()}
                      />
                    ) : detailsRental.data ? (
                      <>
                        <DetailValue
                          label={FLOW.unit}
                          value={`${detailsRental.data.unit.code} · ${detailsRental.data.unit.unitTypeName}`}
                        />
                        <DetailValue
                          label={FLOW.rentalPeriod}
                          value={`${formatDateTime(detailsRental.data.startAt)} – ${formatDateTime(detailsRental.data.endAt)}`}
                        />
                        <Link
                          className="font-semibold text-primary underline underline-offset-2 sm:col-span-2"
                          href={`/facility-manager/rentals?rentalId=${encodeURIComponent(details.rentalId ?? "")}`}
                        >
                          {FLOW.openRentalRecord}
                        </Link>
                      </>
                    ) : null}
                  </>
                )}
              </section>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function DetailValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 gap-1">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="break-words font-medium text-slate-900">{value}</span>
    </div>
  );
}
