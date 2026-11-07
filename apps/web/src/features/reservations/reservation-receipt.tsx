"use client";
import { formatReference } from "@metastorage/shared";
import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Currency } from "@/components/ui/display";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { customerRoutes } from "@/config/routes";
import { customerApiError } from "@/features/bookings/customer-error";
import { formatDateTime } from "@/lib/format";
import { checkoutMessages } from "./checkout.messages";
import { CheckoutConfirmation } from "./checkout-confirmation";
import { useReservationRecord } from "./reservation.hooks";
import { RESERVATION_UI as m } from "./reservation.messages";

export function ReservationReceipt({
  reservationId,
  autoSchedule = true,
  variant = "detail",
}: {
  reservationId: string;
  autoSchedule?: boolean;
  variant?: "detail" | "confirmation";
}) {
  const state = useReservationRecord(reservationId);
  const attempted = useRef(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  useEffect(() => {
    if (variant !== "confirmation") return;
    let active = true;
    const url = new URL(
      customerRoutes.reservation(reservationId),
      window.location.origin,
    ).toString();
    QRCode.toDataURL(url, { width: 320, margin: 1 })
      .then((value) => {
        if (active) setQrDataUrl(value);
      })
      .catch(() => {
        if (active) setQrDataUrl(null);
      });
    return () => {
      active = false;
    };
  }, [reservationId, variant]);
  const [slotId, setSlotId] = useState("");
  const { record, appointment, createAppointment } = state;
  const suggestedSlot =
    state.preferredSlot ?? (state.slots.length === 1 ? state.slots[0]?.id : undefined);
  useEffect(() => {
    if (
      autoSchedule &&
      record?.status === "CONFIRMED" &&
      state.appointments.isSuccess &&
      !appointment &&
      suggestedSlot &&
      !attempted.current
    ) {
      attempted.current = true;
      createAppointment.mutate(suggestedSlot);
    }
  }, [
    autoSchedule,
    record?.status,
    state.appointments.isSuccess,
    appointment,
    suggestedSlot,
    createAppointment.mutate,
  ]);
  if (state.reservation.isPending) return <LoadingState variant="detail" />;
  if (state.reservation.isError || !record)
    return <ErrorState message={m.error} onRetry={() => state.reservation.refetch()} />;
  const appointmentContent = record.status === "CONFIRMED" && (
    <div
      className={variant === "confirmation" ? "space-y-3" : "space-y-3 border-t border-line pt-5"}
    >
      <h2 className="font-semibold">{m.appointment}</h2>
      {state.appointments.isError ? (
        <ErrorState message={m.error} onRetry={() => state.appointments.refetch()} />
      ) : appointment ? (
        <p role="status">
          {appointment.scheduledDate} · {m.statuses[appointment.status] ?? appointment.status}
        </p>
      ) : (
        <>
          {createAppointment.isError && (
            <p role="alert" className="text-red-700">
              {customerApiError(createAppointment.error)}
            </p>
          )}
          <div className="block text-sm">
            <span className="block mb-2 font-medium text-ink">{m.chooseSlot}</span>
            <Select
              value={slotId || suggestedSlot || undefined}
              onValueChange={(val) => setSlotId(val)}
            >
              <SelectTrigger
                id="receipt-slot-select"
                className="block min-h-11 h-11 w-full rounded-lg border-line px-3 text-sm"
              >
                <SelectValue placeholder={m.chooseSlot} />
              </SelectTrigger>
              <SelectContent>
                {state.slots.map((slot) => (
                  <SelectItem value={slot.id} key={slot.id}>
                    {slot.name} · {slot.startTime.slice(0, 5)}–{slot.endTime.slice(0, 5)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            loading={createAppointment.isPending}
            disabled={
              createAppointment.isPending ||
              state.appointments.isPending ||
              !(slotId || suggestedSlot)
            }
            onClick={() => createAppointment.mutate(slotId || suggestedSlot || "")}
          >
            {createAppointment.isPending ? m.creatingAppointment : m.schedule}
          </Button>
        </>
      )}
    </div>
  );
  if (variant === "confirmation" && ["CONFIRMED", "CHECKED_IN"].includes(record.status)) {
    return (
      <CheckoutConfirmation
        state={{
          confirmation: {
            bookingCode: formatReference(record.id, "BK"),
            facility: {
              name:
                state.facility?.name ??
                record.facility?.name ??
                formatReference(record.facilityId, "CS"),
              address: state.facility?.address ?? record.facility?.address ?? "",
            },
            checkInSlotStart: record.rentalStartAt,
            checkInSlotEnd: null,
            rentalEndAt: record.rentalEndAt,
            unitTypeName:
              state.unitType?.name ??
              record.unitType?.name ??
              formatReference(record.unitTypeId, "LK"),
            sizeLabel: state.unitType?.sizeLabel ?? record.unitType?.sizeLabel ?? "",
            durationMonths: record.requestedMonths,
          },
          qrDataUrl,
          paidPricing: {
            monthlyRateSnapshot: String(record.monthlyRateSnapshot),
            rentalFeeAmount: String(record.rentalFeeAmount),
            depositAmount: String(record.depositAmount),
            totalAmount: String(record.totalAmount),
            currency: "VND",
          },
          contact: { phone: appointment?.contactPhone ?? undefined },
        }}
        qrHint={checkoutMessages.reservationQrHint}
      >
        {appointmentContent && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
            {appointmentContent}
          </section>
        )}
      </CheckoutConfirmation>
    );
  }
  return (
    <section className="mx-auto max-w-3xl space-y-6 rounded-xl border border-line bg-white p-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">
          {record.status === "CONFIRMED" ? m.paid : m.detail}
        </h1>
        <p className="mt-2 text-muted">{m.statuses[record.status] ?? record.status}</p>
      </header>
      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        {[
          [m.reference, formatReference(record.id, "BK")],
          [
            m.facility,
            state.facility?.name ??
              record.facility?.name ??
              formatReference(record.facilityId, "CS"),
          ],
          [
            m.unitType,
            state.unitType?.name ??
              record.unitType?.name ??
              formatReference(record.unitTypeId, "LK"),
          ],
          [m.receiveAt, formatDateTime(record.rentalStartAt)],
          [m.rentalEnd, formatDateTime(record.rentalEndAt)],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="mt-1 break-words text-sm font-semibold text-ink">{value}</dd>
          </div>
        ))}
        <div>
          <dt className="text-sm text-muted">{m.deposit}</dt>
          <dd>
            <Currency value={record.depositAmount} />
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">{m.total}</dt>
          <dd>
            <Currency value={record.totalAmount} />
          </dd>
        </div>
      </dl>
      {appointmentContent}
      {state.cancel.isError && (
        <p role="alert" className="text-red-700">
          {customerApiError(state.cancel.error)}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <Link
          className="text-primary underline underline-offset-4"
          href={customerRoutes.reservations}
        >
          {m.back}
        </Link>
        {["DRAFT", "CONFIRMED"].includes(record.status) && (
          <Button
            variant="outline"
            loading={state.cancel.isPending}
            disabled={state.cancel.isPending}
            onClick={() => setCancelDialogOpen(true)}
          >
            {state.cancel.isPending ? m.cancelling : m.cancel}
          </Button>
        )}
      </div>

      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.cancel}</AlertDialogTitle>
            <AlertDialogDescription>{m.cancelConfirm}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline" disabled={state.cancel.isPending}>
                {m.back}
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                type="button"
                variant="danger"
                loading={state.cancel.isPending}
                onClick={() => {
                  state.cancel.mutate(undefined, {
                    onSuccess: () => setCancelDialogOpen(false),
                  });
                }}
              >
                {m.cancel}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
