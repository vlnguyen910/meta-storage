"use client";

import {
  Archive,
  ArrowRight,
  Building2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Headphones,
  MapPin,
  Plus,
  QrCode,
  WalletCards,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShadcnButton } from "@/components/ui/shadcn-button";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { customerRoutes } from "@/config/routes";
import { useAuthStore } from "@/features/auth/auth-store";
import { useCustomerBookings } from "@/features/bookings/customer-bookings.hooks";
import { useMyRentals } from "@/features/rentals/hooks";
import { formatDate, formatDateTime } from "@/lib/format";
import { CUSTOMER_DASHBOARD_MESSAGES as D } from "./customer-dashboard.messages";

export function CustomerDashboardScreen() {
  const router = useRouter();
  const session = useAuthStore((state) => state.session);
  const userName = session?.user?.name || "Quý khách";

  const bookings = useCustomerBookings();
  const rentals = useMyRentals("current");

  const allBookings = bookings.data?.pages.flatMap((page) => page.items) ?? [];
  const allRentals = rentals.data?.pages.flatMap((page) => page.items) ?? [];

  const recentBookings = allBookings.slice(0, 3);
  const currentRentals = allRentals.slice(0, 3);

  const activeRentalsCount = allRentals.filter((r) => r.status === "ACTIVE").length;
  const pendingBookingsCount = allBookings.filter(
    (b) => b.status === "CONFIRMED" || b.status === "CHECKED_IN",
  ).length;

  return (
    <div className="space-y-8">
      {/* 1. Header Banner & Welcome */}
      <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-emerald-900 via-slate-900 to-slate-950 p-6 text-white shadow-sm sm:p-8">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              Cổng dịch vụ khách hàng
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Xin chào, {userName} 👋
            </h1>
            <p className="max-w-xl text-sm text-slate-300">
              Quản lý kho thông minh, theo dõi lịch nhận kho và tra cứu hợp đồng thuê dễ dàng tại
              Metastorage.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap gap-3">
            <ShadcnButton
              className="bg-emerald-500 font-semibold text-slate-950 hover:bg-emerald-400"
              onClick={() => router.push(customerRoutes.facilities)}
            >
              <Plus className="size-4" aria-hidden="true" />
              Đặt kho lưu trữ
            </ShadcnButton>
            <ShadcnButton
              variant="outline"
              className="border-white/20 bg-white/10 text-white hover:bg-white/20"
              onClick={() => router.push(customerRoutes.rentals)}
            >
              <Archive className="size-4" />
              Kho của tôi
            </ShadcnButton>
          </div>
        </div>
      </div>

      {/* 2. Quick Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Metric 1 */}
        <Link
          href={`${customerRoutes.rentals}?tab=rentals`}
          className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:border-primary/40 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Kho đang thuê
            </span>
            <div className="grid size-9 place-items-center rounded-xl bg-emerald-50 text-primary transition group-hover:bg-primary group-hover:text-white">
              <Warehouse className="size-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{activeRentalsCount}</span>
            <span className="text-xs text-slate-500">ô kho hoạt động</span>
          </div>
          <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-primary">
            <span>Xem chi tiết kho</span>
            <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
          </p>
        </Link>

        {/* Metric 2 */}
        <Link
          href={`${customerRoutes.rentals}?tab=reservations`}
          className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:border-primary/40 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Đơn đặt kho
            </span>
            <div className="grid size-9 place-items-center rounded-xl bg-sky-50 text-sky-600 transition group-hover:bg-sky-600 group-hover:text-white">
              <CalendarClock className="size-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{pendingBookingsCount}</span>
            <span className="text-xs text-slate-500">lịch hẹn nhận kho</span>
          </div>
          <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-sky-600">
            <span>Xem mã QR nhận kho</span>
            <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
          </p>
        </Link>

        {/* Metric 3 */}
        <Link
          href={customerRoutes.facilities}
          className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:border-primary/40 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Hệ thống cơ sở
            </span>
            <div className="grid size-9 place-items-center rounded-xl bg-amber-50 text-amber-600 transition group-hover:bg-amber-600 group-hover:text-white">
              <Building2 className="size-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-lg font-bold text-slate-900">Tìm kho gần bạn</span>
          </div>
          <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-amber-600">
            <span>Khám phá cơ sở</span>
            <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
          </p>
        </Link>

        {/* Metric 4 */}
        <Link
          href={customerRoutes.support}
          className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:border-primary/40 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Hỗ trợ khách hàng
            </span>
            <div className="grid size-9 place-items-center rounded-xl bg-purple-50 text-purple-600 transition group-hover:bg-purple-600 group-hover:text-white">
              <Headphones className="size-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-lg font-bold text-slate-900">24/7 Giải đáp</span>
          </div>
          <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-purple-600">
            <span>Tạo yêu cầu hỗ trợ</span>
            <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
          </p>
        </Link>
      </div>

      {/* 3. Main Content: 2 Columns */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {/* Column 1: Lịch nhận kho & Đơn đặt kho */}
        <Card className="rounded-2xl border-slate-200/80 bg-white">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-lg font-bold text-slate-900">
                Đơn đặt & Lịch nhận kho
              </CardTitle>
              <p className="mt-0.5 text-xs text-slate-500">
                Lịch hẹn bàn giao kho và mã QR nhận kho gần nhất
              </p>
            </div>
            <Link
              className="text-xs font-semibold text-primary hover:underline"
              href={`${customerRoutes.rentals}?tab=reservations`}
            >
              Xem tất cả ({allBookings.length})
            </Link>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {bookings.isPending ? (
              <LoadingState />
            ) : bookings.isError ? (
              <ErrorState
                message="Không thể tải danh sách đơn đặt. Vui lòng thử lại."
                onRetry={() => bookings.refetch()}
              />
            ) : recentBookings.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
                <CalendarClock className="mx-auto size-8 text-slate-400" />
                <p className="mt-2 text-sm font-semibold text-slate-700">
                  Chưa có lịch hẹn nhận kho nào
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Hãy chọn một cơ sở lưu trữ phù hợp để đặt kho ngay.
                </p>
                <Link
                  href={customerRoutes.facilities}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-primary-dark"
                >
                  <Plus className="size-3.5" />
                  Đặt kho ngay
                </Link>
              </div>
            ) : (
              recentBookings.map((b) => (
                <Link
                  key={b.id}
                  href={customerRoutes.reservation(b.id)}
                  className="group block rounded-xl border border-slate-200/80 bg-white p-4 transition hover:border-primary/40 hover:shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-md border border-slate-200/80 bg-slate-50 px-2 py-0.5 font-mono text-xs font-bold text-slate-800">
                      {b.bookingCode ?? b.id}
                    </span>
                    <Badge
                      className={
                        D.bookingStatusClass[b.status as keyof typeof D.bookingStatusClass] ??
                        "border-slate-200 bg-slate-100 text-slate-700"
                      }
                    >
                      {D.bookingStatus[b.status as keyof typeof D.bookingStatus] ?? b.status}
                    </Badge>
                  </div>

                  <h3 className="mt-2 text-sm font-bold text-slate-900 group-hover:text-primary">
                    {b.facility.name} · {b.unitType.name}
                  </h3>

                  <div className="mt-2 grid gap-1.5 text-xs text-slate-600 sm:grid-cols-2">
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="size-3.5 text-slate-400" />
                      Nhận kho: {formatDateTime(b.checkInSlotStart)}
                    </span>
                    <span
                      className={`flex items-center gap-1.5 ${
                        b.paymentStatus === "SUCCEEDED"
                          ? "text-emerald-700 font-medium"
                          : "text-amber-700"
                      }`}
                    >
                      <WalletCards className="size-3.5" />
                      {b.paymentStatus === "SUCCEEDED" ? "Đã thanh toán" : "Chờ thanh toán"}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                    <span className="flex items-center gap-1 text-slate-400">
                      <MapPin className="size-3 text-slate-400" />
                      {b.facility.address}
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-primary">
                      <QrCode className="size-3.5" />
                      Xem QR nhận kho
                    </span>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {/* Column 2: Kho lưu trữ đang quản lý */}
        <Card className="rounded-2xl border-slate-200/80 bg-white">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-lg font-bold text-slate-900">Kho đang lưu trữ</CardTitle>
              <p className="mt-0.5 text-xs text-slate-500">
                Các ô kho bạn đang sử dụng và thời hạn thuê
              </p>
            </div>
            <Link
              className="text-xs font-semibold text-primary hover:underline"
              href={`${customerRoutes.rentals}?tab=rentals`}
            >
              Xem tất cả ({allRentals.length})
            </Link>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {rentals.isPending ? (
              <LoadingState />
            ) : rentals.isError ? (
              <ErrorState
                message="Không thể tải danh sách kho. Vui lòng thử lại."
                onRetry={() => rentals.refetch()}
              />
            ) : currentRentals.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
                <Warehouse className="mx-auto size-8 text-slate-400" />
                <p className="mt-2 text-sm font-semibold text-slate-700">
                  Bạn chưa có ô kho nào đang thuê
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Kho sẽ hiển thị tại đây sau khi hoàn tất thủ tục nhận kho tại cơ sở.
                </p>
                <Link
                  href={customerRoutes.facilities}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-primary-dark"
                >
                  <Plus className="size-3.5" />
                  Tìm kho lưu trữ
                </Link>
              </div>
            ) : (
              currentRentals.map((r) => (
                <Link
                  key={r.id}
                  href={customerRoutes.rental(r.id)}
                  className="group block rounded-xl border border-slate-200/80 bg-white p-4 transition hover:border-primary/40 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {r.physicalUnit?.code ? (
                          <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-xs font-bold text-emerald-800">
                            Ô kho: {r.physicalUnit.code}
                          </span>
                        ) : (
                          <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-xs font-bold text-slate-700">
                            {r.bookingCode}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                          <CheckCircle2 className="size-3" />
                          Đang thuê
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-primary">
                        {r.unitType.name} · {r.unitType.sizeLabel}
                      </h3>
                      <p className="flex items-center gap-1 text-xs text-slate-500">
                        <MapPin className="size-3 shrink-0 text-slate-400" />
                        <span>{r.facility.name}</span>
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="block text-[10px] font-semibold text-slate-400 uppercase">
                        Hạn kết thúc
                      </span>
                      <strong className="text-xs font-bold text-slate-800">
                        {formatDate(r.expectedEndAt)}
                      </strong>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
