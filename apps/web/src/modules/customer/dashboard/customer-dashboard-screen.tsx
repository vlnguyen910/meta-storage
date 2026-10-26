"use client";
import { CUSTOMER_WORKSPACE as M } from "@metastorage/shared";
import Link from "next/link";
import { PageHeader, StatusBadge } from "@/components/ui/display";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { customerRoutes } from "@/config/routes";
import { useCustomerBookings } from "@/features/bookings/customer-bookings.hooks";
import { useMyRentals } from "@/features/rentals/hooks";
import { formatDateTime } from "@/lib/format";

export function CustomerDashboardScreen() {
  const bookings = useCustomerBookings();
  const rentals = useMyRentals();
  return (
    <>
      <PageHeader
        title={M.dashboard}
        description={M.appointment}
        action={<Link href={customerRoutes.newReservation}>{M.newBooking}</Link>}
      />
      <section className="my-6 grid gap-4">
        <h2 className="text-2xl font-bold">{M.recent}</h2>
        {bookings.isPending ? (
          <LoadingState />
        ) : bookings.isError ? (
          <ErrorState message={M.error} onRetry={() => bookings.refetch()} />
        ) : (
          <>
            {!bookings.data.pages[0]?.items.length && <p>{M.empty}</p>}
            {bookings.data.pages[0]?.items.slice(0, 3).map((b) => (
              <Link
                className="rounded-xl border border-line bg-white p-5"
                href={customerRoutes.reservation(b.id)}
                key={b.id}
              >
                <strong>{b.bookingCode ?? b.id}</strong> <StatusBadge value={b.status} />
                <p>
                  {b.facility.name} ? {b.unitType.name}
                </p>
                <p>
                  {M.appointment}: {formatDateTime(b.checkInSlotStart)}
                </p>
              </Link>
            ))}
            <Link href={customerRoutes.reservations}>{M.bookings}</Link>
          </>
        )}
      </section>
      <section className="my-6 grid gap-4">
        <h2 className="text-2xl font-bold">{M.storage}</h2>
        {rentals.isPending ? (
          <LoadingState />
        ) : rentals.isError ? (
          <ErrorState message={M.error} onRetry={() => rentals.refetch()} />
        ) : (
          <>
            {!rentals.data.pages[0]?.items.length && <p>{M.empty}</p>}
            {rentals.data.pages[0]?.items.slice(0, 3).map((r) => (
              <Link
                className="rounded-xl border border-line bg-white p-5"
                href={customerRoutes.rental(r.id)}
                key={r.id}
              >
                <strong>
                  {r.facility.name} ? {r.physicalUnit?.code ?? r.unitType.name}
                </strong>
                <p>
                  {M.oldEnd}: {formatDateTime(r.expectedEndAt)}
                </p>
              </Link>
            ))}
            <Link href={customerRoutes.rentals}>{M.storage}</Link>
          </>
        )}
      </section>
    </>
  );
}
