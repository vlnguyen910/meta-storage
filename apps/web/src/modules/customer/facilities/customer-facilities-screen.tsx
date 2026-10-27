"use client";

import {
  Building2,
  CheckCircle2,
  ChevronRight,
  LayoutGrid,
  List,
  MapPin,
  RotateCcw,
  Search,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { CustomerTable } from "@/components/ui/customer-table";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { ListPagination } from "@/components/ui/list-pagination";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { customerRoutes } from "@/config/routes";
import { useFacilities } from "@/features/facilities/hooks";
import { formatCurrency } from "@/lib/format";
import { CUSTOMER_FACILITIES_MESSAGES as M } from "./customer-facilities.messages";
import type { CustomerFacilitiesFilters, FacilityViewMode } from "./customer-facilities.types";

function getCity(address: string): string {
  if (address.includes("Hà Nội")) return "Hà Nội";
  if (address.includes("Đà Nẵng")) return "Đà Nẵng";
  if (address.includes("Hồ Chí Minh") || address.includes("TP.HCM")) return "TP. Hồ Chí Minh";
  const parts = address.split(",");
  return parts[parts.length - 1]?.trim() ?? "Việt Nam";
}

const initialFilters: CustomerFacilitiesFilters = {
  search: "",
  city: "",
  sort: "name",
  page: 1,
  viewMode: "grid",
};

export function CustomerFacilitiesScreen() {
  const [filters, setFilters] = useState<CustomerFacilitiesFilters>(initialFilters);
  const [searchInput, setSearchInput] = useState("");
  const [viewMode, setViewMode] = useState<FacilityViewMode>("grid");
  const pageSize = 6;

  const query = useFacilities({
    search: filters.search,
    city: filters.city,
    sort: filters.sort,
    page: filters.page,
    pageSize,
  });

  const handleSearchSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    setFilters((prev) => ({ ...prev, search: searchInput.trim(), page: 1 }));
  };

  const handleCityChange = (city: string) => {
    setFilters((prev) => ({ ...prev, city, page: 1 }));
  };

  const handleSortChange = (sort: string) => {
    setFilters((prev) => ({ ...prev, sort: sort as "name" | "price", page: 1 }));
  };

  const handleResetFilters = () => {
    setSearchInput("");
    setFilters((prev) => ({ ...initialFilters, viewMode: prev.viewMode }));
  };

  const total = query.data?.total ?? 0;
  const items = query.data?.items ?? [];

  return (
    <div className="flex flex-col h-full w-full overflow-hidden min-h-0 gap-3.5">
      {/* 1. Header (Compact) */}
      <header className="shrink-0">
        <p className="mb-0.5 mt-0 text-xs font-semibold text-primary">{M.eyebrow}</p>
        <h1 className="m-0 font-['Space_Grotesk'] text-xl sm:text-2xl font-bold tracking-tight">
          {M.title}
        </h1>
        <p className="mb-0 mt-0.5 text-xs text-slate-600">{M.description}</p>
      </header>

      {/* 2. Compact Single-row Toolbar */}
      <section
        aria-label={M.searchConfirm}
        className="shrink-0 flex items-center gap-2 rounded-card border border-line bg-white p-2 shadow-card min-h-12 relative z-20"
      >
        <form
          onSubmit={handleSearchSubmit}
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
              value={searchInput}
              placeholder={M.searchPlaceholder}
              onChange={(e) => setSearchInput(e.target.value)}
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
          value={filters.city}
          onChange={handleCityChange}
          placement="bottom"
          className="w-40 shrink-0"
          triggerClassName="h-9 min-h-9 text-xs bg-white border-line"
          placeholder={M.cityFilter}
          options={[
            { value: "", label: M.allCities },
            ...M.cities.map((city) => ({ value: city, label: city })),
          ]}
          maxVisibleItems={6}
        />

        <DropdownSelect
          value={filters.sort}
          onChange={handleSortChange}
          placement="bottom"
          className="w-44 shrink-0"
          triggerClassName="h-9 min-h-9 text-xs bg-white border-line"
          placeholder={M.sortFilter}
          options={[
            { value: "name", label: M.sortName },
            { value: "price", label: M.sortPrice },
          ]}
          maxVisibleItems={6}
        />

        {/* View Mode Toggle: Card View vs Table View */}
        <div className="flex items-center rounded-lg border border-line bg-slate-100 p-0.5 shrink-0">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            title={M.cardView}
            aria-label={M.cardView}
            className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              viewMode === "grid"
                ? "bg-white text-primary shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <LayoutGrid size={14} />
            <span className="hidden sm:inline">{M.cardView}</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            title={M.tableView}
            aria-label={M.tableView}
            className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              viewMode === "table"
                ? "bg-white text-primary shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <List size={14} />
            <span className="hidden sm:inline">{M.tableView}</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          <Button
            variant="outline"
            className="h-9 min-h-9 px-2.5 text-xs font-semibold gap-1.5"
            icon={<RotateCcw size={14} aria-hidden="true" />}
            onClick={handleResetFilters}
          >
            {M.resetFilters}
          </Button>
        </div>
      </section>

      {/* 3. Facilities Content & Pagination */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden gap-2">
        {query.isLoading ? (
          <LoadingState label={M.loading} variant="table" />
        ) : query.isError ? (
          <ErrorState message={M.error} onRetry={() => query.refetch()} />
        ) : total === 0 ? (
          <section className="text-center py-8 rounded-card border border-line bg-white shadow-card flex-1 flex flex-col items-center justify-center p-6">
            <Building2 className="mx-auto size-10 text-slate-400" />
            <h3 className="mt-2 text-sm font-semibold text-slate-800">{M.emptyTitle}</h3>
            <p className="mt-1 text-xs text-slate-500 max-w-sm">{M.emptyDesc}</p>
            <Button
              variant="outline"
              onClick={handleResetFilters}
              className="mt-4 text-xs font-semibold"
            >
              {M.resetFilters}
            </Button>
          </section>
        ) : viewMode === "grid" ? (
          /* CARD / GRID VIEW (Default as requested) */
          <>
            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((facility) => {
                  const imageIndex = Number.parseInt(facility.code.slice(-2), 10) % 3 || 0;
                  return (
                    <article
                      key={facility.id}
                      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-card"
                    >
                      {/* Card Image Header */}
                      <div className="relative h-40 w-full overflow-hidden bg-slate-100">
                        <Image
                          src={`/images/metastorage/unit-${imageIndex}.png`}
                          alt={M.imageAlt(facility.name)}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/20 to-transparent" />
                        <div className="absolute top-3 left-3">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/90 backdrop-blur-xs px-2.5 py-0.5 text-[11px] font-bold text-white shadow-xs">
                            <CheckCircle2 className="size-3" />
                            {M.activeStatus}
                          </span>
                        </div>
                        <div className="absolute top-3 right-3">
                          <span className="rounded-md bg-slate-900/75 backdrop-blur-xs px-2 py-0.5 text-[11px] font-medium text-slate-200">
                            {getCity(facility.address)}
                          </span>
                        </div>
                        <div className="absolute bottom-2.5 left-3 font-mono text-xs font-bold text-white/90">
                          {facility.code}
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="flex flex-1 flex-col p-4">
                        <h3 className="m-0 text-base font-bold text-slate-900 group-hover:text-primary transition-colors">
                          {facility.name}
                        </h3>
                        <p className="mt-1.5 mb-0 flex items-start gap-1.5 text-xs text-slate-500 line-clamp-2">
                          <MapPin className="size-3.5 shrink-0 text-slate-400 mt-0.5" />
                          <span>{facility.address}</span>
                        </p>

                        {/* Card Footer */}
                        <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                          <div>
                            <span className="block text-[10px] uppercase font-semibold text-slate-400">
                              {M.priceLabel}
                            </span>
                            {facility.startingMonthlyPrice ? (
                              <p className="m-0 text-sm font-bold text-primary">
                                {M.priceFrom(formatCurrency(facility.startingMonthlyPrice))}
                              </p>
                            ) : (
                              <p className="m-0 text-xs italic text-slate-400">{M.priceUpdating}</p>
                            )}
                          </div>

                          <Link
                            href={`${customerRoutes.newReservation}?facilityId=${facility.id}&new=1`}
                            className="inline-flex items-center gap-1 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-dark"
                          >
                            <span>{M.selectAction}</span>
                            <ChevronRight className="size-3.5" />
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="shrink-0 [&>nav]:shadow-2xs">
              <ListPagination
                label={M.paginationLabel}
                page={filters.page}
                pageSize={pageSize}
                total={total}
                unitLabel={M.unitLabel}
                onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))}
              />
            </div>
          </>
        ) : (
          /* TABLE VIEW */
          <>
            <CustomerTable title={M.tableTitle} headings={M.tableHeadings}>
              {items.map((facility) => (
                <tr key={facility.id}>
                  <td>
                    <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                      {facility.code}
                    </span>
                  </td>
                  <td>
                    <div className="font-bold text-slate-900">{facility.name}</div>
                    <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                      <MapPin className="size-3 text-slate-400 shrink-0" />
                      <span>{facility.address}</span>
                    </div>
                  </td>
                  <td>
                    <span className="font-semibold text-slate-700 text-xs">
                      {getCity(facility.address)}
                    </span>
                  </td>
                  <td>
                    {facility.startingMonthlyPrice ? (
                      <span className="font-bold text-primary text-xs">
                        {M.priceFrom(formatCurrency(facility.startingMonthlyPrice))}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 italic">{M.priceUpdating}</span>
                    )}
                  </td>
                  <td>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <CheckCircle2 className="size-3" />
                      {M.activeStatus}
                    </span>
                  </td>
                  <td>
                    <Link
                      href={`${customerRoutes.newReservation}?facilityId=${facility.id}&new=1`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-primary-dark transition-colors shadow-2xs"
                    >
                      <span>{M.selectAction}</span>
                      <ChevronRight className="size-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </CustomerTable>

            <div className="shrink-0 [&>nav]:shadow-2xs">
              <ListPagination
                label={M.paginationLabel}
                page={filters.page}
                pageSize={pageSize}
                total={total}
                unitLabel={M.unitLabel}
                onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
