"use client";
import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Currency } from "@/components/ui/display";
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
          <label className="block text-sm">
            {m.chooseSlot}
            <select
              className="mt-2 block min-h-11 w-full rounded-lg border border-line px-3"
              value={slotId || suggestedSlot || ""}
              onChange={(event) => setSlotId(event.target.value)}
            >
              <option value="">{m.chooseSlot}</option>
              {state.slots.map((slot) => (
                <option value={slot.id} key={slot.id}>
                  {slot.name} · {slot.startTime.slice(0, 5)}–{slot.endTime.slice(0, 5)}
                </option>
              ))}
            </select>
          </label>
          <Button
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
            bookingCode: record.id,
            facility: {
              name: state.facility?.name ?? record.facility?.name ?? record.facilityId,
              address: state.facility?.address ?? record.facility?.address ?? "",
            },
            checkInSlotStart: record.rentalStartAt,
            checkInSlotEnd: null,
            rentalEndAt: record.rentalEndAt,
            unitTypeName: state.unitType?.name ?? record.unitType?.name ?? record.unitTypeId,
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
          [m.reference, record.id],
          [m.facility, state.facility?.name ?? record.facilityId],
          [m.unitType, state.unitType?.name ?? record.unitTypeId],
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
            disabled={state.cancel.isPending}
            onClick={() => {
              if (window.confirm(m.cancelConfirm)) state.cancel.mutate();
            }}
          >
            {state.cancel.isPending ? m.cancelling : m.cancel}
          </Button>
        )}
      </div>
    </section>
  );
}
