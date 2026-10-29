"use client";

import viLocale from "@fullcalendar/core/locales/vi";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import type { AppointmentRecordDto } from "@metastorage/contracts";
import { APPOINTMENT_STATUSES } from "@metastorage/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CalendarDays, List, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CustomerTable } from "@/components/ui/customer-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { customerRoutes } from "@/config/routes";
import { useFlow3Identity } from "@/features/returns/use-flow3-identity";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { CUSTOMER_APPOINTMENTS_MESSAGES as M } from "./customer-appointments.messages";

type CalendarView = "dayGridMonth" | "timeGridWeek" | "timeGridDay";

function slotTime(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.includes("T") ? value.split("T")[1]?.slice(0, 8) : value.slice(0, 8);
}

function appointmentStart(item: AppointmentRecordDto): number {
  const time = slotTime(item.slotStart) ?? "00:00:00";
  return Date.parse(`${item.scheduledDate}T${time}+07:00`);
}

function appointmentLabel(item: AppointmentRecordDto): string {
  return M.eventType[item.appointmentType] ?? item.appointmentType;
}

function appointmentStatus(item: AppointmentRecordDto): string {
  return M.status[item.status] ?? item.status;
}

function statusClass(status: string): string {
  if (status === APPOINTMENT_STATUSES.CONFIRMED)
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === APPOINTMENT_STATUSES.COMPLETED)
    return "border-slate-200 bg-slate-100 text-slate-700";
  if (status === APPOINTMENT_STATUSES.CANCELLED || status === APPOINTMENT_STATUSES.NO_SHOW)
    return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-amber-200 bg-amber-50 text-amber-900";
}

function relatedLabel(item: AppointmentRecordDto): string {
  if (item.reservationId) return `${M.linkedReservation} · ${item.reservationId}`;
  if (item.rentalId) return `${M.linkedRental} · ${item.rentalId}`;
  if (item.supportTicketId) return `${M.linkedTicket} · ${item.supportTicketId}`;
  return "—";
}

function relatedHref(item: AppointmentRecordDto): string | undefined {
  if (item.reservationId) return customerRoutes.reservation(item.reservationId);
  if (item.rentalId) return customerRoutes.rental(item.rentalId);
  if (item.supportTicketId) return customerRoutes.supportTicket(item.supportTicketId);
  return undefined;
}

function AppointmentStatus({ item }: { item: AppointmentRecordDto }) {
  return <Badge className={statusClass(item.status)}>{appointmentStatus(item)}</Badge>;
}

export function CustomerAppointmentsView() {
  const owner = useFlow3Identity();
  const client = useQueryClient();
  const calendarRef = useRef<FullCalendar>(null);
  const [calendarView, setCalendarView] = useState<CalendarView>("timeGridWeek");
  const [calendarTitle, setCalendarTitle] = useState("");
  const [layout, setLayout] = useState<"calendar" | "table">("calendar");
  const [facilityFilter, setFacilityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const appointments = useQuery({
    queryKey: ["customer-appointments", owner],
    queryFn: () => api.appointments.mine(),
  });
  const operatingHours = useQuery({
    queryKey: ["facility-operating-hours"],
    queryFn: ({ signal }) => api.facilities.operatingHours(signal),
    enabled: layout === "calendar" && calendarView !== "dayGridMonth",
  });
  const cancel = useMutation({
    mutationFn: (id: string) =>
      api.appointments.update(id, { status: APPOINTMENT_STATUSES.CANCELLED }),
    onSuccess: async () => {
      setCancelTarget(null);
      await client.invalidateQueries({ queryKey: ["customer-appointments", owner] });
    },
  });
  const allAppointments = appointments.data ?? [];
  const facilities = useMemo(
    () =>
      Array.from(
        new Map(
          allAppointments.map((item) => [item.facilityId, item.facility?.name ?? item.facilityId]),
        ),
      ).sort((a, b) => a[1].localeCompare(b[1], "vi")),
    [allAppointments],
  );
  const filteredAppointments = useMemo(
    () =>
      allAppointments
        .filter((item) => facilityFilter === "all" || item.facilityId === facilityFilter)
        .filter((item) => statusFilter === "all" || item.status === statusFilter)
        .toSorted((a, b) => appointmentStart(a) - appointmentStart(b)),
    [allAppointments, facilityFilter, statusFilter],
  );
  const events = useMemo(
    () =>
      filteredAppointments.flatMap((item) => {
        const startTime = slotTime(item.slotStart);
        const endTime = slotTime(item.slotEnd);
        if (!startTime) return [];
        const start = `${item.scheduledDate}T${startTime}+07:00`;
        return [
          {
            id: item.id,
            title: appointmentLabel(item),
            start,
            ...(endTime ? { end: `${item.scheduledDate}T${endTime}+07:00` } : {}),
            classNames: [`appointment-${item.status.toLowerCase()}`],
            extendedProps: { appointment: item },
          },
        ];
      }),
    [filteredAppointments],
  );
  const selected = allAppointments.find((item) => item.id === selectedId) ?? null;
  const canCancel = Boolean(
    selected &&
      [APPOINTMENT_STATUSES.SCHEDULED, APPOINTMENT_STATUSES.CONFIRMED].includes(selected.status) &&
      appointmentStart(selected) > Date.now(),
  );
  const today = Date.now();
  const upcomingCount = allAppointments.filter(
    (item) =>
      [APPOINTMENT_STATUSES.SCHEDULED, APPOINTMENT_STATUSES.CONFIRMED].includes(item.status) &&
      appointmentStart(item) >= today,
  ).length;
  const completedCount = allAppointments.filter(
    (item) => item.status === APPOINTMENT_STATUSES.COMPLETED,
  ).length;
  const cancelledCount = allAppointments.filter(
    (item) => item.status === APPOINTMENT_STATUSES.CANCELLED,
  ).length;

  function moveCalendar(direction: "prev" | "next" | "today") {
    const calendar = calendarRef.current?.getApi();
    if (!calendar) return;
    if (direction === "today") calendar.today();
    else calendar[direction]();
  }

  return (
    <section className="space-y-4" aria-labelledby="customer-appointments-title">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="customer-appointments-title"
            className="font-['Space_Grotesk'] text-xl font-bold text-ink sm:text-2xl"
          >
            {M.title}
          </h2>
          <p className="mt-1 text-sm text-muted">{M.description}</p>
        </div>
        <Link
          href={customerRoutes.facilities}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-xs transition hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Plus className="size-4" aria-hidden="true" />
          {M.newAppointment}
        </Link>
      </header>

      {appointments.isPending ? (
        <LoadingState variant="table" />
      ) : appointments.isError ? (
        <ErrorState message={M.loadError} onRetry={() => void appointments.refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { label: M.upcoming, value: upcomingCount, color: "text-primary" },
              { label: M.completed, value: completedCount, color: "text-slate-700" },
              { label: M.cancelled, value: cancelledCount, color: "text-rose-700" },
            ].map((summary) => (
              <div
                key={summary.label}
                className="rounded-card border border-line bg-white p-4 shadow-card"
              >
                <p className="text-sm font-medium text-muted">{summary.label}</p>
                <p className={`mt-1 font-['Space_Grotesk'] text-2xl font-bold ${summary.color}`}>
                  {summary.value}
                </p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-3 rounded-card border border-line bg-white p-3 shadow-card">
            <div className="min-w-40 flex-1 space-y-1.5 text-xs font-semibold text-slate-700">
              <span id="appointment-facility-filter-label">{M.facilityFilter}</span>
              <Select value={facilityFilter} onValueChange={setFacilityFilter}>
                <SelectTrigger aria-labelledby="appointment-facility-filter-label">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{M.allFacilities}</SelectItem>
                  {facilities.map(([id, name]) => (
                    <SelectItem key={id} value={id}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-40 flex-1 space-y-1.5 text-xs font-semibold text-slate-700">
              <span id="appointment-status-filter-label">{M.statusFilter}</span>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger aria-labelledby="appointment-status-filter-label">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{M.allStatuses}</SelectItem>
                  {Object.entries(M.status).map(([status, label]) => (
                    <SelectItem key={status} value={status}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <fieldset className="ml-auto flex min-h-11 rounded-lg border border-line bg-canvas p-1">
              <legend className="sr-only">{M.layoutFilter}</legend>
              <Button
                variant={layout === "calendar" ? "primary" : "ghost"}
                aria-pressed={layout === "calendar"}
                className="h-9 min-h-9 px-3 text-xs"
                icon={<CalendarDays className="size-4" aria-hidden="true" />}
                onClick={() => setLayout("calendar")}
              >
                {M.calendarView}
              </Button>
              <Button
                variant={layout === "table" ? "primary" : "ghost"}
                aria-pressed={layout === "table"}
                className="h-9 min-h-9 px-3 text-xs"
                icon={<List className="size-4" aria-hidden="true" />}
                onClick={() => setLayout("table")}
              >
                {M.tableView}
              </Button>
            </fieldset>
          </div>

          {layout === "calendar" ? (
            <section
              className="overflow-hidden rounded-card border border-line bg-white p-3 shadow-card sm:p-4"
              aria-label={M.calendarView}
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    className="size-11 min-h-11 px-0"
                    aria-label={M.previous}
                    onClick={() => moveCalendar("prev")}
                  >
                    <ArrowLeft className="size-4" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="outline"
                    className="min-h-11 px-3 text-xs"
                    onClick={() => moveCalendar("today")}
                  >
                    {M.today}
                  </Button>
                  <Button
                    variant="outline"
                    className="size-11 min-h-11 px-0"
                    aria-label={M.next}
                    onClick={() => moveCalendar("next")}
                  >
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Button>
                </div>
                <h3
                  className="min-h-6 flex-1 text-center text-sm font-bold text-ink sm:text-base"
                  aria-live="polite"
                >
                  {calendarTitle}
                </h3>
                <fieldset className="flex min-h-11 rounded-lg border border-line bg-canvas p-1">
                  <legend className="sr-only">{M.calendarMode}</legend>
                  {(
                    [
                      ["dayGridMonth", M.month],
                      ["timeGridWeek", M.week],
                      ["timeGridDay", M.day],
                    ] as const
                  ).map(([view, label]) => (
                    <Button
                      key={view}
                      variant={calendarView === view ? "primary" : "ghost"}
                      aria-pressed={calendarView === view}
                      className="h-9 min-h-9 px-2.5 text-xs sm:px-3"
                      onClick={() => {
                        setCalendarView(view);
                        calendarRef.current?.getApi().changeView(view);
                      }}
                    >
                      {label}
                    </Button>
                  ))}
                </fieldset>
              </div>
              {filteredAppointments.length ? (
                <div className="min-w-0 overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                  <div className="min-w-[640px] sm:min-w-0 [&_.fc]:font-sans [&_.fc-theme-standard_.fc-scrollgrid]:border-line [&_.fc-theme-standard_td]:border-line [&_.fc-theme-standard_th]:border-line [&_.fc-col-header-cell]:bg-slate-50 [&_.fc-col-header-cell-cushion]:px-2 [&_.fc-col-header-cell-cushion]:py-2 [&_.fc-day-today]:bg-primary-soft/40 [&_.fc-timegrid-slot]:h-10 [&_.fc-timegrid-axis-cushion]:text-xs [&_.fc-timegrid-slot-label-cushion]:text-xs [&_.fc-event]:cursor-pointer [&_.fc-event]:rounded-md [&_.fc-event]:border-0 [&_.fc-event]:bg-primary [&_.fc-event]:px-1 [&_.fc-event]:py-0.5 [&_.fc-event]:text-white [&_.fc-event]:focus-visible:outline-2 [&_.fc-event]:focus-visible:outline-offset-1 [&_.fc-event]:focus-visible:outline-primary [&_.fc-toolbar-title]:text-base [&_.fc-button]:border-primary [&_.fc-button]:bg-primary [&_.fc-button]:text-white">
                    {calendarView !== "dayGridMonth" && operatingHours.isPending ? (
                      <LoadingState variant="table" />
                    ) : calendarView !== "dayGridMonth" && operatingHours.isError ? (
                      <ErrorState
                        message={M.hoursLoadError}
                        onRetry={() => void operatingHours.refetch()}
                      />
                    ) : (
                      <FullCalendar
                        ref={calendarRef}
                        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                        initialView="timeGridWeek"
                        headerToolbar={false}
                        allDaySlot={false}
                        firstDay={1}
                        nowIndicator
                        selectable={false}
                        editable={false}
                        timeZone="Asia/Ho_Chi_Minh"
                        slotMinTime={
                          operatingHours.data
                            ? `${String(operatingHours.data.openingHour).padStart(2, "0")}:00:00`
                            : undefined
                        }
                        slotMaxTime={
                          operatingHours.data
                            ? `${String(operatingHours.data.closingHour).padStart(2, "0")}:00:00`
                            : undefined
                        }
                        scrollTime={
                          operatingHours.data
                            ? `${String(operatingHours.data.openingHour).padStart(2, "0")}:00:00`
                            : undefined
                        }
                        locale="vi"
                        locales={[viLocale]}
                        events={events}
                        eventClick={(info) => {
                          info.jsEvent.preventDefault();
                          const appointment = info.event.extendedProps
                            .appointment as AppointmentRecordDto;
                          setSelectedId(appointment.id);
                        }}
                        datesSet={(info) => setCalendarTitle(info.view.title)}
                        height="auto"
                        eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
                        dayHeaderFormat={{ weekday: "short", day: "numeric" }}
                        buttonText={{ today: M.today, month: M.month, week: M.week, day: M.day }}
                      />
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-line bg-canvas px-4 py-10 text-center">
                  <CalendarDays className="mx-auto size-9 text-slate-400" aria-hidden="true" />
                  <p className="mt-2 text-sm font-semibold text-ink">{M.empty}</p>
                  <p className="mt-1 text-sm text-muted">{M.emptyHint}</p>
                </div>
              )}
              <p className="mt-3 text-xs text-muted">{M.localTimezone}</p>
            </section>
          ) : filteredAppointments.length ? (
            <CustomerTable
              title={M.title}
              headings={[M.dateTime, M.facility, M.related, M.statusFilter, M.details]}
              minWidth="min-w-[760px]"
            >
              {filteredAppointments.map((item) => (
                <tr key={item.id}>
                  <td>
                    <span className="font-semibold text-ink">{appointmentLabel(item)}</span>
                    <span className="mt-1 block text-xs text-muted">
                      {formatDate(item.scheduledDate)} ·{" "}
                      {item.slotStart?.slice(0, 5) ?? M.noSlotTime}
                      {item.slotEnd ? `–${item.slotEnd.slice(0, 5)}` : ""}
                    </span>
                  </td>
                  <td>{item.facility?.name ?? item.facilityId}</td>
                  <td className="max-w-56 truncate">{relatedLabel(item)}</td>
                  <td>
                    <AppointmentStatus item={item} />
                  </td>
                  <td>
                    <Button
                      variant="outline"
                      className="min-h-10 px-3 text-xs"
                      onClick={() => setSelectedId(item.id)}
                    >
                      {M.details}
                    </Button>
                  </td>
                </tr>
              ))}
            </CustomerTable>
          ) : (
            <div className="rounded-card border border-dashed border-line bg-white px-4 py-10 text-center">
              <p className="text-sm font-semibold text-ink">{M.empty}</p>
              <p className="mt-1 text-sm text-muted">{M.emptyHint}</p>
            </div>
          )}
        </>
      )}

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent className="w-full max-w-xl p-5 sm:p-7">
          {selected && (
            <>
              <SheetHeader className="pr-12">
                <SheetTitle className="font-['Space_Grotesk'] text-xl font-bold">
                  {M.detailTitle}
                </SheetTitle>
                <AppointmentStatus item={selected} />
              </SheetHeader>
              <div className="space-y-5">
                <section>
                  <h3 className="font-semibold text-ink">{appointmentLabel(selected)}</h3>
                  <p className="mt-1 font-mono text-xs text-muted">
                    {M.appointmentId}: {selected.id}
                  </p>
                </section>
                <div className="space-y-3 rounded-xl border border-line bg-canvas p-4 text-sm">
                  <div>
                    <p className="text-xs font-semibold text-muted">{M.dateTime}</p>
                    <p className="mt-1 font-medium text-ink">
                      {formatDate(selected.scheduledDate)} ·{" "}
                      {selected.slotStart?.slice(0, 5) ?? M.noSlotTime}
                      {selected.slotEnd ? `–${selected.slotEnd.slice(0, 5)}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-muted">{M.localTimezone}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted">{M.facility}</p>
                    <p className="mt-1 font-medium text-ink">
                      {selected.facility?.name ?? selected.facilityId}
                    </p>
                    {selected.facility?.address && (
                      <p className="mt-1 text-muted">{selected.facility.address}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted">{M.related}</p>
                    <p className="mt-1 font-medium text-ink">{relatedLabel(selected)}</p>
                  </div>
                </div>
                {relatedHref(selected) && (
                  <Link
                    href={relatedHref(selected) as string}
                    className="inline-flex min-h-11 items-center rounded-lg border border-line bg-white px-4 text-sm font-semibold text-primary hover:bg-primary-soft"
                  >
                    {M.viewRelated}
                  </Link>
                )}
                {cancel.isError && (
                  <p role="alert" className="text-sm text-danger">
                    {M.cancelError}
                  </p>
                )}
                {canCancel && (
                  <Button
                    variant="danger"
                    className="w-full"
                    disabled={cancel.isPending}
                    onClick={() => setCancelTarget(selected.id)}
                  >
                    {M.cancelAction}
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
      <AlertDialog
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => !open && setCancelTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{M.cancelTitle}</AlertDialogTitle>
            <AlertDialogDescription>{M.cancelDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="outline">{M.cancelBack}</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="danger"
                disabled={cancel.isPending}
                onClick={() => cancelTarget && cancel.mutate(cancelTarget)}
              >
                {M.cancelConfirm}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
