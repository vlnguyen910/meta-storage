"use client";

import { CalendarDays, CheckCircle2, CreditCard, MapPin, PackageCheck } from "lucide-react";
import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";
import { Card, Currency, PageHeader, StatusBadge } from "@/components/ui/display";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { routes } from "@/config/routes";
import { formatDate } from "@/lib/format";
import { useReservation } from "./hooks";

export function ReservationDetail({ reservationId }: { reservationId: string }) {
  const query = useReservation(reservationId);
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data)
    return (
      <ErrorState
        message="Reservation không tồn tại hoặc bạn không có quyền truy cập."
        onRetry={() => query.refetch()}
      />
    );
  const reservation = query.data;
  return (
    <>
      <PageHeader
        eyebrow="Chi tiết reservation"
        title={reservation.code}
        description="Reservation đã được xác nhận và đang chờ ngày check-in."
        action={
          <Link className={buttonClassName("outline")} href={routes.customer.reservations}>
            Quay lại danh sách
          </Link>
        }
      />
      <div className="grid grid-cols-[minmax(0,1fr)_330px] items-start gap-6 max-[800px]:grid-cols-1">
        <div className="grid gap-6">
          <Card>
            <div className="flex justify-between gap-5">
              <div>
                <h2 className="text-2xl font-bold">
                  {reservation.unitType} · {reservation.sizeLabel}
                </h2>
                <p className="m-0 flex items-center gap-2 text-muted">
                  <MapPin />
                  {reservation.facility.name}
                </p>
              </div>
              <StatusBadge value={reservation.status} />
            </div>
            <div className="mt-5 grid grid-cols-4 gap-4 border-t border-line pt-5 max-[800px]:grid-cols-2 max-[560px]:grid-cols-1">
              <span className="grid gap-1.5">
                <small className="text-muted">Ngày bắt đầu</small>
                <strong>{formatDate(reservation.startDate)}</strong>
              </span>
              <span className="grid gap-1.5">
                <small className="text-muted">Ngày kết thúc dự kiến</small>
                <strong>{formatDate(reservation.endDate)}</strong>
              </span>
              <span className="grid gap-1.5">
                <small className="text-muted">Thời hạn</small>
                <strong>{reservation.durationMonths} tháng</strong>
              </span>
              <span className="grid gap-1.5">
                <small className="text-muted">Giá thuê tháng</small>
                <strong>
                  <Currency value={reservation.monthlyPrice} />
                </strong>
              </span>
            </div>
          </Card>
          <Card>
            <h2 className="text-2xl font-bold">Tiến trình</h2>
            <div className="grid">
              <div className="relative grid grid-cols-[34px_1fr] gap-3 pb-6 text-accent after:absolute after:top-7 after:bottom-0 after:left-[11px] after:w-0.5 after:bg-slate-200">
                <CheckCircle2 />
                <span>
                  <strong className="block text-ink">Đặt chỗ và thanh toán</strong>
                  <small className="mt-1 block text-muted">
                    {formatDate(reservation.createdAt)}
                  </small>
                </span>
              </div>
              <div className="relative grid grid-cols-[34px_1fr] gap-3 pb-6 text-slate-400 after:absolute after:top-7 after:bottom-0 after:left-[11px] after:w-0.5 after:bg-slate-200">
                <CalendarDays />
                <span>
                  <strong className="block text-ink">Chờ ngày check-in</strong>
                  <small className="mt-1 block text-muted">
                    {formatDate(reservation.startDate)}
                  </small>
                </span>
              </div>
              <div className="grid grid-cols-[34px_1fr] gap-3 text-slate-400">
                <PackageCheck />
                <span>
                  <strong className="block text-ink">Phân công unit và bàn giao</strong>
                  <small className="mt-1 block text-muted">Được thực hiện tại cơ sở</small>
                </span>
              </div>
            </div>
          </Card>
        </div>
        <aside className="grid gap-4">
          <Card className="grid gap-3.5">
            <CreditCard className="text-primary" />
            <span className="text-xs font-extrabold tracking-[0.13em] text-primary uppercase">
              Thanh toán tiền cọc
            </span>
            <StatusBadge value={reservation.payment.status} />
            <div className="flex justify-between text-sm">
              <span className="text-muted">Số tiền</span>
              <strong>
                <Currency value={reservation.payment.amount} />
              </strong>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Phương thức</span>
              <strong>
                {reservation.payment.brand} •••• {reservation.payment.last4}
              </strong>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Thời gian</span>
              <strong>{formatDate(reservation.payment.paidAt)}</strong>
            </div>
          </Card>
          <div className="flex gap-3 rounded-xl bg-primary-soft p-4 text-primary">
            <CheckCircle2 />
            <div>
              <strong>Unit chưa được phân công</strong>
              <p className="mt-1 mb-0 text-xs text-muted">
                Mã kho và thông tin truy cập sẽ hiển thị sau khi nhân viên hoàn tất check-in.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
