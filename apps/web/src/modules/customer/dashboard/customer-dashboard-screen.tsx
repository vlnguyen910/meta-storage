"use client";

import { ArrowRight, Building2, CalendarCheck2, Plus, WalletCards } from "lucide-react";
import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";
import { Currency, PageHeader, StatusBadge } from "@/components/ui/display";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { customerRoutes } from "@/config/routes";
import { useMyReservations } from "@/features/reservations/hooks";
import { formatDate } from "@/lib/format";

export function CustomerDashboardScreen() {
  const query = useMyReservations();
  if (query.isLoading) return <LoadingState />;
  if (query.isError) {
    return (
      <ErrorState message="Không thể tải tổng quan tài khoản." onRetry={() => query.refetch()} />
    );
  }

  const reservations = query.data ?? [];
  const deposited = reservations.reduce((total, item) => total + item.depositAmount, 0);
  return (
    <>
      <PageHeader
        eyebrow="Customer dashboard"
        title="Không gian của bạn"
        description="Quản lý reservation và bắt đầu hành trình lưu trữ mới."
        action={
          <Link
            className={buttonClassName("primary", "max-[560px]:w-full")}
            href={customerRoutes.newReservation}
          >
            <Plus size={18} />
            Đặt kho mới
          </Link>
        }
      />
      <div className="grid grid-cols-3 gap-[18px] max-[800px]:grid-cols-2 max-[560px]:grid-cols-1">
        <article className="relative flex min-h-[175px] flex-col rounded-card border border-line bg-white p-5 shadow-soft">
          <span className="absolute top-[18px] right-[18px] grid size-9 place-items-center rounded-[10px] bg-primary-soft text-primary">
            <CalendarCheck2 />
          </span>
          <small className="font-bold text-muted">Reservation</small>
          <strong className="my-4 text-3xl text-primary">{reservations.length}</strong>
          <p className="mt-auto mb-0 text-xs text-muted">Đã xác nhận trong tài khoản</p>
        </article>
        <article className="relative flex min-h-[175px] flex-col rounded-card border border-line bg-white p-5 shadow-soft">
          <span className="absolute top-[18px] right-[18px] grid size-9 place-items-center rounded-[10px] bg-primary-soft text-primary">
            <WalletCards />
          </span>
          <small className="font-bold text-muted">Tiền cọc đã trả</small>
          <strong className="my-4 text-3xl text-accent">
            <Currency value={deposited} />
          </strong>
          <p className="mt-auto mb-0 text-xs text-muted">Qua thanh toán demo</p>
        </article>
        <article className="relative flex min-h-[175px] flex-col rounded-card border border-line bg-white p-5 shadow-soft">
          <span className="absolute top-[18px] right-[18px] grid size-9 place-items-center rounded-[10px] bg-primary-soft text-primary">
            <Building2 />
          </span>
          <small className="font-bold text-muted">Cơ sở khả dụng</small>
          <strong className="my-4 text-3xl text-secondary">3</strong>
          <p className="mt-auto mb-0 text-xs text-muted">TP.HCM, Hà Nội, Đà Nẵng</p>
        </article>
      </div>
      <section className="mt-9">
        <div className="mb-8 flex items-end justify-between gap-6">
          <div>
            <span className="mb-2.5 inline-block text-xs font-extrabold tracking-[0.13em] text-primary uppercase">
              Gần đây
            </span>
            <h2 className="text-3xl font-bold">Reservation của tôi</h2>
          </div>
          <Link href={customerRoutes.reservations}>
            Xem tất cả <ArrowRight size={16} />
          </Link>
        </div>
        {reservations.length ? (
          <div className="grid gap-3">
            {reservations.slice(0, 3).map((item) => (
              <Link
                className="grid grid-cols-[1.2fr_2fr_1fr] items-center gap-5 rounded-card border border-line bg-white p-6 shadow-soft transition hover:-translate-y-px hover:border-[#a9c8bf] max-[800px]:grid-cols-2 max-[560px]:grid-cols-1"
                key={item.id}
                href={customerRoutes.reservation(item.id)}
              >
                <div className="grid gap-1.5">
                  <small className="text-muted">Mã reservation</small>
                  <strong>{item.code}</strong>
                  <StatusBadge value={item.status} />
                </div>
                <div className="grid gap-1.5">
                  <span className="text-xs text-muted">Cơ sở</span>
                  <strong>{item.facility.name}</strong>
                </div>
                <div className="grid gap-1.5">
                  <span className="text-xs text-muted">Bắt đầu</span>
                  <strong>{formatDate(item.startDate)}</strong>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4 rounded-card border border-line bg-white p-6 shadow-soft max-[560px]:flex-col max-[560px]:items-stretch">
            <div>
              <h3>Sẵn sàng cho không gian mới?</h3>
              <p>Chọn loại kho và hoàn tất reservation trong vài phút.</p>
            </div>
            <Link className={buttonClassName("outline")} href={customerRoutes.facilities}>
              Khám phá cơ sở
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
