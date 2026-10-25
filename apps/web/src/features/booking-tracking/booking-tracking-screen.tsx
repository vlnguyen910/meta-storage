"use client";

import {
  Calendar,
  CalendarCheck,
  Clock,
  CreditCard,
  LogOut,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  User,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { PublicLayout } from "@/components/layout/public-layout";
import { Button, buttonClassName } from "@/components/ui/button";
import { Card, StatusBadge } from "@/components/ui/display";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { bookingLookupMessages } from "./booking-lookup.messages";
import { BookingLookupForm } from "./booking-lookup-form";
import { GuestRentalRecords } from "./guest-rental-records";
import { trackingMessages as m } from "./tracking.messages";
import { useBookingTracking } from "./use-booking-tracking";

export function BookingTrackingScreen() {
  const {
    booking,
    loading,
    lookup,
    message,
    revoke,
    revoking,
    revokeError,
    retry,
    expire,
    startLookup,
  } = useBookingTracking();

  if (lookup && !loading) {
    return (
      <PublicLayout>
        <BookingLookupForm />
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <main className="mx-auto w-[min(1240px,calc(100%_-_32px))] py-8 text-slate-900 sm:py-10">
        <div className="mb-8">
          <span className="mb-2 inline-block text-xs font-bold tracking-wider text-primary uppercase">
            StoreX Tracking
          </span>
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">{m.title}</h1>
          <p className="m-0 text-sm text-muted sm:text-base">{m.description}</p>
        </div>

        {loading ? (
          <Card className="rounded-2xl border border-slate-200/80 p-8 text-center shadow-2xs">
            <p role="status" className="m-0 text-base font-semibold text-muted">
              {m.loading}
            </p>
          </Card>
        ) : null}

        {message ? (
          <Card className="rounded-2xl border border-slate-200/80 p-6 shadow-2xs">
            <p role="alert" className="mb-5 leading-relaxed text-ink">
              {message}
            </p>
            <div className="flex flex-wrap gap-3">
              {retry ? <Button onClick={retry}>{m.retry}</Button> : null}
              <Button variant="outline" onClick={() => void startLookup()}>
                {bookingLookupMessages.lookupAgain}
              </Button>
              <Link href="/" className={buttonClassName("outline")}>
                {m.home}
              </Link>
            </div>
          </Card>
        ) : null}

        {booking ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.55fr_1fr] lg:items-start">
            {/* LEFT COLUMN: Main Booking Info & Physical Units / Contracts */}
            <div className="flex flex-col gap-6">
              <Card className="rounded-2xl border border-slate-200/80 p-6 shadow-2xs">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <span className="inline-block rounded-md border border-slate-200/80 bg-slate-100 px-2.5 py-0.5 font-mono text-xs font-bold tracking-wider text-slate-700 uppercase">
                      {booking.bookingCode}
                    </span>
                    <h2 className="mt-2 text-2xl font-bold text-ink">
                      {booking.unitType.name} · {booking.unitType.sizeLabel}
                    </h2>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                      <MapPin size={15} className="shrink-0 text-slate-400" />
                      <span>
                        {booking.facility.name} · {booking.facility.address}
                      </span>
                    </p>
                  </div>
                  <StatusBadge value={booking.status} />
                </div>

                {/* 4 Metric Tiles */}
                <div className="mt-6 grid grid-cols-1 gap-3.5 border-t border-slate-100 pt-6 sm:grid-cols-2">
                  <div className="flex items-center gap-3.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                    <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-emerald-100/70 text-primary">
                      <Calendar size={18} />
                    </div>
                    <div className="min-w-0">
                      <span className="block text-[11px] font-semibold tracking-wider text-muted uppercase">
                        {m.checkIn}
                      </span>
                      <strong className="block truncate text-xs font-bold text-ink sm:text-sm">
                        {formatDateTime(booking.checkInSlotStart)} –{" "}
                        {formatDateTime(booking.checkInSlotEnd)}
                      </strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-3.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                    <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-emerald-100/70 text-primary">
                      <Clock size={18} />
                    </div>
                    <div>
                      <span className="block text-[11px] font-semibold tracking-wider text-muted uppercase">
                        {m.duration}
                      </span>
                      <strong className="text-sm font-bold text-ink">
                        {m.months(booking.durationMonths)}
                      </strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-3.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                    <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-sky-100/70 text-sky-800">
                      <CalendarCheck size={18} />
                    </div>
                    <div>
                      <span className="block text-[11px] font-semibold tracking-wider text-muted uppercase">
                        {m.rentalEnd}
                      </span>
                      <strong className="text-sm font-bold text-ink">
                        {formatDateTime(booking.rentalEndAt)}
                      </strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-3.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                    <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-emerald-100/70 text-emerald-800">
                      <Warehouse size={18} />
                    </div>
                    <div>
                      <span className="block text-[11px] font-semibold tracking-wider text-muted uppercase">
                        {m.facility}
                      </span>
                      <strong className="block truncate text-sm font-bold text-ink">
                        {booking.facility.name}
                      </strong>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Storage Units & Contracts */}
              <GuestRentalRecords code={booking.bookingCode} onExpired={expire} />
            </div>

            {/* RIGHT COLUMN: Payment, Contact & Session Actions */}
            <div className="flex flex-col gap-6">
              {/* Payment Summary Card */}
              <Card className="rounded-2xl border border-slate-200/80 p-6 shadow-2xs">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="grid size-9 place-items-center rounded-lg bg-emerald-50 text-primary">
                      <CreditCard size={18} />
                    </div>
                    <h2 className="text-lg font-bold text-ink">{m.payment}</h2>
                  </div>
                  <StatusBadge value={booking.payment.status} />
                </div>

                <div className="mt-4 flex items-center gap-1.5 text-xs text-muted">
                  <Clock size={13} className="text-slate-400" />
                  <span>
                    {m.paidAt}: {formatDateTime(booking.payment.paidAt)}
                  </span>
                </div>

                <div className="mt-4 space-y-2.5 border-t border-slate-100 pt-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted">{m.monthlyRate}</span>
                    <span className="font-semibold text-ink">
                      {formatCurrency(Number(booking.pricing.monthlyRateSnapshot))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">
                      {m.rentalFee} ({m.months(booking.durationMonths)})
                    </span>
                    <span className="font-semibold text-ink">
                      {formatCurrency(Number(booking.pricing.rentalFeeAmount))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">{m.deposit}</span>
                    <span className="font-semibold text-ink">
                      {formatCurrency(Number(booking.pricing.depositAmount))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-200/80 pt-3">
                    <strong className="text-base font-bold text-ink">{m.total}</strong>
                    <strong className="text-xl font-bold text-primary">
                      {formatCurrency(Number(booking.pricing.totalAmount))}
                    </strong>
                  </div>
                </div>
              </Card>

              {/* Contact Information Card */}
              <Card className="rounded-2xl border border-slate-200/80 p-6 shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <div className="grid size-9 place-items-center rounded-lg bg-emerald-50 text-primary">
                    <User size={18} />
                  </div>
                  <h2 className="text-lg font-bold text-ink">{m.contact}</h2>
                </div>

                <div className="mt-4 space-y-3 border-t border-slate-100 pt-4 text-sm">
                  <div className="flex items-center gap-3">
                    <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-400">
                      <User size={15} />
                    </div>
                    <div>
                      <span className="block text-[11px] font-semibold text-muted uppercase">
                        {m.fullName}
                      </span>
                      <strong className="text-sm font-semibold text-ink">
                        {booking.contact.fullName}
                      </strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-400">
                      <Mail size={15} />
                    </div>
                    <div className="min-w-0">
                      <span className="block text-[11px] font-semibold text-muted uppercase">
                        {m.email}
                      </span>
                      <strong className="block truncate text-sm font-semibold text-ink">
                        {booking.contact.email}
                      </strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-400">
                      <Phone size={15} />
                    </div>
                    <div>
                      <span className="block text-[11px] font-semibold text-muted uppercase">
                        {m.phone}
                      </span>
                      <strong className="text-sm font-semibold text-ink">
                        {booking.contact.phone}
                      </strong>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Session / Privacy Info & Revoke Action */}
              <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-5 shadow-2xs">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck size={18} className="mt-0.5 shrink-0 text-primary" />
                  <p className="m-0 text-xs leading-relaxed text-muted">{m.privacy}</p>
                </div>
                {revokeError ? (
                  <p role="alert" className="m-0 text-xs text-red-700">
                    {revokeError}
                  </p>
                ) : null}
                <Button
                  variant="outline"
                  onClick={revoke}
                  loading={revoking}
                  className="mt-2 w-full justify-center gap-2"
                >
                  <LogOut size={15} />
                  <span>{m.revoke}</span>
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </PublicLayout>
  );
}
