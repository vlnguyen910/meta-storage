"use client";

import { APPOINTMENT_STATUSES, APPOINTMENT_TYPES } from "@metastorage/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  CalendarCheck,
  CheckCircle2,
  Clock,
  HelpCircle,
  MapPin,
  RotateCcw,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
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
import { Button, buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/display";
import { OperationalBackLink } from "@/components/ui/operational";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { BookingSchedulePicker } from "@/features/reservations/booking-schedule-picker";
import { toLocalDateTimeInput } from "@/features/reservations/checkout-validation";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useRental } from "./hooks";
import { RENEWAL_MESSAGES as RM } from "./renewal.messages";
import { RenewalHistory } from "./renewal-history";
import { RENTAL_MESSAGES as M } from "./rentals.messages";

function remainingLabel(endAt: string): string {
  const diffDays = Math.ceil((new Date(endAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return `Đã quá hạn ${Math.abs(diffDays)} ngày`;
  if (diffDays === 0) return "Hết hạn hôm nay";
  return `Còn ${diffDays} ngày`;
}

export function RentalDetail({ rentalId }: { rentalId: string }) {
  const query = useRental(rentalId);
  const client = useQueryClient();
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [confirmEarlyReturn, setConfirmEarlyReturn] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [slotId, setSlotId] = useState("");
  const slots = useQuery({
    queryKey: ["appointment-slots"],
    queryFn: api.appointments.slots,
    enabled: showReturnForm,
  });
  const appointments = useQuery({
    queryKey: ["my-return-appointments", rentalId],
    queryFn: async () =>
      (await api.appointments.mine({ appointmentType: APPOINTMENT_TYPES.CHECK_OUT })).filter(
        (item) => item.rentalId === rentalId,
      ),
  });
  const createReturn = useMutation({
    mutationFn: () =>
      api.appointments.create({
        appointmentType: APPOINTMENT_TYPES.CHECK_OUT,
        rentalId,
        scheduledDate,
        slotId,
      }),
    onSuccess: async () => {
      setShowReturnForm(false);
      setConfirmEarlyReturn(false);
      setScheduledDate("");
      setSlotId("");
      await Promise.all([
        client.invalidateQueries({ queryKey: ["my-return-appointments", rentalId] }),
        client.invalidateQueries({ queryKey: ["rentals"] }),
      ]);
    },
  });
  const cancelReturn = useMutation({
    mutationFn: (appointmentId: string) =>
      api.appointments.update(appointmentId, { status: APPOINTMENT_STATUSES.CANCELLED }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["my-return-appointments", rentalId] });
    },
  });

  if (query.isPending) return <LoadingState variant="detail" />;
  if (query.isError)
    return <ErrorState message={M.notFoundOrForbidden} onRetry={() => query.refetch()} />;

  const r = query.data;
  const today = toLocalDateTimeInput(new Date()).slice(0, 10);
  const currentTime = toLocalDateTimeInput(new Date()).slice(11, 16);
  const rentalEndDate = toLocalDateTimeInput(new Date(r.endAt)).slice(0, 10);
  const selectedSlot = slots.data?.find((slot) => slot.id === slotId);
  const selectedSlotIsPast =
    scheduledDate === today &&
    Boolean(selectedSlot && selectedSlot.startTime.slice(0, 5) <= currentTime);
  const hasPendingReturn = appointments.data?.some((item) =>
    ["SCHEDULED", "CONFIRMED"].includes(item.status),
  );
  const activeReturn = appointments.data?.find((item) =>
    ["SCHEDULED", "CONFIRMED"].includes(item.status),
  );
  function submitReturnRequest() {
    if (scheduledDate < rentalEndDate) setConfirmEarlyReturn(true);
    else createReturn.mutate();
  }

  return (
    <div className="space-y-6">
      {/* Top Header / Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <OperationalBackLink href="/customer/storage">{M.backToStorage}</OperationalBackLink>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/customer/support/new${r.reservationId ? `?reservationId=${encodeURIComponent(r.reservationId)}` : r.bookingId ? `?bookingId=${encodeURIComponent(r.bookingId)}` : ""}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900"
          >
            <HelpCircle className="size-3.5 text-primary" />
            <span>{M.support}</span>
          </Link>

          {r.status === "ACTIVE" && (
            <Button
              variant={hasPendingReturn ? "outline" : "primary"}
              disabled={appointments.isPending || cancelReturn.isPending}
              onClick={() =>
                activeReturn ? cancelReturn.mutate(activeReturn.id) : setShowReturnForm(true)
              }
            >
              <RotateCcw className="size-3.5" />
              <span>
                {appointments.isPending
                  ? M.returnAppointmentsLoading
                  : hasPendingReturn
                    ? cancelReturn.isPending
                      ? M.returnCancelling
                      : M.returnCancel
                    : M.returnAction}
              </span>
            </Button>
          )}
        </div>
      </div>
      {cancelReturn.isError && (
        <p role="alert" className="text-right text-sm text-danger">
          {M.returnCancelError}
        </p>
      )}

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6">
        <div>
          <h2 className="text-xl font-bold">{RM.title}</h2>
          <p className="mt-2 text-sm text-secondary">{r.renewalWindow?.reason ?? RM.intro}</p>
        </div>
        <Link className={buttonClassName("primary")} href={`/customer/storage/${rentalId}/renew`}>
          {RM.title}
        </Link>
      </section>
      <RenewalHistory rentalId={rentalId} />
      {/* Card 1: Rental Overview */}
      <Card className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
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
              <strong className="text-sm font-bold text-slate-900">
                {M.bookingStatuses[r.bookingStatus] ?? r.bookingStatus}
              </strong>
            </div>
          </div>
        </div>

        {/* Thời gian đến hạn trả kho & Hành động trả kho */}
        {r.status === "ACTIVE" ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950">
            <div>
              <span className="block text-xs font-bold uppercase tracking-wide text-amber-800">
                {M.remainingTime}
              </span>
              <strong className="mt-1 block text-base font-bold text-amber-950">
                {remainingLabel(r.endAt)}
              </strong>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5 rounded-lg border border-amber-200/60 bg-white/90 px-3 py-1.5 text-xs font-semibold text-amber-800 shadow-2xs">
                <Clock size={14} className="text-amber-700" />
                <span>
                  {M.expectedReturnDate}: {formatDate(r.endAt)}
                </span>
              </div>
            </div>
          </div>
        ) : r.closedAt ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
            <span className="block text-xs font-semibold text-emerald-800">
              {M.actualReturnDate}
            </span>
            <strong className="mt-1 block text-base">{formatDate(r.closedAt)}</strong>
          </div>
        ) : null}
      </Card>

      <Dialog open={showReturnForm && r.status === "ACTIVE"} onOpenChange={setShowReturnForm}>
        <DialogContent className="w-[calc(100vw-2rem)] max-h-[90dvh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{M.returnAction}</DialogTitle>
          </DialogHeader>
          {appointments.isPending ? (
            <p role="status" className="text-sm text-muted">
              {M.returnAppointmentsLoading}
            </p>
          ) : appointments.isError ? (
            <ErrorState
              message={M.returnAppointmentsLoadError}
              onRetry={() => void appointments.refetch()}
            />
          ) : hasPendingReturn ? (
            <div role="status" className="space-y-3 text-sm">
              <p>{M.returnPending}</p>
              {appointments.data
                ?.filter((item) => ["SCHEDULED", "CONFIRMED"].includes(item.status))
                .map((item) => (
                  <p key={item.id}>
                    {formatDate(item.scheduledDate)} · {item.slotName ?? ""} ·{" "}
                    {M.returnStatuses[item.status] ?? item.status}
                  </p>
                ))}
            </div>
          ) : (
            <BookingSchedulePicker
              date={scheduledDate}
              onDateChange={setScheduledDate}
              slotId={slotId}
              onSlotChange={setSlotId}
              slots={slots.data ?? []}
              minDate={today}
              dateTitle={M.returnDate}
              slotTitle={M.returnSlot}
              dateHint={M.returnDateHint}
              timeHint={M.returnTimeHint}
              slotsLoading={slots.isPending}
              slotsError={slots.isError}
              onRetrySlots={() => void slots.refetch()}
            />
          )}
          {!appointments.isPending &&
            !appointments.isError &&
            !hasPendingReturn &&
            Boolean(appointments.data?.length) && (
              <section aria-label={M.returnHistory} className="space-y-2 border-t border-line pt-3">
                <h3 className="text-sm font-semibold">{M.returnHistory}</h3>
                {appointments.data?.map((item) => (
                  <p key={item.id} className="text-sm text-muted">
                    {formatDate(item.scheduledDate)} · {item.slotName ?? ""} ·{" "}
                    {M.returnStatuses[item.status] ?? item.status}
                  </p>
                ))}
              </section>
            )}
          {createReturn.isError && (
            <p role="alert" className="text-sm text-danger">
              {M.returnCreateError}
            </p>
          )}
          <div className="flex justify-end gap-2 border-t border-line pt-3">
            <Button variant="outline" onClick={() => setShowReturnForm(false)}>
              {M.cancel}
            </Button>
            {!appointments.isPending && !appointments.isError && !hasPendingReturn && (
              <Button
                variant="primary"
                disabled={
                  !scheduledDate ||
                  !slotId ||
                  !selectedSlot ||
                  selectedSlotIsPast ||
                  slots.isPending ||
                  slots.isError ||
                  createReturn.isPending
                }
                onClick={submitReturnRequest}
              >
                {createReturn.isPending ? M.saving : M.returnSubmit}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirmEarlyReturn} onOpenChange={setConfirmEarlyReturn}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{M.returnEarlyTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {M.returnEarlyDescription(formatDate(r.endAt))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="outline">{M.returnEarlyCancel}</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="primary"
                disabled={createReturn.isPending}
                onClick={() => createReturn.mutate()}
              >
                {M.returnEarlyConfirm}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
