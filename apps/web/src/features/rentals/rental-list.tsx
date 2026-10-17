"use client";

import { Building2, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Card, PageHeader, StatusBadge } from "@/components/ui/display";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { customerRoutes } from "@/config/routes";
import { formatDate } from "@/lib/format";
import { useMyRentals } from "./hooks";

export function RentalList() {
  const query = useMyRentals();
  if (query.isLoading) return <LoadingState />;
  if (query.isError)
    return <ErrorState message="Không thể tải My Storage." onRetry={() => query.refetch()} />;
  const rentals = query.data ?? [];

  return (
    <>
      <PageHeader
        eyebrow="My Storage"
        title="Kho đang quản lý"
        description="Theo dõi các Rental thuộc tài khoản của bạn."
      />
      {rentals.length === 0 ? (
        <Card className="grid min-h-48 place-items-center text-center">
          <div>
            <Building2 className="mx-auto mb-3 text-primary" />
            <h2 className="text-xl font-bold">Chưa có Rental</h2>
            <p className="text-muted">Các Rental đã thanh toán sẽ xuất hiện tại đây.</p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rentals.map((rental) => (
            <Link key={rental.id} href={customerRoutes.rental(rental.id)}>
              <Card className="grid grid-cols-[1.4fr_1fr_1fr_auto] items-center gap-5 transition hover:-translate-y-px hover:border-primary max-[700px]:grid-cols-1">
                <div>
                  <small className="text-muted">{rental.bookingCode}</small>
                  <h2 className="text-xl font-bold">
                    {rental.unitType.name} · {rental.unitType.sizeLabel}
                  </h2>
                  <p className="m-0 text-muted">{rental.facility.name}</p>
                </div>
                <div>
                  <small className="block text-muted">Thời hạn</small>
                  <strong>
                    {formatDate(rental.startAt)} – {formatDate(rental.expectedEndAt)}
                  </strong>
                </div>
                <div>
                  <small className="block text-muted">Physical unit</small>
                  <strong>{rental.physicalUnit?.code ?? "Chưa phân công"}</strong>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge value={rental.status} />
                  <ChevronRight className="text-muted" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
