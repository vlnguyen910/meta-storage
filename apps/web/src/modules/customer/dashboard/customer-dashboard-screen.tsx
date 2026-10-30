"use client";
import { formatReference } from "@metastorage/shared";

import { useQuery } from "@tanstack/react-query";
import {
  Archive,
  ArrowRight,
  Building2,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Headphones,
  Plus,
  QrCode,
  WalletCards,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { CustomerTable } from "@/components/ui/customer-table";
import { ListPagination } from "@/components/ui/list-pagination";
import { ShadcnButton } from "@/components/ui/shadcn-button";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { customerRoutes } from "@/config/routes";
import { useMyRentals } from "@/features/rentals/hooks";
import { useFlow3Identity } from "@/features/returns/use-flow3-identity";
import { api } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/format";
import { CUSTOMER_DASHBOARD_MESSAGES as D } from "./customer-dashboard.messages";
import type { CustomerDashboardTab } from "./customer-dashboard.types";

export function CustomerDashboardScreen() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<CustomerDashboardTab>("bookings");
  const [bookingPage, setBookingPage] = useState(1);
  const [rentalPage, setRentalPage] = useState(1);
  const pageSize = 5;

  const owner = useFlow3Identity();
  const bookings = useQuery({
    queryKey: ["reservations", owner, "mine"],
    queryFn: () => api.reservations.mine(),
  });
  const rentals = useMyRentals("current");

  const allBookings = bookings.data ?? [];
  const allRentals = rentals.data?.pages.flatMap((page) => page.items) ?? [];

  const activeRentalsCount = allRentals.filter((r) => r.status === "ACTIVE").length;
  const pendingBookingsCount = allBookings.filter(
    (b) => b.status === "CONFIRMED" || b.status === "CHECKED_IN",
  ).length;

  const pagedBookings = allBookings.slice((bookingPage - 1) * pageSize, bookingPage * pageSize);
  const pagedRentals = allRentals.slice((rentalPage - 1) * pageSize, rentalPage * pageSize);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden min-h-0 gap-3.5">
      {/* 1. Header (Compact) */}
      <header className="shrink-0 flex items-center justify-between gap-4">
        <div>
          <p className="mb-0.5 mt-0 text-xs font-semibold text-primary">{D.portalEyebrow}</p>
          <h1 className="m-0 font-['Space_Grotesk'] text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            {D.dashboardTitle}
          </h1>
          <p className="mb-0 mt-0.5 text-xs text-slate-600">{D.subtitle}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ShadcnButton
            className="bg-primary hover:bg-primary-dark font-semibold text-white text-xs h-9"
            onClick={() => router.push(customerRoutes.facilities)}
          >
            <Plus className="size-3.5" aria-hidden="true" />
            {D.bookAction}
          </ShadcnButton>
          <ShadcnButton
            variant="outline"
            className="border-slate-200 text-slate-700 hover:bg-slate-50 text-xs h-9 font-semibold"
            onClick={() => router.push(customerRoutes.rentals)}
          >
            <Archive className="size-3.5" />
            {D.myRentalsAction}
          </ShadcnButton>
        </div>
      </header>

      {/* 2. Quick Metric Cards */}
      <div className="shrink-0 grid gap-3 grid-cols-2 lg:grid-cols-4">
        {/* Metric 1 */}
        <Link
          href={`${customerRoutes.rentals}?tab=rentals`}
          className="group rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs transition hover:border-primary/40 hover:shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              {D.activeRentalsTitle}
            </span>
            <div className="grid size-7 place-items-center rounded-lg bg-emerald-50 text-primary transition group-hover:bg-primary group-hover:text-white">
              <Warehouse className="size-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-slate-900">{activeRentalsCount}</span>
            <span className="text-[11px] text-slate-500">{D.activeRentalsUnit}</span>
          </div>
          <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-primary m-0">
            <span>{D.activeRentalsLink}</span>
            <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
          </p>
        </Link>

        {/* Metric 2 */}
        <Link
          href={`${customerRoutes.rentals}?tab=reservations`}
          className="group rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs transition hover:border-primary/40 hover:shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              {D.bookingsTitle}
            </span>
            <div className="grid size-7 place-items-center rounded-lg bg-sky-50 text-sky-600 transition group-hover:bg-sky-600 group-hover:text-white">
              <CalendarClock className="size-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-slate-900">{pendingBookingsCount}</span>
            <span className="text-[11px] text-slate-500">{D.bookingsUnit}</span>
          </div>
          <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-sky-600 m-0">
            <span>{D.bookingsLink}</span>
            <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
          </p>
        </Link>

        {/* Metric 3 */}
        <Link
          href={customerRoutes.facilities}
          className="group rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs transition hover:border-primary/40 hover:shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              {D.facilitiesTitle}
            </span>
            <div className="grid size-7 place-items-center rounded-lg bg-amber-50 text-amber-600 transition group-hover:bg-amber-600 group-hover:text-white">
              <Building2 className="size-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-sm font-bold text-slate-900">{D.facilitiesSubtitle}</span>
          </div>
          <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-amber-600 m-0">
            <span>{D.facilitiesLink}</span>
            <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
          </p>
        </Link>

        {/* Metric 4 */}
        <Link
          href={customerRoutes.support}
          className="group rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs transition hover:border-primary/40 hover:shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              {D.supportTitle}
            </span>
            <div className="grid size-7 place-items-center rounded-lg bg-purple-50 text-purple-600 transition group-hover:bg-purple-600 group-hover:text-white">
              <Headphones className="size-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-sm font-bold text-slate-900">{D.supportSubtitle}</span>
          </div>
          <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-purple-600 m-0">
            <span>{D.supportLink}</span>
            <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
          </p>
        </Link>
      </div>

      {/* 3. Main Data Section with Tabs & Table */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden gap-2.5">
        {/* Tab switch header */}
        <div className="shrink-0 flex items-center justify-between border-b border-slate-200 pb-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab("bookings");
                setBookingPage(1);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                activeTab === "bookings"
                  ? "bg-primary text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <CalendarCheck2 className="size-3.5" />
              <span>{D.tabsBookings}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
                  activeTab === "bookings"
                    ? "bg-white/20 text-white"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {allBookings.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("rentals");
                setRentalPage(1);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                activeTab === "rentals"
                  ? "bg-primary text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Warehouse className="size-3.5" />
              <span>{D.tabsRentals}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
                  activeTab === "rentals" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                }`}
              >
                {allRentals.length}
              </span>
            </button>
          </div>

          <Link
            href={
              activeTab === "bookings"
                ? `${customerRoutes.rentals}?tab=reservations`
                : `${customerRoutes.rentals}?tab=rentals`
            }
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
          >
            <span>
              {activeTab === "bookings"
                ? D.viewAllBookings(allBookings.length)
                : D.viewAllRentals(allRentals.length)}
            </span>
            <ArrowRight className="size-3" />
          </Link>
        </div>

        {/* Tab 1: Bookings Table */}
        {activeTab === "bookings" && (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden gap-2">
            {bookings.isPending ? (
              <LoadingState variant="table" />
            ) : bookings.isError ? (
              <ErrorState message={D.loadBookingsFailed} onRetry={() => bookings.refetch()} />
            ) : allBookings.length === 0 ? (
              <section className="text-center py-8 rounded-card border border-line bg-white shadow-card flex-1 flex flex-col items-center justify-center p-6">
                <CalendarClock className="mx-auto size-10 text-slate-400" />
                <h3 className="mt-2 text-sm font-semibold text-slate-800">
                  {D.emptyBookingsTitle}
                </h3>
                <p className="mt-1 text-xs text-slate-500 max-w-sm">{D.emptyBookingsDesc}</p>
                <Link
                  href={customerRoutes.facilities}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-primary-dark"
                >
                  <Plus className="size-3.5" />
                  {D.bookAction}
                </Link>
              </section>
            ) : (
              <>
                <CustomerTable title={D.tableBookingsTitle} headings={D.tableBookingsHeadings}>
                  {pagedBookings.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                          {formatReference(b.id, "BK")}
                        </span>
                      </td>
                      <td>
                        <div className="font-semibold text-slate-900">
                          {b.facility?.name ?? formatReference(b.facilityId, "CS")}
                        </div>
                        <div className="text-xs text-slate-500">
                          {b.unitType?.name ?? formatReference(b.unitTypeId, "LK")}
                        </div>
                      </td>
                      <td>
                        <span className="flex items-center gap-1 text-xs text-slate-700">
                          <CalendarDays className="size-3 text-slate-400 shrink-0" />
                          {formatDateTime(b.rentalStartAt)}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-medium ${
                            b.paymentStatus === "SUCCEEDED"
                              ? "text-emerald-700 font-semibold"
                              : "text-amber-700"
                          }`}
                        >
                          <WalletCards className="size-3" />
                          {b.paymentStatus === "SUCCEEDED" ? D.paymentSucceeded : D.paymentPending}
                        </span>
                      </td>
                      <td>
                        <Badge
                          className={
                            D.bookingStatusClass[b.status as keyof typeof D.bookingStatusClass] ??
                            "border-slate-200 bg-slate-100 text-slate-700"
                          }
                        >
                          {D.bookingStatus[b.status as keyof typeof D.bookingStatus] ?? b.status}
                        </Badge>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <Link
                            href={customerRoutes.reservation(b.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-primary hover:bg-primary-soft transition-colors"
                          >
                            <QrCode className="size-3.5" />
                            <span>{D.qrAction}</span>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </CustomerTable>

                <div className="shrink-0 [&>nav]:shadow-2xs">
                  <ListPagination
                    label={D.tabsBookings}
                    page={bookingPage}
                    pageSize={pageSize}
                    total={allBookings.length}
                    onPageChange={(page) => setBookingPage(page)}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab 2: Rentals Table */}
        {activeTab === "rentals" && (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden gap-2">
            {rentals.isPending ? (
              <LoadingState variant="table" />
            ) : rentals.isError ? (
              <ErrorState message={D.loadRentalsFailed} onRetry={() => rentals.refetch()} />
            ) : allRentals.length === 0 ? (
              <section className="text-center py-8 rounded-card border border-line bg-white shadow-card flex-1 flex flex-col items-center justify-center p-6">
                <Warehouse className="mx-auto size-10 text-slate-400" />
                <h3 className="mt-2 text-sm font-semibold text-slate-800">{D.emptyRentalsTitle}</h3>
                <p className="mt-1 text-xs text-slate-500 max-w-sm">{D.emptyRentalsDesc}</p>
                <Link
                  href={customerRoutes.facilities}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-primary-dark"
                >
                  <Plus className="size-3.5" />
                  {D.bookAction}
                </Link>
              </section>
            ) : (
              <>
                <CustomerTable title={D.tableRentalsTitle} headings={D.tableRentalsHeadings}>
                  {pagedRentals.map((r) => (
                    <tr key={r.id}>
                      <td>
                        {r.storageUnit?.code ? (
                          <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                            {D.unitPrefix}
                            {r.storageUnit.code}
                          </span>
                        ) : (
                          <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                            {formatReference(r.bookingCode, "BK")}
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="font-semibold text-slate-900">{r.unitType.name}</div>
                        <div className="text-xs text-slate-500">{r.unitType.sizeLabel}</div>
                      </td>
                      <td>
                        <div className="text-xs font-medium text-slate-800">{r.facility.name}</div>
                        <div className="text-[11px] text-slate-400 truncate max-w-xs">
                          {r.facility.address}
                        </div>
                      </td>
                      <td>
                        <span className="text-xs font-medium text-slate-700">
                          {formatDate(r.endAt)}
                        </span>
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <CheckCircle2 className="size-3" />
                          {D.activeStatus}
                        </span>
                      </td>
                      <td>
                        <Link
                          href={customerRoutes.rental(r.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-primary hover:bg-primary-soft transition-colors"
                        >
                          <span>{D.detailsAction}</span>
                          <ArrowRight className="size-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </CustomerTable>

                <div className="shrink-0 [&>nav]:shadow-2xs">
                  <ListPagination
                    label={D.tabsRentals}
                    page={rentalPage}
                    pageSize={pageSize}
                    total={allRentals.length}
                    onPageChange={(page) => setRentalPage(page)}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
