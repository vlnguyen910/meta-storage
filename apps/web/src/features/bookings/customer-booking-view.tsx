"use client";
import { CUSTOMER_WORKSPACE as M } from "@metastorage/shared";
import {
  ArrowLeft,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  HelpCircle,
  MapPin,
  QrCode as QrIcon,
  Warehouse,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent, Card as ShadcnCard } from "@/components/ui/card";
import { Card, PageHeader, StatusBadge } from "@/components/ui/display";
import { ListPagination } from "@/components/ui/list-pagination";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { customerRoutes } from "@/config/routes";
import { customerApiError } from "@/features/bookings/customer-error";
import { money } from "@/features/returns/integration-utils";
import { formatDateTime } from "@/lib/format";
import {
  useCancelCustomerBooking,
  useCustomerBooking,
  useCustomerBookings,
} from "./customer-bookings.hooks";

export function CustomerBookingList() {
  const query = useCustomerBookings();
  const [page, setPage] = useState(1);
  const pageSize = 6;
  useEffect(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
  }, [query.hasNextPage, query.isFetchingNextPage, query.fetchNextPage]);
  const bookings = query.data?.pages.flatMap((p) => p.items) ?? [];
  const safePage = Math.min(page, Math.max(1, Math.ceil(bookings.length / pageSize)));
  const visibleBookings = bookings.slice((safePage - 1) * pageSize, safePage * pageSize);
  const statusLabel: Record<string, string> = {
    CONFIRMED: "Đã xác nhận",
    CHECKED_IN: "Đã check-in",
    NO_SHOW: "Không đến",
    CANCELLED: "Đã hủy",
  };
  const statusClass: Record<string, string> = {
    CONFIRMED: "border-emerald-200 bg-emerald-50 text-emerald-800",
    CHECKED_IN: "border-sky-200 bg-sky-50 text-sky-800",
    NO_SHOW: "border-rose-200 bg-rose-50 text-rose-800",
    CANCELLED: "border-slate-200 bg-slate-100 text-slate-700",
  };
  return (
    <>
      <PageHeader
        title={M.bookings}
        description={M.appointment}
        action={
          <Link
            className="inline-flex min-h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            href={customerRoutes.newReservation}
          >
            {M.newBooking}
          </Link>
        }
      />
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState message={customerApiError(query.error)} onRetry={() => query.refetch()} />
      ) : (
        <>
          {!bookings.length && <p>{M.empty}</p>}
          <div className="grid gap-4">
            {visibleBookings.map((b) => (
              <ShadcnCard
                key={b.id}
                className="overflow-hidden border-slate-200/80 bg-white transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
              >
                <Link href={customerRoutes.reservation(b.id)}>
                  <CardContent className="space-y-4 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <strong className="text-lg font-bold tracking-tight text-slate-900">
                        {b.bookingCode ?? b.id}
                      </strong>
                      <Badge
                        className={
                          statusClass[b.status] ?? "border-slate-200 bg-slate-100 text-slate-700"
                        }
                      >
                        {statusLabel[b.status] ?? b.status}
                      </Badge>
                    </div>
                    <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                      <span className="flex items-center gap-2 sm:col-span-2">
                        <Warehouse className="size-4 text-primary" aria-hidden="true" />
                        {b.facility.name} · {b.unitType.name} · {b.unitType.sizeLabel}
                      </span>
                      <span className="flex items-center gap-2">
                        <MapPin className="size-4 text-slate-400" aria-hidden="true" />
                        {b.facility.address}
                      </span>
                      <span className="flex items-center gap-2">
                        <CalendarClock className="size-4 text-slate-400" aria-hidden="true" />
                        {formatDateTime(b.checkInSlotStart)}
                      </span>
                      <span
                        className={`flex items-center gap-2 ${b.paymentStatus === "SUCCEEDED" ? "text-emerald-700" : "text-slate-500"}`}
                      >
                        <CircleDollarSign className="size-4" aria-hidden="true" />
                        {b.paymentStatus === "SUCCEEDED" ? "Đã thanh toán" : b.paymentStatus}
                      </span>
                    </div>
                  </CardContent>
                </Link>
              </ShadcnCard>
            ))}
          </div>
          <ListPagination
            label={M.bookings}
            page={safePage}
            pageSize={pageSize}
            total={bookings.length}
            pending={query.isFetchingNextPage}
            onPageChange={setPage}
          />
          {query.isFetchNextPageError && <p role="alert">{M.error}</p>}
        </>
      )}
    </>
  );
}

export function CustomerBookingDetail({ id }: { id: string }) {
  const query = useCustomerBooking(id);
  const cancel = useCancelCustomerBooking(id);
  const [qr, setQr] = useState<string>();
  const qrUrl = query.data?.confirmation?.qrUrl;
  useEffect(() => {
    setQr(undefined);
    let active = true;
    if (qrUrl)
      QRCode.toDataURL(qrUrl)
        .then((url) => {
          if (active) setQr(url);
        })
        .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [qrUrl]);
  if (query.isPending) return <LoadingState />;
  if (query.isError)
    return <ErrorState message={customerApiError(query.error)} onRetry={() => query.refetch()} />;
  const b = query.data;
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Chi tiết đơn đặt kho"
        title={b.bookingCode ?? b.id}
        description={`${b.facility.name} · ${b.unitType.name}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href={`${customerRoutes.supportNew}?reservationId=${encodeURIComponent(id)}`}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900"
            >
              <HelpCircle className="size-4" />
              <span>Gửi yêu cầu hỗ trợ</span>
            </Link>
            <Link
              href={`${customerRoutes.rentals}?tab=reservations`}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900"
            >
              <ArrowLeft className="size-4" />
              <span>Quay lại danh sách</span>
            </Link>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        {/* Left Column: Thông tin nhận kho & bàn giao */}
        <div className="space-y-6">
          <Card className="rounded-2xl border-slate-200/80 p-6 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Trạng thái đơn
                </span>
                <div>
                  <StatusBadge value={b.status} />
                </div>
              </div>
              {b.rentalId && (
                <Link
                  href={customerRoutes.rental(b.rentalId)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
                >
                  <Warehouse className="size-3.5" />
                  <span>Xem kho đã nhận</span>
                </Link>
              )}
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Cơ sở lưu trữ
                </span>
                <p className="mt-1 text-base font-bold text-slate-900">{b.facility.name}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-600">
                  <MapPin className="size-4 text-slate-400 shrink-0" />
                  <span>{b.facility.address}</span>
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                    <CalendarDays className="size-3.5 text-slate-400" />
                    Khung giờ nhận kho
                  </span>
                  <p className="mt-1 text-sm font-bold text-slate-800">
                    {formatDateTime(b.checkInSlotStart)}
                  </p>
                  <p className="text-xs text-slate-500">đến {formatDateTime(b.checkInSlotEnd)}</p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                    <Warehouse className="size-3.5 text-slate-400" />Ô kho được phân công
                  </span>
                  <p className="mt-1 text-sm font-bold text-slate-800">
                    {b.assignedUnit?.code ? (
                      <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-800">
                        {b.assignedUnit.code}
                      </span>
                    ) : (
                      <span className="font-normal text-slate-500 italic">
                        Chờ phân công tại quầy
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Giai đoạn: {b.handoverStage || "Chờ check-in"}
                  </p>
                </div>
              </div>

              {b.status === "CONFIRMED" && (
                <div className="border-t border-slate-100 pt-4">
                  <Button
                    variant="outline"
                    className="w-full border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 sm:w-auto text-xs"
                    disabled={cancel.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Bạn có chắc chắn muốn hủy đơn đặt kho này theo chính sách hiện hành?",
                        )
                      ) {
                        cancel.mutate();
                      }
                    }}
                  >
                    Hủy đơn đặt kho
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column: QR Code & Thanh toán */}
        <div className="space-y-6">
          <Card className="rounded-2xl border-slate-200/80 p-6 shadow-2xs">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <QrIcon className="size-5 text-primary" />
              <span>Mã QR nhận kho</span>
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Xuất trình mã này cho nhân viên lễ tân tại cơ sở để bắt đầu thủ tục nhận kho.
            </p>

            <div className="my-4 flex justify-center">
              {qr ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
                  <Image
                    unoptimized
                    src={qr}
                    width={200}
                    height={200}
                    alt="Mã QR nhận kho"
                    className="rounded-lg"
                  />
                </div>
              ) : (
                <div className="grid h-48 w-full place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center p-4">
                  <p className="text-xs text-slate-500">
                    Mã QR đang được xử lý hoặc chưa khả dụng cho trạng thái này.
                  </p>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Trạng thái thanh toán</span>
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${
                    b.paymentStatus === "SUCCEEDED"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  <CheckCircle2 className="size-3" />
                  {b.paymentStatus === "SUCCEEDED" ? "Đã thanh toán" : "Chờ thanh toán"}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Giá thuê theo tháng</span>
                <span className="font-semibold text-slate-800">
                  {money(b.pricing.monthlyRateSnapshot)}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Tiền thuê kỳ đầu</span>
                <span className="font-semibold text-slate-800">
                  {money(b.pricing.rentalFeeAmount)}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Tiền đặt cọc</span>
                <span className="font-semibold text-slate-800">
                  {money(b.pricing.depositAmount)}
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-sm font-bold text-slate-900">
                <span>Tổng cộng đã thanh toán</span>
                <span className="text-emerald-700">{money(b.pricing.totalAmount)}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {cancel.isError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {customerApiError(cancel.error)}
        </div>
      )}
    </div>
  );
}
