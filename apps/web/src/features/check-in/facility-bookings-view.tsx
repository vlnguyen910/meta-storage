"use client";
import { APPOINTMENT_TYPES } from "@metastorage/contracts";
import { UserRole } from "@metastorage/database/schema/user-enums";
import { formatReference } from "@metastorage/shared";
import { useQuery } from "@tanstack/react-query";
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
import { OperationalBadge } from "@/components/ui/operational";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
  const [appointmentType, setAppointmentType] = useState<DispatchAppointmentType>(
    isStaff ? APPOINTMENT_TYPES.CHECK_IN : "ALL",
  );
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
  const headingActions = (
    <div className="flex items-center gap-2">
      <div className="flex h-[58px] flex-col justify-center rounded-lg bg-white px-3.5 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <p className="text-[11px] font-medium uppercase tracking-wider text-[#5c6661]">
          {FLOW.syncTime}
        </p>
        <strong className={`${titleClass} text-sm font-bold text-slate-900`}>
          {d.query.dataUpdatedAt
            ? new Date(d.query.dataUpdatedAt).toLocaleTimeString("vi-VN", {
                timeZone: "Asia/Ho_Chi_Minh",
              })
            : "—"}
        </strong>
      </div>
      <Button
        variant="secondary"
        onClick={() => window.print()}
        icon={<Printer size={18} />}
        className="h-[58px] px-4 font-semibold"
      >
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
          actions={headingActions}
        />
      )}
      <fieldset className="flex gap-2">
        <legend className="sr-only">{FLOW.appointmentType}</legend>
        {[
          ...(!isStaff ? (["ALL"] as const) : []),
          APPOINTMENT_TYPES.CHECK_IN,
          APPOINTMENT_TYPES.CHECK_OUT,
        ].map((type) => (
          <button
            key={type}
            type="button"
            aria-pressed={appointmentType === type}
            onClick={() => {
              setAppointmentType(type);
              d.setFilter("ALL");
            }}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${appointmentType === type ? "bg-primary text-white" : "border border-line bg-white text-ink"}`}
          >
            {type === "ALL"
              ? FLOW.allAppointments
              : type === APPOINTMENT_TYPES.CHECK_IN
                ? FLOW.checkInAppointments
                : FLOW.checkOutAppointments}
            <span className="ml-1.5 rounded-full bg-black/10 px-2 py-0.5 text-xs">
              {type === "ALL"
                ? d.bookings.length
                : d.bookings.filter((item) => item.appointmentType === type).length}
            </span>
          </button>
        ))}
      </fieldset>
      <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
        <div
          className={`grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3 ${showingAll ? "xl:grid-cols-4" : "xl:grid-cols-5"}`}
        >
          {(showingAll
            ? [
                { label: FLOW.totalAppointments, value: d.bookings.length, icon: Calendar },
                {
                  label: FLOW.checkInAppointments,
                  value: d.bookings.filter(
                    (item) => item.appointmentType === APPOINTMENT_TYPES.CHECK_IN,
                  ).length,
                  icon: Warehouse,
                },
                {
                  label: FLOW.checkOutAppointments,
                  value: d.bookings.filter(
                    (item) => item.appointmentType === APPOINTMENT_TYPES.CHECK_OUT,
                  ).length,
                  icon: UserCheck,
                },
                {
                  label: FLOW.returnNeedsConfirmation,
                  value: d.bookings.filter(
                    (item) =>
                      item.appointmentType === APPOINTMENT_TYPES.CHECK_OUT &&
                      readiness(item, d.now) === "SCHEDULED",
                  ).length,
                  icon: ClipboardCheck,
                },
              ]
            : showingReturns
              ? [
                  { label: FLOW.total, value: d.bookings.length, icon: Calendar },
                  {
                    label: FLOW.returnNeedsConfirmation,
                    value: d.count("SCHEDULED"),
                    icon: Warehouse,
                  },
                  { label: FLOW.returnConfirmed, value: d.count("CONFIRMED"), icon: UserCheck },
                  {
                    label: FLOW.returnCompleted,
                    value: d.count("COMPLETED"),
                    icon: ClipboardCheck,
                  },
                  {
                    label: FLOW.returnClosed,
                    value: d.count("CANCELLED") + d.count("NO_SHOW"),
                    icon: ClipboardCheck,
                  },
                ]
              : [
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
                ]
          ).map(({ label, value, icon: Icon }) => (
            <Panel key={label} className="flex h-[58px] flex-col justify-center px-3.5 py-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="block truncate text-[11px] font-medium uppercase tracking-wider text-[#5c6661]">
                    {label}
                  </span>
                  <p className={`${titleClass} text-2xl font-bold leading-tight text-slate-900`}>
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
        {headingMode !== "full" && (
          <div className="flex shrink-0 items-center justify-end">{headingActions}</div>
        )}
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
