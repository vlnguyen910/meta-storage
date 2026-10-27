"use client";

import {
  Archive,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Plus,
  QrCode,
  RotateCcw,
  Search,
  WalletCards,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CustomerTable } from "@/components/ui/customer-table";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { ListPagination } from "@/components/ui/list-pagination";
import { ShadcnButton } from "@/components/ui/shadcn-button";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { customerRoutes } from "@/config/routes";
import { useCustomerBookings } from "@/features/bookings/customer-bookings.hooks";
import { useMyRentals } from "@/features/rentals/hooks";
import { formatDate, formatDateTime } from "@/lib/format";
import { CUSTOMER_STORAGE_HUB_MESSAGES as M } from "./customer-storage-hub.messages";
import type {
  CustomerStorageHubProps,
  StorageHubTab,
  StorageRentalView,
} from "./customer-storage-hub.types";

function StorageHubContent({ defaultTab = "rentals" }: Readonly<CustomerStorageHubProps>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: StorageHubTab =
    tabParam === "reservations" || tabParam === "rentals" ? tabParam : defaultTab;

  // Rental state
  const [rentalView, setRentalView] = useState<StorageRentalView>("current");
  const [rentalSearch, setRentalSearch] = useState("");
  const [rentalSearchInput, setRentalSearchInput] = useState("");
  const [rentalPage, setRentalPage] = useState(1);
  const rentalPageSize = 8;

  // Booking state
  const [bookingSearch, setBookingSearch] = useState("");
  const [bookingSearchInput, setBookingSearchInput] = useState("");
  const [bookingStatus, setBookingStatus] = useState("");
  const [bookingPage, setBookingPage] = useState(1);
  const bookingPageSize = 8;

  // Data queries
  const rentalsQuery = useMyRentals(rentalView);
  const bookingsQuery = useCustomerBookings();

  const allRentals = rentalsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const allBookings = bookingsQuery.data?.pages.flatMap((page) => page.items) ?? [];

  // Filter rentals
  const filteredRentals = useMemo(() => {
    if (!rentalSearch) return allRentals;
    const query = rentalSearch.toLowerCase();
    return allRentals.filter(
      (r) =>
        r.bookingCode.toLowerCase().includes(query) ||
        r.physicalUnit?.code?.toLowerCase().includes(query) ||
        r.unitType.name.toLowerCase().includes(query) ||
        r.facility.name.toLowerCase().includes(query) ||
        r.facility.address.toLowerCase().includes(query),
    );
  }, [allRentals, rentalSearch]);

  // Filter bookings
  const filteredBookings = useMemo(() => {
    return allBookings.filter((b) => {
      const matchesStatus = !bookingStatus || b.status === bookingStatus;
      if (!matchesStatus) return false;
      if (!bookingSearch) return true;
      const query = bookingSearch.toLowerCase();
      return (
        (b.bookingCode ?? b.id).toLowerCase().includes(query) ||
        b.facility.name.toLowerCase().includes(query) ||
        b.unitType.name.toLowerCase().includes(query)
      );
    });
  }, [allBookings, bookingSearch, bookingStatus]);

  // Sliced data
  const pagedRentals = filteredRentals.slice(
    (rentalPage - 1) * rentalPageSize,
    rentalPage * rentalPageSize,
  );
  const pagedBookings = filteredBookings.slice(
    (bookingPage - 1) * bookingPageSize,
    bookingPage * bookingPageSize,
  );

  const switchTab = (tab: StorageHubTab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const handleRentalSearchSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    setRentalSearch(rentalSearchInput.trim());
    setRentalPage(1);
  };

  const handleBookingSearchSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    setBookingSearch(bookingSearchInput.trim());
    setBookingPage(1);
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden min-h-0 gap-3">
      {/* 1. Header (Compact) */}
      <header className="shrink-0 flex items-center justify-between gap-4">
        <div>
          <p className="mb-0.5 mt-0 text-xs font-semibold text-primary">{M.eyebrow}</p>
          <h1 className="m-0 font-['Space_Grotesk'] text-xl sm:text-2xl font-bold tracking-tight">
            {M.title}
          </h1>
          <p className="mb-0 mt-0.5 text-xs text-slate-600">{M.description}</p>
        </div>

        <ShadcnButton
          className="shrink-0 bg-primary hover:bg-primary-dark text-xs h-9 font-semibold"
          onClick={() => router.push(customerRoutes.facilities)}
        >
          <Plus className="size-3.5" aria-hidden="true" />
          {M.newStorageAction}
        </ShadcnButton>
      </header>

      {/* 2. Main Navigation Tabs */}
      <div className="shrink-0 flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => {
            switchTab("rentals");
            setRentalPage(1);
          }}
          className={`flex items-center gap-2 border-b-2 px-4 py-2 text-xs font-bold transition-colors cursor-pointer ${
            activeTab === "rentals"
              ? "border-primary text-primary"
              : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
          }`}
        >
          <Archive className="size-3.5" />
          <span>{M.tabRentals}</span>
          {allRentals.length > 0 && (
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
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
          onClick={() => {
            switchTab("reservations");
            setBookingPage(1);
          }}
          className={`flex items-center gap-2 border-b-2 px-4 py-2 text-xs font-bold transition-colors cursor-pointer ${
            activeTab === "reservations"
              ? "border-primary text-primary"
              : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
          }`}
        >
          <CalendarCheck2 className="size-3.5" />
          <span>{M.tabReservations}</span>
          {allBookings.length > 0 && (
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
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

      {/* TAB 1: RENTALS */}
      {activeTab === "rentals" && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden gap-2.5">
          {/* Single-row Compact Toolbar */}
          <section
            aria-label={M.searchConfirm}
            className="shrink-0 flex items-center gap-2 rounded-card border border-line bg-white p-2 shadow-card min-h-12 relative z-20"
          >
            <form
              onSubmit={handleRentalSearchSubmit}
              className="flex items-center gap-1.5 flex-1 min-w-44 max-w-xs shrink-0"
            >
              <div className="relative flex-1">
                <Search
                  aria-hidden="true"
                  size={15}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  type="search"
                  value={rentalSearchInput}
                  placeholder={M.searchPlaceholder}
                  onChange={(e) => setRentalSearchInput(e.target.value)}
                  className="h-9 w-full rounded-lg border border-line bg-canvas pl-8 pr-2 text-xs text-ink placeholder:text-muted outline-none transition focus:border-primary focus:ring-1 focus:ring-primary shadow-2xs"
                />
              </div>
              <Button
                type="submit"
                variant="primary"
                className="h-9 min-h-9 px-3 text-xs font-semibold gap-1.5 shrink-0"
                icon={<Search size={14} aria-hidden="true" />}
              >
                {M.searchConfirm}
              </Button>
            </form>

            <DropdownSelect
              value={rentalView}
              onChange={(val) => {
                setRentalView(val as StorageRentalView);
                setRentalPage(1);
              }}
              placement="bottom"
              className="w-40 shrink-0"
              triggerClassName="h-9 min-h-9 text-xs bg-white border-line"
              placeholder={M.rentalViewFilter}
              options={[
                { value: "current", label: M.rentalViewCurrent },
                { value: "history", label: M.rentalViewHistory },
              ]}
              maxVisibleItems={6}
            />

            <div className="flex items-center gap-1.5 ml-auto shrink-0">
              <Button
                variant="outline"
                className="h-9 min-h-9 px-2.5 text-xs font-semibold gap-1.5"
                icon={<RotateCcw size={14} aria-hidden="true" />}
                onClick={() => {
                  setRentalSearchInput("");
                  setRentalSearch("");
                  setRentalPage(1);
                }}
              >
                {M.resetFilters}
              </Button>
            </div>
          </section>

          {/* Rentals Table & Pagination */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden gap-2">
            {rentalsQuery.isLoading ? (
              <LoadingState variant="table" />
            ) : rentalsQuery.isError ? (
              <ErrorState message={M.error} onRetry={() => rentalsQuery.refetch()} />
            ) : filteredRentals.length === 0 ? (
              <section className="text-center py-8 rounded-card border border-line bg-white shadow-card flex-1 flex flex-col items-center justify-center p-6">
                <Warehouse className="mx-auto size-10 text-slate-400" />
                <h3 className="mt-2 text-sm font-semibold text-slate-800">
                  {rentalView === "current" ? M.emptyRentalsCurrent : M.emptyRentalsHistory}
                </h3>
                <p className="mt-1 text-xs text-slate-500 max-w-sm">
                  {rentalView === "current" ? M.emptyRentalsDescCurrent : M.emptyRentalsDescHistory}
                </p>
                {rentalView === "current" && (
                  <Link
                    href={customerRoutes.facilities}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-primary-dark"
                  >
                    <Plus className="size-3.5" />
                    {M.bookNowAction}
                  </Link>
                )}
              </section>
            ) : (
              <>
                <CustomerTable title={M.tableRentalsTitle} headings={M.tableRentalsHeadings}>
                  {pagedRentals.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono text-xs font-bold text-slate-800">
                            {r.bookingCode}
                          </span>
                          {r.physicalUnit?.code && (
                            <span className="font-mono text-[11px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded w-fit border border-emerald-200">
                              {M.unitPrefix}
                              {r.physicalUnit.code}
                            </span>
                          )}
                        </div>
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
                        <span className="text-xs text-slate-700 font-medium">
                          {formatDate(r.startAt)} – {formatDate(r.expectedEndAt)}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded border ${
                            r.status === "ACTIVE"
                              ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                              : "text-slate-700 bg-slate-100 border-slate-200"
                          }`}
                        >
                          <CheckCircle2 className="size-3" />
                          {r.status === "ACTIVE" ? M.rentalViewCurrent : r.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          {r.status === "ACTIVE" && (
                            <Link
                              href={customerRoutes.newReturn(r.id)}
                              className="inline-flex items-center px-2 py-1 text-xs font-semibold text-slate-700 hover:text-slate-900 border border-slate-200 rounded hover:bg-slate-50 transition-colors"
                            >
                              {M.returnAction}
                            </Link>
                          )}
                          <Link
                            href={customerRoutes.rental(r.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary-soft rounded transition-colors"
                          >
                            <span>{M.detailsAction}</span>
                            <ChevronRight className="size-3.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </CustomerTable>

                <div className="shrink-0 [&>nav]:shadow-2xs">
                  <ListPagination
                    label={M.tabRentals}
                    page={rentalPage}
                    pageSize={rentalPageSize}
                    total={filteredRentals.length}
                    unitLabel={M.unitLabel}
                    onPageChange={(page) => setRentalPage(page)}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: RESERVATIONS */}
      {activeTab === "reservations" && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden gap-2.5">
          {/* Single-row Compact Toolbar */}
          <section
            aria-label={M.searchConfirm}
            className="shrink-0 flex items-center gap-2 rounded-card border border-line bg-white p-2 shadow-card min-h-12 relative z-20"
          >
            <form
              onSubmit={handleBookingSearchSubmit}
              className="flex items-center gap-1.5 flex-1 min-w-44 max-w-xs shrink-0"
            >
              <div className="relative flex-1">
                <Search
                  aria-hidden="true"
                  size={15}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  type="search"
                  value={bookingSearchInput}
                  placeholder={M.searchPlaceholder}
                  onChange={(e) => setBookingSearchInput(e.target.value)}
                  className="h-9 w-full rounded-lg border border-line bg-canvas pl-8 pr-2 text-xs text-ink placeholder:text-muted outline-none transition focus:border-primary focus:ring-1 focus:ring-primary shadow-2xs"
                />
              </div>
              <Button
                type="submit"
                variant="primary"
                className="h-9 min-h-9 px-3 text-xs font-semibold gap-1.5 shrink-0"
                icon={<Search size={14} aria-hidden="true" />}
              >
                {M.searchConfirm}
              </Button>
            </form>

            <DropdownSelect
              value={bookingStatus}
              onChange={(val) => {
                setBookingStatus(val);
                setBookingPage(1);
              }}
              placement="bottom"
              className="w-44 shrink-0"
              triggerClassName="h-9 min-h-9 text-xs bg-white border-line"
              placeholder={M.statusFilter}
              options={[
                { value: "", label: M.allStatuses },
                ...Object.entries(M.bookingStatuses).map(([value, label]) => ({
                  value,
                  label,
                })),
              ]}
              maxVisibleItems={6}
            />

            <div className="flex items-center gap-1.5 ml-auto shrink-0">
              <Button
                variant="outline"
                className="h-9 min-h-9 px-2.5 text-xs font-semibold gap-1.5"
                icon={<RotateCcw size={14} aria-hidden="true" />}
                onClick={() => {
                  setBookingSearchInput("");
                  setBookingSearch("");
                  setBookingStatus("");
                  setBookingPage(1);
                }}
              >
                {M.resetFilters}
              </Button>
            </div>
          </section>

          {/* Reservations Table & Pagination */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden gap-2">
            {bookingsQuery.isLoading ? (
              <LoadingState variant="table" />
            ) : bookingsQuery.isError ? (
              <ErrorState message={M.error} onRetry={() => bookingsQuery.refetch()} />
            ) : filteredBookings.length === 0 ? (
              <section className="text-center py-8 rounded-card border border-line bg-white shadow-card flex-1 flex flex-col items-center justify-center p-6">
                <CalendarCheck2 className="mx-auto size-10 text-slate-400" />
                <h3 className="mt-2 text-sm font-semibold text-slate-800">
                  {M.emptyBookingsTitle}
                </h3>
                <p className="mt-1 text-xs text-slate-500 max-w-sm">{M.emptyBookingsDesc}</p>
                <Link
                  href={customerRoutes.facilities}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-primary-dark"
                >
                  <Plus className="size-3.5" />
                  {M.bookNowAction}
                </Link>
              </section>
            ) : (
              <>
                <CustomerTable
                  title={M.tableReservationsTitle}
                  headings={M.tableReservationsHeadings}
                >
                  {pagedBookings.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                          {b.bookingCode ?? b.id}
                        </span>
                      </td>
                      <td>
                        <div className="font-semibold text-slate-900">{b.facility.name}</div>
                        <div className="text-xs text-slate-500">{b.unitType.name}</div>
                      </td>
                      <td>
                        <span className="flex items-center gap-1 text-xs text-slate-700">
                          <CalendarDays className="size-3 text-slate-400 shrink-0" />
                          {formatDateTime(b.checkInSlotStart)}
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
                          {b.paymentStatus === "SUCCEEDED" ? M.paymentPaid : M.paymentPending}
                        </span>
                      </td>
                      <td>
                        <Badge
                          className={
                            M.bookingStatusClasses[b.status] ??
                            "border-slate-200 bg-slate-100 text-slate-700"
                          }
                        >
                          {M.bookingStatuses[b.status] ?? b.status}
                        </Badge>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <Link
                            href={customerRoutes.reservation(b.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-primary hover:bg-primary-soft transition-colors"
                          >
                            <QrCode className="size-3.5" />
                            <span>{M.qrAction}</span>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </CustomerTable>

                <div className="shrink-0 [&>nav]:shadow-2xs">
                  <ListPagination
                    label={M.tabReservations}
                    page={bookingPage}
                    pageSize={bookingPageSize}
                    total={filteredBookings.length}
                    unitLabel={M.bookingUnitLabel}
                    onPageChange={(page) => setBookingPage(page)}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function CustomerStorageHub(props: Readonly<CustomerStorageHubProps>) {
  return (
    <Suspense fallback={<LoadingState variant="table" />}>
      <StorageHubContent {...props} />
    </Suspense>
  );
}
