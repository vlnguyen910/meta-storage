"use client";

import { CalendarDays, MapPin, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { buttonClassName } from "@/components/ui/button";
import { Currency, PageHeader, StatusBadge } from "@/components/ui/display";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { routes } from "@/config/routes";
import { formatDate } from "@/lib/format";
import { useMyReservations } from "./hooks";
import { RESERVATION_MESSAGES as M } from "./reservation.messages";

export function ReservationList() {
  const query = useMyReservations();
  const [requestedPage, setPage] = useState(1);
  const pageSize = 6;
  const page = Math.min(
    requestedPage,
    Math.max(1, Math.ceil((query.data?.length ?? 0) / pageSize)),
  );
  if (query.isLoading) return <LoadingState variant="table" />;
  if (query.isError)
    return (
      <ErrorState message="Không thể tải danh sách reservation." onRetry={() => query.refetch()} />
    );
  return (
    <>
      <PageHeader
        eyebrow="Kho của tôi"
        title="Reservation"
        description="Theo dõi các lượt đặt kho và trạng thái tiền cọc."
        action={
          <Link
            className={buttonClassName("primary", "max-[560px]:w-full")}
            href={routes.customer.newReservation}
          >
            <Plus size={18} />
            Đặt kho mới
          </Link>
        }
      />
      {query.data?.length === 0 ? (
        <EmptyState
          title="Bạn chưa có reservation"
          description="Tìm một cơ sở và hoàn tất đặt chỗ đầu tiên."
        />
      ) : (
        <div className="grid gap-3">
          {query.data?.slice((page - 1) * pageSize, page * pageSize).map((reservation) => (
            <Link
              href={routes.customer.reservation(reservation.id)}
              className="grid grid-cols-[1.2fr_2fr_1fr_1fr] items-center gap-5 rounded-card border border-line bg-white p-6 shadow-soft transition hover:-translate-y-px hover:border-[#a9c8bf] max-[800px]:grid-cols-2 max-[560px]:grid-cols-1"
              key={reservation.id}
            >
              <div className="grid gap-1.5">
                <small className="text-muted">Mã reservation</small>
                <strong>{reservation.code}</strong>
                <StatusBadge value={reservation.status} />
              </div>
              <div className="grid gap-1.5">
                <span className="flex items-center gap-1 text-xs text-muted">
                  <MapPin />
                  {reservation.facility.name}
                </span>
                <strong>
                  {reservation.unitType} · {reservation.sizeLabel}
                </strong>
              </div>
              <div className="grid gap-1.5">
                <span className="flex items-center gap-1 text-xs text-muted">
                  <CalendarDays />
                  Bắt đầu
                </span>
                <strong>{formatDate(reservation.startDate)}</strong>
              </div>
              <div className="grid gap-1.5">
                <span className="text-xs text-muted">Tiền cọc</span>
                <strong>
                  <Currency value={reservation.depositAmount} />
                </strong>
              </div>
            </Link>
          ))}
        </div>
      )}
      {query.data && query.data.length > pageSize ? (
        <nav
          className="flex flex-wrap items-center justify-center gap-3"
          aria-label="Phân trang reservation"
        >
          <button
            type="button"
            className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            {M.previousPage}
          </button>
          <span className="text-sm font-semibold text-slate-600">
            {M.pageOf(page, Math.ceil(query.data.length / pageSize))}
          </span>
          <button
            type="button"
            className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold"
            disabled={page >= Math.ceil(query.data.length / pageSize)}
            onClick={() => setPage(page + 1)}
          >
            {M.nextPage}
          </button>
        </nav>
      ) : null}
    </>
  );
}
