"use client";

import {
  Archive,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  History,
  MapPin,
  Plus,
  QrCode,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { PageHeader, StatusBadge } from "@/components/ui/display";
import { ListPagination } from "@/components/ui/list-pagination";
import { ShadcnButton } from "@/components/ui/shadcn-button";
import { Spinner } from "@/components/ui/spinner";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { customerRoutes } from "@/config/routes";
import { useCustomerBookings } from "@/features/bookings/customer-bookings.hooks";
import { customerApiError } from "@/features/bookings/customer-error";
import { useMyRentals } from "@/features/rentals/hooks";
import { RENTAL_MESSAGES } from "@/features/rentals/rentals.messages";
import { formatDate, formatDateTime } from "@/lib/format";

export interface CustomerStorageHubProps {
  defaultTab?: "rentals" | "reservations";
}

const bookingStatusLabels: Record<string, string> = {
  CONFIRMED: "Đã xác nhận",
  CHECKED_IN: "Đã nhận kho",
  NO_SHOW: "Không đến",
  CANCELLED: "Đã hủy",
};

const bookingStatusClasses: Record<string, string> = {
  CONFIRMED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  CHECKED_IN: "border-sky-200 bg-sky-50 text-sky-800",
  NO_SHOW: "border-rose-200 bg-rose-50 text-rose-800",
  CANCELLED: "border-slate-200 bg-slate-100 text-slate-700",
};

function StorageHubContent({ defaultTab = "rentals" }: CustomerStorageHubProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: "rentals" | "reservations" =
    tabParam === "reservations" || tabParam === "rentals" ? tabParam : defaultTab;

  const [rentalView, setRentalView] = useState<"current" | "history">("current");
  const [bookingPage, setBookingPage] = useState(1);
  const bookingPageSize = 6;

  // Data queries
  const rentalsQuery = useMyRentals(rentalView);
  const bookingsQuery = useCustomerBookings();

  const allRentals = rentalsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const allBookings = bookingsQuery.data?.pages.flatMap((page) => page.items) ?? [];

  // Paged bookings
  const safeBookingPage = Math.min(
    bookingPage,
    Math.max(1, Math.ceil(allBookings.length / bookingPageSize)),
  );
  const visibleBookings = allBookings.slice(
    (safeBookingPage - 1) * bookingPageSize,
    safeBookingPage * bookingPageSize,
  );

  const switchTab = (tab: "rentals" | "reservations") => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Quản lý kho lưu trữ"
        title="Kho của tôi"
        description="Theo dõi toàn bộ các kho bạn đang lưu trữ và các đơn hẹn nhận kho tại Metastorage."
        action={
          <ShadcnButton
            className="w-full bg-primary hover:bg-primary-dark sm:w-auto"
            onClick={() => router.push(customerRoutes.facilities)}
          >
            <Plus className="size-4" aria-hidden="true" />
            Đặt kho mới
          </ShadcnButton>
        }
      />

      {/* Main Unified Navigation Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => switchTab("rentals")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-colors ${
            activeTab === "rentals"
              ? "border-primary text-primary"
              : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
          }`}
        >
          <Archive className="size-4.5" />
          <span>Kho đang thuê</span>
          {allRentals.length > 0 && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                activeTab === "rentals"
                  ? "bg-primary-soft text-primary"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {allRentals.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => switchTab("reservations")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-colors ${
            activeTab === "reservations"
              ? "border-primary text-primary"
              : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
          }`}
        >
          <CalendarCheck2 className="size-4.5" />
          <span>Đơn đặt kho</span>
          {allBookings.length > 0 && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                activeTab === "reservations"
                  ? "bg-primary-soft text-primary"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {allBookings.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: RENTALS (Kho đang thuê) */}
      {activeTab === "rentals" && (
        <div className="space-y-6">
          {/* Sub-filter for Current vs History */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="inline-flex rounded-xl border border-slate-200/80 bg-slate-100 p-1 shadow-inner">
              <button
                type="button"
                onClick={() => setRentalView("current")}
                className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
                  rentalView === "current"
                    ? "bg-white text-primary shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Đang sử dụng
              </button>
              <button
                type="button"
                onClick={() => setRentalView("history")}
                className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
                  rentalView === "history"
                    ? "bg-white text-primary shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Lịch sử thuê
              </button>
            </div>
            <p className="text-xs text-slate-500">
              {rentalView === "current"
                ? "Danh sách các ô kho bạn đang có quyền sử dụng"
                : "Các hợp đồng kho đã kết thúc hoặc hoàn tất trả kho"}
            </p>
          </div>

          {rentalsQuery.isLoading ? (
            <LoadingState variant="table" />
          ) : rentalsQuery.isError ? (
            <ErrorState
              message={RENTAL_MESSAGES.loadFailed}
              onRetry={() => rentalsQuery.refetch()}
            />
          ) : allRentals.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-12 text-center">
              <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-white text-slate-400 shadow-xs">
                <Warehouse className="size-7 text-primary/70" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">
                {rentalView === "current"
                  ? "Bạn chưa có kho nào đang hoạt động"
                  : "Chưa có lịch sử thuê kho"}
              </h3>
              <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-500">
                {rentalView === "current"
                  ? "Sau khi nhận bàn giao kho tại cơ sở, ô kho của bạn sẽ xuất hiện tại đây để tiện quản lý và theo dõi."
                  : "Các kho đã hoàn tất trả kho sẽ được lưu lại lịch sử tại đây."}
              </p>
              {rentalView === "current" && (
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <Link
                    href={customerRoutes.facilities}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark"
                  >
                    <Plus className="size-4" />
                    Khám phá & Đặt kho ngay
                  </Link>
                  <button
                    type="button"
                    onClick={() => switchTab("reservations")}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <CalendarCheck2 className="size-4" />
                    Xem đơn đặt nhận kho
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-4">
              {allRentals.map((rental) => (
                <div
                  key={rental.id}
                  className="group relative rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:border-primary/40 hover:shadow-md"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-start gap-4">
                      <div className="hidden size-12 shrink-0 place-items-center rounded-xl bg-emerald-50 text-primary transition-colors group-hover:bg-primary group-hover:text-white sm:grid">
                        <Warehouse className="size-6" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md border border-slate-200/70 bg-slate-50 px-2 py-0.5 font-mono text-xs font-bold text-slate-700 uppercase">
                            Mã đơn: {rental.bookingCode}
                          </span>
                          {rental.physicalUnit?.code && (
                            <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-xs font-bold text-emerald-800">
                              Ô kho: {rental.physicalUnit.code}
                            </span>
                          )}
                          <StatusBadge value={rental.status} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 transition-colors group-hover:text-primary">
                          {rental.unitType.name} · {rental.unitType.sizeLabel}
                        </h3>
                        <p className="flex items-center gap-1.5 text-sm text-slate-500">
                          <MapPin className="size-3.5 shrink-0 text-slate-400" />
                          <span>{rental.facility.name}</span>
                          <span className="text-slate-300">·</span>
                          <span className="text-xs text-slate-400">{rental.facility.address}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 border-t border-slate-100 pt-3 lg:border-t-0 lg:pt-0">
                      <div className="rounded-xl bg-slate-50 px-4 py-2 text-left">
                        <span className="flex items-center gap-1 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                          <CalendarDays className="size-3 text-slate-400" />
                          Thời hạn hợp đồng
                        </span>
                        <p className="mt-0.5 text-sm font-semibold text-slate-800">
                          {formatDate(rental.startAt)} – {formatDate(rental.expectedEndAt)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {rental.status === "ACTIVE" && (
                          <Link
                            href={customerRoutes.newReturn(rental.id)}
                            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            Yêu cầu trả kho
                          </Link>
                        )}
                        <Link
                          href={customerRoutes.rental(rental.id)}
                          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-dark"
                        >
                          <span>Xem chi tiết</span>
                          <ChevronRight className="size-4" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {rentalsQuery.hasNextPage && (
                <button
                  type="button"
                  onClick={() => void rentalsQuery.fetchNextPage()}
                  disabled={rentalsQuery.isFetchingNextPage}
                  className="mx-auto mt-4 flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-primary transition hover:bg-slate-50 disabled:opacity-60"
                >
                  {rentalsQuery.isFetchingNextPage ? (
                    <Spinner variant="brand" size="sm" />
                  ) : (
                    <History className="size-4" />
                  )}
                  {rentalsQuery.isFetchingNextPage ? "Đang tải thêm…" : "Tải thêm kho"}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: RESERVATIONS (Đơn đặt kho) */}
      {activeTab === "reservations" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-slate-600">
              Các đơn đặt trước và lịch hẹn bàn giao nhận ô kho của bạn.
            </p>
            <Link
              href={customerRoutes.facilities}
              className="text-xs font-bold text-primary hover:underline"
            >
              + Đặt thêm đơn mới
            </Link>
          </div>

          {bookingsQuery.isPending ? (
            <LoadingState />
          ) : bookingsQuery.isError ? (
            <ErrorState
              message={customerApiError(bookingsQuery.error)}
              onRetry={() => bookingsQuery.refetch()}
            />
          ) : allBookings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-12 text-center">
              <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-white text-slate-400 shadow-xs">
                <CalendarCheck2 className="size-7 text-primary/70" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Chưa có đơn đặt kho nào</h3>
              <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-500">
                Tìm cơ sở lưu trữ gần nhất và chọn khung giờ nhận kho phù hợp với bạn.
              </p>
              <div className="mt-6">
                <Link
                  href={customerRoutes.facilities}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark"
                >
                  <Plus className="size-4" />
                  Đặt kho lưu trữ
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4">
                {visibleBookings.map((b) => (
                  <div
                    key={b.id}
                    className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:border-primary/40 hover:shadow-md"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md border border-slate-200/70 bg-slate-100 px-2.5 py-0.5 font-mono text-xs font-bold text-slate-700">
                            {b.bookingCode ?? b.id}
                          </span>
                          <Badge
                            className={
                              bookingStatusClasses[b.status] ??
                              "border-slate-200 bg-slate-100 text-slate-700"
                            }
                          >
                            {bookingStatusLabels[b.status] ?? b.status}
                          </Badge>
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${
                              b.paymentStatus === "SUCCEEDED"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            <CheckCircle2 className="size-3" />
                            {b.paymentStatus === "SUCCEEDED" ? "Đã thanh toán" : "Chờ thanh toán"}
                          </span>
                        </div>

                        <h3 className="text-lg font-bold text-slate-900">
                          {b.facility.name} · {b.unitType.name}
                        </h3>

                        <div className="grid gap-1.5 text-sm text-slate-600 sm:grid-cols-2">
                          <p className="flex items-center gap-1.5">
                            <MapPin className="size-3.5 shrink-0 text-slate-400" />
                            <span>{b.facility.address}</span>
                          </p>
                          <p className="flex items-center gap-1.5">
                            <Clock className="size-3.5 shrink-0 text-slate-400" />
                            <span>Nhận kho: {formatDateTime(b.checkInSlotStart)}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 border-t border-slate-100 pt-3 md:border-t-0 md:pt-0">
                        <Link
                          href={customerRoutes.reservation(b.id)}
                          className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-dark"
                        >
                          <QrCode className="size-4" />
                          <span>Chi tiết & QR nhận kho</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <ListPagination
                label="Đơn đặt kho"
                page={safeBookingPage}
                pageSize={bookingPageSize}
                total={allBookings.length}
                pending={bookingsQuery.isFetchingNextPage}
                onPageChange={setBookingPage}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function CustomerStorageHub(props: CustomerStorageHubProps) {
  return (
    <Suspense fallback={<LoadingState />}>
      <StorageHubContent {...props} />
    </Suspense>
  );
}
