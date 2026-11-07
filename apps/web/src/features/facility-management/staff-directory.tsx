"use client";

import type { FacilityStaffMember } from "@metastorage/contracts";
import { Mail, Phone, RefreshCw, Search, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { ListPagination } from "@/components/ui/list-pagination";
import { OperationalPageHeader } from "@/components/ui/operational";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { isMockMode } from "@/config/api-mode";
import { cn } from "@/lib/utils";
import { useFacilityOptions, useTaskStaff } from "./hooks";
import { F5 } from "./management.messages";
import { panelClass } from "./management-ui";
import { STAFF_DIRECTORY as M } from "./staff-directory.messages";
import type { StaffDirectorySort } from "./staff-directory.types";

export function StaffDirectoryWorkspace() {
  const scope = useFacilityOptions();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<StaffDirectorySort>("name");
  const [page, setPage] = useState(1);
  const pageSize = 6;
  const staffQuery = useTaskStaff(scope.facilityId);
  const staff = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase("vi");
    const results = (staffQuery.data ?? []).filter(
      (person) =>
        !normalized ||
        person.name.toLocaleLowerCase("vi").includes(normalized) ||
        person.email.toLocaleLowerCase("vi").includes(normalized),
    );
    return results.sort((left, right) =>
      sort === "workload"
        ? (left.assignedTasksCount ?? 0) - (right.assignedTasksCount ?? 0) ||
          left.name.localeCompare(right.name, "vi")
        : left.name.localeCompare(right.name, "vi"),
    );
  }, [search, sort, staffQuery.data]);
  const pageCount = Math.max(1, Math.ceil(staff.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageItems = staff.slice((safePage - 1) * pageSize, safePage * pageSize);
  // biome-ignore lint/correctness/useExhaustiveDependencies: search and sort intentionally reset the local page.
  useEffect(() => setPage(1), [search, sort]);

  if (isMockMode) return <p role="status">{F5.noMock}</p>;
  if (scope.query.isPending) return <LoadingState variant="table" />;
  if (scope.query.isError)
    return <ErrorState message={F5.loadError} onRetry={() => scope.query.refetch()} />;
  if (scope.query.data.length === 0) return <p role="status">{F5.noFacility}</p>;

  return (
    <div className="space-y-4">
      <OperationalPageHeader title={M.title} description={M.description} />
      {scope.query.data.length > 1 && (
        <div className="w-72">
          <DropdownSelect
            value={scope.facilityId}
            onChange={(val) => scope.select(val)}
            className="w-full"
            triggerClassName="h-10 w-full bg-white border-slate-200 text-xs font-semibold"
            options={scope.query.data.map((facility) => ({
              value: facility.id,
              label: `${facility.code} · ${facility.name}`,
            }))}
            maxVisibleItems={6}
          />
        </div>
      )}
      <StaffPanel
        key={scope.facilityId}
        staff={pageItems}
        total={staffQuery.data?.length ?? 0}
        filteredTotal={staff.length}
        isLoading={staffQuery.isPending}
        isError={staffQuery.isError}
        retry={() => staffQuery.refetch()}
        search={search}
        setSearch={setSearch}
        sort={sort}
        setSort={setSort}
        page={safePage}
        pageSize={pageSize}
        onPageChange={setPage}
      />
    </div>
  );
}

function StaffPanel({
  staff,
  total,
  filteredTotal,
  isLoading,
  isError,
  retry,
  search,
  setSearch,
  sort,
  setSort,
  page,
  pageSize,
  onPageChange,
}: {
  staff: FacilityStaffMember[];
  total: number;
  filteredTotal: number;
  isLoading: boolean;
  isError: boolean;
  retry: () => void;
  search: string;
  setSearch: (value: string) => void;
  sort: StaffDirectorySort;
  setSort: (value: StaffDirectorySort) => void;
  page: number;
  pageSize: number;
  onPageChange: (value: number) => void;
}) {
  if (isLoading) return <LoadingState variant="table" />;
  if (isError) return <ErrorState message={M.error} onRetry={retry} />;
  if (total === 0)
    return (
      <div className={`${panelClass} grid justify-items-center gap-2 py-12 text-center`}>
        <UsersRound aria-hidden="true" className="text-slate-400" size={32} />
        <p role="status" className="font-semibold text-slate-700">
          {M.noStaff}
        </p>
      </div>
    );

  return (
    <section aria-labelledby="staff-directory-heading" className="space-y-4">
      {/* Search & Sort Toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-md">
          <Search size={16} className="absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={M.searchPlaceholder}
            className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 transition-colors focus:border-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">
              {M.sort}:
            </span>
            <div className="w-44 shrink-0">
              <DropdownSelect
                value={sort}
                onChange={(val) => setSort(val as StaffDirectorySort)}
                className="w-full"
                triggerClassName="h-10 w-full text-xs font-semibold bg-white border-slate-200"
                options={[
                  { value: "name", label: M.sortByName },
                  { value: "workload", label: M.sortByWorkload },
                ]}
                maxVisibleItems={6}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={retry}
            disabled={isLoading}
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-2xs transition-colors hover:border-primary hover:bg-slate-50 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
            title="Làm mới"
            aria-label="Làm mới"
          >
            <RefreshCw size={15} className={isLoading ? "animate-spin text-primary" : ""} />
          </button>
        </div>
      </div>

      {/* Staff Grid */}
      {staff.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500 shadow-2xs">
          {M.noMatches}
        </div>
      ) : (
        <ul className="grid list-none gap-3.5 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {staff.map((person) => (
            <li key={person.id}>
              <StaffCard person={person} />
            </li>
          ))}
        </ul>
      )}

      {/* Pagination Footer */}
      <ListPagination
        label="nhân viên"
        page={page}
        pageSize={pageSize}
        total={filteredTotal}
        onPageChange={onPageChange}
        unitLabel="nhân viên"
      />
    </section>
  );
}

function StaffCard({ person }: { person: FacilityStaffMember }) {
  const assignedBookings = person.assignedTasksCount ?? 0;
  return (
    <article className="group flex h-full flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs transition-all hover:border-slate-300 hover:shadow-xs">
      {/* Top Header */}
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-800 transition-colors group-hover:bg-emerald-100/80">
              <UsersRound aria-hidden="true" size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-bold text-slate-900" title={person.name}>
                {person.name}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">{M.role}</p>
            </div>
          </div>

          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border",
              person.isActive
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-slate-200 bg-slate-100 text-slate-600",
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                person.isActive ? "bg-emerald-500" : "bg-slate-400",
              )}
            />
            {person.isActive ? F5.active : F5.inactive}
          </span>
        </div>

        {/* Contact info */}
        <div className="mt-3.5 space-y-2 border-t border-slate-100 pt-3 text-xs">
          <div className="flex items-center gap-2 text-slate-600">
            <Mail size={14} className="shrink-0 text-slate-400" aria-hidden="true" />
            <a
              href={`mailto:${person.email}`}
              className="truncate font-medium text-slate-700 transition-colors hover:text-primary hover:underline"
              title={person.email}
            >
              {person.email}
            </a>
          </div>

          <div className="flex items-center gap-2 text-slate-600">
            <Phone size={14} className="shrink-0 text-slate-400" aria-hidden="true" />
            {person.phone ? (
              <a
                href={`tel:${person.phone}`}
                className="truncate font-medium text-slate-700 transition-colors hover:text-primary"
              >
                {person.phone}
              </a>
            ) : (
              <span className="truncate text-slate-400 italic">{M.missingPhone}</span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Workload Pill (Consistent height across all cards!) */}
      <div className="mt-3.5 flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs">
        <span className="font-medium text-slate-600">{M.assignedBookings}</span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-xs font-bold border",
            assignedBookings > 0
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-slate-200 bg-white text-slate-500",
          )}
        >
          {assignedBookings} booking
        </span>
      </div>
    </article>
  );
}
