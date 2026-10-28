"use client";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/display";
import { OperationalBackLink, OperationalPageHeader } from "@/components/ui/operational";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { formatDateTime } from "@/lib/format";
import { useRental } from "./hooks";
import { RentalPayments } from "./rental-records";
import { RENTAL_MESSAGES as M } from "./rentals.messages";
export function RentalDetail({ rentalId }: { rentalId: string }) {
  const query = useRental(rentalId);
  if (query.isPending) return <LoadingState variant="detail" />;
  if (query.isError)
    return <ErrorState message={M.notFoundOrForbidden} onRetry={() => query.refetch()} />;
  const r = query.data;
  return (
    <div className="space-y-6">
      <OperationalBackLink href="/customer/storage">{M.backToStorage}</OperationalBackLink>
      <OperationalPageHeader
        title={r.bookingCode}
        description={`${r.facility.name} · ${r.unitType.name}`}
      />
      <Card className="space-y-4 p-6">
        <StatusBadge value={r.status} />
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt>{M.unitCode}</dt>
            <dd>{r.storageUnit?.code}</dd>
          </div>
          <div>
            <dt>{M.facilityAddress}</dt>
            <dd>{r.facility.address}</dd>
          </div>
          <div>
            <dt>{M.startDate}</dt>
            <dd>{formatDateTime(r.startAt)}</dd>
          </div>
          <div>
            <dt>{M.endDate}</dt>
            <dd>{formatDateTime(r.endAt)}</dd>
          </div>
        </dl>
        <Link
          className="font-semibold text-primary underline"
          href={`/customer/support/new?bookingId=${encodeURIComponent(r.bookingId)}`}
        >
          {M.support}
        </Link>
      </Card>
      <RentalPayments rentalId={rentalId} />
    </div>
  );
}
