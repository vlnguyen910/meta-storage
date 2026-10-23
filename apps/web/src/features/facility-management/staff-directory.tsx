"use client";

import type { FacilityStaffMember } from "@metastorage/contracts";
import { Building2, Mail, Phone, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { Input, Select } from "@/components/ui/form-controls";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { isMockMode } from "@/config/api-mode";
import { useFacilityOptions, useTaskStaff } from "./hooks";
import { F5 } from "./management.messages";
import { ManagementField, panelClass } from "./management-ui";
import { STAFF_DIRECTORY as M } from "./staff-directory.messages";
import type { StaffDirectorySort } from "./staff-directory.types";

export function StaffDirectoryWorkspace() {
  const scope = useFacilityOptions();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<StaffDirectorySort>("name");
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

  if (isMockMode) return <p role="status">{F5.noMock}</p>;
  if (scope.query.isPending) return <LoadingState variant="table" />;
  if (scope.query.isError)
    return <ErrorState message={F5.loadError} onRetry={() => scope.query.refetch()} />;
  if (scope.query.data.length === 0) return <p role="status">{F5.noFacility}</p>;

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="text-3xl font-bold">{M.title}</h1>
        <p className="mt-2 text-sm text-slate-600">{M.description}</p>
      </header>
      <ManagementField label={F5.facility}>
        <Select value={scope.facilityId} onChange={(event) => scope.select(event.target.value)}>
          {scope.query.data.map((facility) => (
            <option key={facility.id} value={facility.id}>
              {facility.code} · {facility.name}
            </option>
          ))}
        </Select>
      </ManagementField>
      <StaffPanel
        key={scope.facilityId}
        staff={staff}
        total={staffQuery.data?.length ?? 0}
        isLoading={staffQuery.isPending}
        isError={staffQuery.isError}
        retry={() => staffQuery.refetch()}
        search={search}
        setSearch={setSearch}
        sort={sort}
        setSort={setSort}
      />
    </div>
  );
}

function StaffPanel({
  staff,
  total,
  isLoading,
  isError,
  retry,
  search,
  setSearch,
  sort,
  setSort,
}: {
  staff: FacilityStaffMember[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  retry: () => void;
  search: string;
  setSearch: (value: string) => void;
  sort: StaffDirectorySort;
  setSort: (value: StaffDirectorySort) => void;
}) {
  if (isLoading) return <LoadingState variant="table" />;
  if (isError) return <ErrorState message={M.error} onRetry={retry} />;
  if (total === 0)
    return (
      <div className={`${panelClass} grid justify-items-center gap-2 py-12 text-center`}>
        <UsersRound aria-hidden="true" className="text-slate-500" size={32} />
        <p role="status" className="font-semibold">
          {M.noStaff}
        </p>
      </div>
    );

  return (
    <section aria-labelledby="staff-directory-heading" className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="staff-directory-heading" className="text-xl font-bold">
            {M.staffCount(total)}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{M.workloadHint}</p>
        </div>
        <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-[minmax(16rem,1fr)_12rem]">
          <ManagementField label={M.search}>
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={M.searchPlaceholder}
            />
          </ManagementField>
          <ManagementField label={M.sort}>
            <Select
              value={sort}
              onChange={(event) => setSort(event.target.value as StaffDirectorySort)}
            >
              <option value="name">{M.sortByName}</option>
              <option value="workload">{M.sortByWorkload}</option>
            </Select>
          </ManagementField>
        </div>
      </div>
      {staff.length === 0 ? (
        <p role="status" className={`${panelClass} text-center text-slate-600`}>
          {M.noMatches}
        </p>
      ) : (
        <ul className="grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3">
          {staff.map((person) => (
            <li key={person.id}>
              <StaffCard person={person} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StaffCard({ person }: { person: FacilityStaffMember }) {
  const assignedBookings = person.assignedTasksCount ?? 0;
  return (
    <article className={`${panelClass} grid h-full content-start gap-4`}>
      <header className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-900">
          <UsersRound aria-hidden="true" size={21} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-lg font-bold leading-snug" title={person.name}>
            {person.name}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="text-sm text-slate-600">{M.role}</p>
            <span
              className={
                person.isActive
                  ? "shrink-0 rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-900"
                  : "shrink-0 rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700"
              }
            >
              {person.isActive ? F5.active : F5.inactive}
            </span>
          </div>
        </div>
      </header>
      <dl className="grid gap-3 border-t border-slate-200 pt-4 text-sm">
        <div className="flex min-w-0 items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50/70 p-3">
          <Mail aria-hidden="true" className="mt-0.5 shrink-0 text-emerald-800" size={16} />
          <div className="min-w-0">
            <dt className="text-xs font-semibold text-slate-600">{M.email}</dt>
            <dd className="break-all font-semibold text-emerald-950">
              <a
                className="underline decoration-emerald-500 underline-offset-2 transition-colors hover:text-emerald-700 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                href={`mailto:${person.email}`}
              >
                {person.email}
              </a>
            </dd>
          </div>
        </div>
        <div className="flex min-w-0 items-start gap-2">
          {person.phone ? (
            <Phone aria-hidden="true" className="mt-0.5 shrink-0 text-slate-500" size={16} />
          ) : (
            <Building2 aria-hidden="true" className="mt-0.5 shrink-0 text-slate-500" size={16} />
          )}
          <div className="min-w-0">
            <dt className="text-xs text-slate-500">{M.phone}</dt>
            <dd className="font-medium">
              {person.phone ? (
                <a
                  className="underline decoration-slate-300 underline-offset-2"
                  href={`tel:${person.phone}`}
                >
                  {person.phone}
                </a>
              ) : (
                M.missingPhone
              )}
            </dd>
          </div>
        </div>
      </dl>
      <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <span className="text-sm font-semibold text-slate-700">{M.assignedBookings}</span>
        <span
          className={`rounded-full border px-3 py-1 text-lg font-extrabold tabular-nums shadow-sm ${
            assignedBookings > 0
              ? "border-emerald-200 bg-emerald-100 text-emerald-950"
              : "border-slate-200 bg-white text-slate-700"
          }`}
        >
          {assignedBookings}
        </span>
      </div>
      {assignedBookings === 0 && (
        <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600">
          {M.unassigned}
        </p>
      )}
    </article>
  );
}
