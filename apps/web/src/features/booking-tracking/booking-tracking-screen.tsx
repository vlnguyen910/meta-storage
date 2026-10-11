"use client";
import Link from "next/link";
import { Button, buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/display";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { trackingMessages as m } from "./tracking.messages";
import { useBookingTracking } from "./use-booking-tracking";

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="mb-1 text-sm text-slate-600">{label}</dt>
      <dd className="m-0 break-words font-semibold text-slate-900">{value}</dd>
    </div>
  );
}
export function BookingTrackingScreen() {
  const { booking, loading, message, revoke, revoking, revokeError, retry } = useBookingTracking();
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-5 py-5">
        <div className="mx-auto max-w-4xl">
          <Link
            href="/"
            className="text-xl font-bold text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            {m.brand}
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-6 px-5 py-8 sm:py-12">
        <div>
          <h1 className="mb-2 text-3xl font-bold">{m.title}</h1>
          <p className="text-slate-600">{m.description}</p>
        </div>
        {loading ? (
          <p role="status" className="rounded-xl bg-white p-6">
            {m.loading}
          </p>
        ) : null}
        {message ? (
          <Card>
            <p role="alert" className="mb-5 leading-relaxed">
              {message}
            </p>
            <div className="flex flex-wrap gap-3">
              {retry ? <Button onClick={retry}>{m.retry}</Button> : null}
              <Link href="/" className={buttonClassName("outline")}>
                {m.home}
              </Link>
            </div>
          </Card>
        ) : null}
        {booking ? (
          <>
            <Card>
              <dl className="grid gap-6 sm:grid-cols-2">
                <Detail label={m.bookingCode} value={booking.bookingCode} />
                <Detail label={m.status} value={m.statuses[booking.status]} />
                <Detail label={m.facility} value={booking.facility.name} />
                <Detail label={m.address} value={booking.facility.address} />
                <Detail
                  label={m.unitType}
                  value={`${booking.unitType.name} · ${booking.unitType.sizeLabel}`}
                />
                <Detail label={m.duration} value={m.months(booking.durationMonths)} />
                <Detail
                  label={m.checkIn}
                  value={`${formatDateTime(booking.checkInSlotStart)} – ${formatDateTime(booking.checkInSlotEnd)}`}
                />
                <Detail label={m.rentalEnd} value={formatDateTime(booking.rentalEndAt)} />
              </dl>
            </Card>
            <Card>
              <h2 className="mb-5 text-xl font-bold">{m.contact}</h2>
              <dl className="grid gap-6 sm:grid-cols-2">
                <Detail label={m.fullName} value={booking.contact.fullName} />
                <Detail label={m.email} value={booking.contact.email} />
                <Detail label={m.phone} value={booking.contact.phone} />
              </dl>
            </Card>
            <Card>
              <h2 className="mb-5 text-xl font-bold">{m.payment}</h2>
              <dl className="grid gap-6 sm:grid-cols-2">
                <Detail label={m.status} value={m.statuses[booking.payment.status]} />
                <Detail label={m.paidAt} value={formatDateTime(booking.payment.paidAt)} />
                <Detail
                  label={m.monthlyRate}
                  value={formatCurrency(Number(booking.pricing.monthlyRateSnapshot))}
                />
                <Detail
                  label={m.rentalFee}
                  value={formatCurrency(Number(booking.pricing.rentalFeeAmount))}
                />
                <Detail
                  label={m.deposit}
                  value={formatCurrency(Number(booking.pricing.depositAmount))}
                />
                <Detail
                  label={m.total}
                  value={formatCurrency(Number(booking.pricing.totalAmount))}
                />
              </dl>
            </Card>
            <p className="text-sm leading-relaxed text-slate-600">{m.privacy}</p>
            {revokeError ? (
              <p role="alert" className="text-red-700">
                {revokeError}
              </p>
            ) : null}
            <Button variant="outline" onClick={revoke} loading={revoking}>
              {m.revoke}
            </Button>
          </>
        ) : null}
      </main>
    </div>
  );
}
