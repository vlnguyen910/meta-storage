"use client";
import { CUSTOMER_WORKSPACE as M } from "@metastorage/shared";
import { CalendarDays, Clock3, MapPin, Plus, WalletCards } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShadcnButton } from "@/components/ui/shadcn-button";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { customerRoutes } from "@/config/routes";
import { useCustomerBookings } from "@/features/bookings/customer-bookings.hooks";
import { useMyRentals } from "@/features/rentals/hooks";
import { formatDateTime } from "@/lib/format";
import { CUSTOMER_DASHBOARD_MESSAGES as D } from "./customer-dashboard.messages";

export function CustomerDashboardScreen() {
  const router = useRouter();
  const bookings = useCustomerBookings();
  const rentals = useMyRentals();
  const recentBookings = bookings.data?.pages[0]?.items.slice(0, 3) ?? [];
  const currentRentals = rentals.data?.pages[0]?.items.slice(0, 3) ?? [];
  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{M.dashboard}</h1>
          <p className="mt-1 text-sm text-slate-500">{M.appointment}</p>
        </div>
        <ShadcnButton
          className="w-full bg-primary hover:bg-primary-dark sm:w-auto"
          onClick={() => router.push(customerRoutes.newReservation)}
        >
          <Plus className="size-4" aria-hidden="true" />
          {M.newBooking}
        </ShadcnButton>
      </header>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,1fr)]">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>{M.recent}</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Các lịch nhận kho gần nhất</p>
            </div>
            <Link
              className="text-sm font-semibold text-primary hover:underline"
              href={customerRoutes.reservations}
            >
              {M.bookings}
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {bookings.isPending ? (
              <LoadingState />
            ) : bookings.isError ? (
              <ErrorState message={M.error} onRetry={() => bookings.refetch()} />
            ) : (
              <>
                {!recentBookings.length && <p className="text-sm text-slate-500">{M.empty}</p>}
                {recentBookings.map((b) => (
                  <Link
                    className="block rounded-xl border border-slate-200/80 bg-white p-4 transition hover:border-primary/30 hover:shadow-sm"
                    href={customerRoutes.reservation(b.id)}
                    key={b.id}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong className="text-base font-bold text-slate-900">
                        {b.bookingCode ?? b.id}
                      </strong>
                      <Badge
                        className={
                          D.bookingStatusClass[b.status as keyof typeof D.bookingStatusClass] ??
                          "border-slate-200 bg-slate-100 text-slate-700"
                        }
                      >
                        {D.bookingStatus[b.status as keyof typeof D.bookingStatus] ?? b.status}
                      </Badge>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-600">
                      <span className="flex items-center gap-2">
                        <MapPin className="size-4 text-slate-400" />
                        {b.facility.name} · {b.unitType.name}
                      </span>
                      <span className="flex items-center gap-2">
                        <CalendarDays className="size-4 text-slate-400" />
                        {formatDateTime(b.checkInSlotStart)}
                      </span>
                      <span
                        className={`flex items-center gap-2 ${b.paymentStatus === "SUCCEEDED" ? "text-emerald-700" : "text-slate-500"}`}
                      >
                        <WalletCards className="size-4" />
                        {b.paymentStatus === "SUCCEEDED" ? D.paymentSucceeded : D.paymentPending}
                      </span>
                    </div>
                  </Link>
                ))}
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{M.storage}</CardTitle>
            <p className="text-sm text-slate-500">Các kho đang được bạn quản lý</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {rentals.isPending ? (
              <LoadingState />
            ) : rentals.isError ? (
              <ErrorState message={M.error} onRetry={() => rentals.refetch()} />
            ) : (
              <>
                {!currentRentals.length && <p className="text-sm text-slate-500">{M.empty}</p>}
                {currentRentals.map((r) => (
                  <Link
                    className="flex items-start gap-3 rounded-xl border border-slate-200/80 p-4 transition hover:border-primary/30 hover:shadow-sm"
                    href={customerRoutes.rental(r.id)}
                    key={r.id}
                  >
                    <span className="mt-0.5 rounded-lg bg-primary-soft p-2 text-primary">
                      <Clock3 className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <strong className="block truncate text-sm font-bold text-slate-900">
                        {r.facility.name} · {r.physicalUnit?.code ?? r.unitType.name}
                      </strong>
                      <span className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                        <Clock3 className="size-3.5" />
                        {M.oldEnd}: {formatDateTime(r.expectedEndAt)}
                      </span>
                    </span>
                  </Link>
                ))}
                <Link href={customerRoutes.rentals}>{M.storage}</Link>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
