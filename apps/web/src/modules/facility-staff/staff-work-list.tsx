"use client";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  DoorOpen,
  ListFilter,
  RefreshCw,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { isMockMode } from "@/config/api-mode";
import { useAuthStore } from "@/features/auth/auth-store";
import { FacilitySwitcher } from "@/features/facilities/facility-switcher";
import { useFacilityContext } from "@/features/facilities/use-facility-context";
import { staffWorkDate } from "./staff-work.data";
import { STAFF_WORK as M } from "./staff-work.messages";
import type {
  StaffWorkContentProps,
  StaffWorkFilters,
  StaffWorkGroup,
  StaffWorkRowProps,
} from "./staff-work.types";
import { useStaffWork } from "./use-staff-work";

const controlClass =
  "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100";
export function StaffWorkList() {
  const scope = useFacilityContext();
  const userId = useAuthStore((s) => s.session?.user.id);
  if (scope.isLoading) return <LoadingState variant="table" />;
  if (scope.isError) return <ErrorState message={M.loadError} onRetry={() => scope.refetch()} />;
  if (!scope.currentFacility)
    return <EmptyState title={M.noFacility} description={M.noFacilityHint} />;
  return (
    <div className="space-y-6">
      {scope.isMultiFacility && (
        <FacilitySwitcher
          activeAssignments={scope.activeAssignments}
          currentFacilityId={scope.currentFacilityId}
          onSwitchFacility={scope.switchFacility}
        />
      )}
      <StaffWorkContent
        key={`${userId}:${scope.currentFacilityId}`}
        facilityId={scope.currentFacilityId}
      />
    </div>
  );
}
function StaffWorkContent({ facilityId }: StaffWorkContentProps) {
  const title = M.title;
  const params = useSearchParams();
  const userId = useAuthStore((s) => s.session?.user.id);
  const storageKey = `metastorage.staff-work.v2:${userId}:${facilityId}`;
  const [filters, setFilters] = useState<StaffWorkFilters>(() => {
    let saved: Partial<StaffWorkFilters> = {};
    try {
      saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "{}");
    } catch {
      /* Session persistence is optional. */
    }
    const kind = params.get("kind") ?? saved.kind;
    const group = params.get("group") ?? saved.group;
    const groups: StaffWorkGroup[] =
      kind === "TASK"
        ? ["pending", "review", "done"]
        : kind === "CHECK_IN"
          ? ["pending", "done", "closed"]
          : ["pending", "review", "done", "closed"];
    const date = params.get("date") ?? saved.date ?? "all";
    return {
      kind: kind === "CHECK_IN" || kind === "TASK" ? kind : "",
      group: groups.includes(group as StaffWorkGroup) ? (group as StaffWorkGroup) : "pending",
      date: date === "all" || /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "all",
      search: typeof saved.search === "string" ? saved.search : "",
      page: Number.isSafeInteger(saved.page) && Number(saved.page) > 0 ? Number(saved.page) : 1,
    };
  });
  const groups: StaffWorkGroup[] =
    filters.kind === "TASK"
      ? ["pending", "review", "done"]
      : filters.kind === "CHECK_IN"
        ? ["pending", "done", "closed"]
        : ["pending", "review", "done", "closed"];
  const work = useStaffWork(facilityId, filters.date, filters.kind);
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(filters));
    } catch {
      /* Keep controls usable without storage. */
    }
  }, [filters, storageKey]);
  const update = (values: Partial<StaffWorkFilters>) =>
    setFilters((current) => ({ ...current, ...values, page: values.page ?? 1 }));
  const filtered = work.items.filter(
    (item) =>
      (filters.date === "all" || !item.startsAt || staffWorkDate(item.startsAt) === filters.date) &&
      `${item.title} ${item.reference} ${item.typeLabel}`
        .toLocaleLowerCase("vi")
        .includes(filters.search.trim().toLocaleLowerCase("vi")),
  );
  const rows = filtered
    .filter((item) => item.group === filters.group)
    .sort((a, b) => {
      if (!a.startsAt && b.startsAt) return 1;
      if (a.startsAt && !b.startsAt) return -1;
      return (a.startsAt ?? "").localeCompare(b.startsAt ?? "") || a.id.localeCompare(b.id);
    });
  const pageCount = Math.max(1, Math.ceil(rows.length / 10)),
    page = Math.min(filters.page, pageCount);
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">
            {M.staff}
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{title}</h1>
          <p className="mt-2 text-sm text-slate-600">{M.subtitle}</p>
        </div>
        <Button variant="outline" disabled={work.refreshing} onClick={() => work.refresh()}>
          <RefreshCw size={16} className={work.refreshing ? "animate-spin" : ""} />
          {M.refresh}
        </Button>
      </header>
      <section
        aria-label={M.list}
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs"
      >
        <div
          className="flex flex-wrap gap-1 border-b border-slate-100 px-3 pt-3 sm:px-5"
          role="tablist"
          aria-label={title}
        >
          {groups.map((group) => (
            <button
              key={group}
              type="button"
              role="tab"
              id={`work-tab-${group}`}
              aria-controls="work-results"
              aria-selected={filters.group === group}
              tabIndex={filters.group === group ? 0 : -1}
              onKeyDown={(event) => {
                const position = groups.indexOf(group);
                const next =
                  event.key === "ArrowRight"
                    ? groups[(position + 1) % groups.length]
                    : event.key === "ArrowLeft"
                      ? groups[(position + groups.length - 1) % groups.length]
                      : event.key === "Home"
                        ? groups[0]
                        : event.key === "End"
                          ? groups[groups.length - 1]
                          : undefined;
                if (next) {
                  event.preventDefault();
                  update({ group: next });
                  document.getElementById(`work-tab-${next}`)?.focus();
                }
              }}
              onClick={() => update({ group })}
              className={`min-h-12 rounded-t-lg border-b-2 px-3 text-sm font-semibold transition-colors sm:px-4 ${filters.group === group ? "border-emerald-800 bg-emerald-50/50 text-emerald-950" : "border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}
            >
              {M[group]}
              {!work.pending && !work.error && (
                <span className="ml-2 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">
                  {filtered.filter((item) => item.group === group).length}
                </span>
              )}
            </button>
          ))}
        </div>
        <div
          className={`grid gap-3 border-b border-slate-100 bg-slate-50/50 p-4 sm:p-5 ${filters.kind !== "TASK" ? "sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.3fr]" : "sm:grid-cols-2"}`}
        >
          {filters.kind !== "TASK" && (
            <div>
              <label
                htmlFor="staff-work-date"
                className="mb-1.5 block text-xs font-semibold text-slate-600"
              >
                {M.date}
              </label>
              <div className="flex gap-2">
                <input
                  id="staff-work-date"
                  type="date"
                  value={filters.date === "all" ? "" : filters.date}
                  onChange={(e) => update({ date: e.target.value || "all" })}
                  className={controlClass}
                />
                <button
                  type="button"
                  onClick={() => update({ date: staffWorkDate(new Date().toISOString()) })}
                  className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-emerald-900"
                >
                  {M.today}
                </button>
              </div>
              <button
                type="button"
                aria-pressed={filters.date === "all"}
                onClick={() => update({ date: "all" })}
                className="mt-1.5 text-xs font-medium text-emerald-800 underline underline-offset-4"
              >
                {M.allDates}
              </button>
            </div>
          )}
          <div>
            <label
              htmlFor="staff-work-kind"
              className="mb-1.5 block text-xs font-semibold text-slate-600"
            >
              {M.kind}
            </label>
            <select
              id="staff-work-kind"
              value={filters.kind}
              onChange={(event) => {
                const kind = event.target.value as StaffWorkFilters["kind"];
                update({
                  kind,
                  group:
                    (kind === "TASK" && filters.group === "closed") ||
                    (kind === "CHECK_IN" && filters.group === "review")
                      ? "pending"
                      : filters.group,
                });
              }}
              className={controlClass}
            >
              <option value="">{M.allKinds}</option>
              <option value="CHECK_IN">{M.bookingTasksTitle}</option>
              <option value="TASK">{M.facilityTasksTitle}</option>
            </select>
          </div>
          <div className={filters.kind !== "TASK" ? "sm:col-span-2 lg:col-span-1" : ""}>
            <label
              htmlFor="staff-work-search"
              className="mb-1.5 block text-xs font-semibold text-slate-600"
            >
              {M.search}
            </label>
            <div className="relative">
              <Search
                size={17}
                aria-hidden="true"
                className="absolute left-3 top-3.5 text-slate-400"
              />
              <input
                id="staff-work-search"
                value={filters.search}
                onChange={(e) => update({ search: e.target.value })}
                placeholder={M.searchPlaceholder}
                className={`${controlClass} pl-10`}
              />
            </div>
          </div>
        </div>
        <div
          id="work-results"
          role="tabpanel"
          aria-labelledby={`work-tab-${filters.group}`}
          className="p-4 sm:p-5"
        >
          {work.error && (
            <div className="mb-4">
              <ErrorState message={M.partialError} onRetry={() => work.refresh()} />
            </div>
          )}
          {isMockMode && <p className="mb-4 text-sm text-slate-600">{M.mockHint}</p>}
          {work.pending ? (
            <LoadingState variant="table" />
          ) : rows.length === 0 ? (
            work.error ? null : (
              <EmptyState title={M.noWork} description={M.noWorkHint} />
            )
          ) : (
            <>
              <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
                <ListFilter size={14} aria-hidden="true" />
                {M.shown(rows.length)}
              </div>
              <ul className="list-none divide-y divide-slate-100 p-0">
                {rows.slice((page - 1) * 10, page * 10).map((item) => (
                  <StaffWorkRow key={item.id} item={item} />
                ))}
              </ul>
              {rows.some((item) => !item.startsAt) && (
                <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                  {M.unscheduledHint}
                </p>
              )}
              {pageCount > 1 && (
                <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
                  <span className="text-xs text-slate-500">{M.page(page, pageCount)}</span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      disabled={page === 1}
                      onClick={() => update({ page: page - 1 })}
                    >
                      {M.previous}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={page === pageCount}
                      onClick={() => update({ page: page + 1 })}
                    >
                      {M.next}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
function StaffWorkRow({ item }: StaffWorkRowProps) {
  const Icon =
    item.kind === "CHECK_IN" ? DoorOpen : item.kind === "RETURN" ? ClipboardCheck : CalendarDays;
  const tone =
    item.group === "done"
      ? "bg-emerald-50 text-emerald-800"
      : item.group === "review"
        ? "bg-amber-50 text-amber-900"
        : item.group === "closed"
          ? "bg-slate-100 text-slate-600"
          : "bg-sky-50 text-sky-900";
  return (
    <li className="group flex flex-col gap-4 py-5 first:pt-1 last:pb-1 sm:flex-row sm:items-center">
      <span className="hidden size-11 shrink-0 place-items-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-800 sm:grid">
        <Icon size={20} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <span className="text-xs font-semibold text-slate-500">{item.typeLabel}</span>
        <h2 className="mt-1 break-words text-base font-bold text-slate-900">{item.title}</h2>
        {item.reference && (
          <p className="mt-1 break-words text-sm text-slate-500">{item.reference}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:w-44 sm:shrink-0 sm:flex-col sm:items-start">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}
        >
          {item.group === "done" && <CheckCircle2 size={13} aria-hidden="true" />}
          {item.statusLabel}
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
          <Clock3 size={13} aria-hidden="true" />
          {item.startsAt
            ? new Date(item.startsAt).toLocaleString("vi-VN", {
                timeZone: "Asia/Ho_Chi_Minh",
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })
            : M.unscheduled}
        </span>
      </div>
      <Link
        href={item.href}
        className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 sm:min-w-40"
      >
        {item.action}
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </li>
  );
}
