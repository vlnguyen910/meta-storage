"use client";

import Link from "next/link";
import { Card, PageHeader, StatusBadge } from "@/components/ui/display";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { customerRoutes } from "@/config/routes";
import { CustomerReturnPanel } from "@/features/returns/customer-return-panel";
import { F3 } from "@/features/returns/integration.messages";
import { formatDate } from "@/lib/format";
import { useRental } from "./hooks";
import { RentalDocuments, RentalPayments } from "./rental-records";

export function RentalDetail({ rentalId }: { rentalId: string }) {
  const query = useRental(rentalId);
  if (query.isLoading) return <LoadingState variant="detail" />;
  if (query.isError || !query.data) {
    return (
      <ErrorState
        message="Không tìm thấy kho hoặc bạn không có quyền xem."
        onRetry={() => query.refetch()}
      />
    );
  }
  const rental = query.data;
  return (
    <>
      <PageHeader
        eyebrow="Kho của tôi"
        title={rental.bookingCode}
        description={`${rental.facility.name} · ${rental.unitType.name}`}
        action={<Link href={customerRoutes.rentals}>Quay lại kho của tôi</Link>}
      />
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card className="grid gap-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">
                {rental.unitType.name} · {rental.unitType.sizeLabel}
              </h2>
              <p className="m-0 text-muted">{rental.facility.address}</p>
            </div>
            <StatusBadge
              value={F3.status[rental.status as keyof typeof F3.status] ?? rental.status}
            />
          </div>
          <div className="grid grid-cols-2 gap-4 border-t border-line pt-5">
            <div>
              <small className="block text-muted">Bắt đầu thuê</small>
              <strong>{formatDate(rental.startAt)}</strong>
            </div>
            <div>
              <small className="block text-muted">Dự kiến kết thúc</small>
              <strong>{formatDate(rental.expectedEndAt)}</strong>
            </div>
            <div>
              <small className="block text-muted">Mã ô kho</small>
              <strong>{rental.physicalUnit?.code ?? "Chưa có thông tin"}</strong>
            </div>
            <div>
              <small className="block text-muted">Trạng thái đặt kho</small>
              <strong>
                {F3.status[rental.bookingStatus as keyof typeof F3.status] ?? rental.bookingStatus}
              </strong>
            </div>
          </div>
        </Card>
        <Card>
          <h2 className="mb-5 text-xl font-bold">Tiến trình thuê</h2>
          <ol className="grid gap-4">
            {rental.timeline.map((event) => (
              <li
                key={event.label}
                className="flex items-center justify-between gap-4 border-b border-line pb-3 last:border-0"
              >
                <span>
                  {F3.timelineLabels[event.label as keyof typeof F3.timelineLabels] ?? event.label}
                </span>
                <strong className="text-sm text-muted">
                  {event.at ? formatDate(event.at) : F3.timelineStatuses[event.status]}
                </strong>
              </li>
            ))}
          </ol>
        </Card>
      </div>
      <Card className="mt-5 border-primary/20 bg-primary-soft">
        <strong>Quyền thao tác hiện tại</strong>
        <p className="mb-0 mt-1 text-muted">{F3.customerReturnHelp}</p>
      </Card>
      <CustomerReturnPanel rentalId={rental.id} rentalStatus={rental.status} />
      <div className="mt-5 grid gap-5">
        <RentalPayments rentalId={rental.id} />
        <RentalDocuments rentalId={rental.id} bookingId={rental.bookingId} />
      </div>
    </>
  );
}
