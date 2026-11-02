"use client";

import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  DoorOpen,
  RefreshCw,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ListPagination } from "@/components/ui/list-pagination";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isMockMode } from "@/config/api-mode";
import { useAuthStore } from "@/features/auth/auth-store";
import { FacilitySwitcher } from "@/features/facilities/facility-switcher";
import { useFacilityContext } from "@/features/facilities/use-facility-context";
import { cn } from "@/lib/utils";
import { staffWorkDate } from "./staff-work.data";
import { STAFF_WORK as M } from "./staff-work.messages";
import type {
  StaffWorkContentProps,
  StaffWorkFilters,
  StaffWorkGroup,
  StaffWorkRowProps,
} from "./staff-work.types";
import { useStaffWork } from "./use-staff-work";

export function StaffWorkList() {
  const scope = useFacilityContext();
  const userId = useAuthStore((s) => s.session?.user.id);
  if (scope.isLoading) return <LoadingState variant="table" />;
  if (scope.isError) return <ErrorState message={M.loadError} onRetry={() => scope.refetch()} />;
  if (!scope.currentFacility)
    return <EmptyState title={M.noFacility} description={M.noFacilityHint} />;
  return (
    <div className="space-y-4">
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
        ? ["pending", "done"]
        : kind === "CHECK_IN" || kind === "RETURN"
          ? ["pending", "done", "closed"]
          : ["pending", "done", "closed"];
    const date = params.get("date") ?? saved.date ?? "all";
    return {
      kind: kind === "CHECK_IN" || kind === "RETURN" || kind === "TASK" ? kind : "",
      group: groups.includes(group as StaffWorkGroup) ? (group as StaffWorkGroup) : "pending",
      date: date === "all" || /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "all",
      search: typeof saved.search === "string" ? saved.search : "",
      page: Number.isSafeInteger(saved.page) && Number(saved.page) > 0 ? Number(saved.page) : 1,
    };
  });

  const groups: StaffWorkGroup[] =
    filters.kind === "TASK"
      ? ["pending", "done"]
      : filters.kind === "CHECK_IN" || filters.kind === "RETURN"
        ? ["pending", "done", "closed"]
        : ["pending", "done", "closed"];

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

  const pageCount = Math.max(1, Math.ceil(rows.length / 10));
  const page = Math.min(filters.page, pageCount);

  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="mb-0.5 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-800">
            {M.staff}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-0.5 text-xs text-slate-500">{M.subtitle}</p>
        </div>
        <Button
          variant="outline"
          disabled={work.refreshing}
          onClick={() => work.refresh()}
          className="h-9 px-3.5 gap-2 text-xs font-semibold rounded-lg border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-2xs"
        >
          <RefreshCw size={14} className={work.refreshing ? "animate-spin" : ""} />
          <span>{M.refresh}</span>
        </Button>
      </header>

      {/* Main Filter & Table Card */}
      <section
        aria-label={M.list}
        className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs"
      >
        {/* Tab Pills */}
        <div
          className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 bg-slate-50/60 p-2 sm:px-4"
          role="tablist"
          aria-label={title}
        >
          {groups.map((group) => {
            const active = filters.group === group;
            const count = filtered.filter((item) => item.group === group).length;
            return (
              <button
                key={group}
                type="button"
                role="tab"
                id={`work-tab-${group}`}
                aria-controls="work-results"
                aria-selected={active}
                tabIndex={active ? 0 : -1}
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
                className={cn(
                  "inline-flex h-8.5 items-center gap-2 rounded-lg px-3.5 text-xs font-bold transition-all cursor-pointer",
                  active
                    ? "bg-white text-primary shadow-xs ring-1 ring-slate-200/80"
                    : "text-slate-600 hover:bg-white/60 hover:text-slate-900",
                )}
              >
                <span>{M[group]}</span>
                {!work.pending && !work.error && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.2 text-[10px] font-bold tabular-nums",
                      active ? "bg-primary/10 text-primary" : "bg-slate-200/70 text-slate-600",
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Filter Controls Row */}
        <div className="grid gap-3.5 border-b border-slate-100 bg-white p-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {filters.kind !== "TASK" && (
            <div>
              <div className="mb-1.5 flex h-5 items-center justify-between">
                <label
                  htmlFor="staff-work-date"
                  className="text-xs font-bold text-slate-700 select-none"
                >
                  {M.date}
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => update({ date: staffWorkDate(new Date().toISOString()) })}
                    className={cn(
                      "h-5 px-2 rounded-md text-[10px] font-bold transition-all cursor-pointer border",
                      filters.date === staffWorkDate(new Date().toISOString())
                        ? "bg-primary text-white border-primary shadow-2xs"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900",
                    )}
                  >
                    {M.today}
                  </button>
                  <button
                    type="button"
                    aria-pressed={filters.date === "all"}
                    onClick={() => update({ date: "all" })}
                    className={cn(
                      "h-5 px-2 rounded-md text-[10px] font-bold transition-all cursor-pointer border",
                      filters.date === "all"
                        ? "bg-primary text-white border-primary shadow-2xs"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900",
                    )}
                  >
                    {M.allDates}
                  </button>
                </div>
              </div>
              <input
                id="staff-work-date"
                type="date"
                value={filters.date === "all" ? "" : filters.date}
                onChange={(e) => update({ date: e.target.value || "all" })}
                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 text-xs text-slate-800 outline-none transition-colors focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary"
              />
            </div>
          )}

          <div className={filters.kind === "TASK" ? "sm:col-span-1" : ""}>
            <div className="mb-1.5 flex h-5 items-center">
              <label
                htmlFor="staff-work-kind"
                className="text-xs font-bold text-slate-700 select-none"
              >
                {M.kind}
              </label>
            </div>
            <select
              id="staff-work-kind"
              value={filters.kind}
              onChange={(event) => {
                const kind = event.target.value as StaffWorkFilters["kind"];
                update({
                  kind,
                  group: kind === "TASK" && filters.group === "closed" ? "pending" : filters.group,
                });
              }}
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 text-xs text-slate-800 outline-none transition-colors focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary"
            >
              <option value="">{M.allKinds}</option>
              <option value="CHECK_IN">{M.bookingTasksTitle}</option>
              <option value="RETURN">{M.return}</option>
              <option value="TASK">{M.facilityTasksTitle}</option>
            </select>
          </div>

          <div className={filters.kind === "TASK" ? "sm:col-span-1" : ""}>
            <div className="mb-1.5 flex h-5 items-center">
              <label
                htmlFor="staff-work-search"
                className="text-xs font-bold text-slate-700 select-none"
              >
                {M.search}
              </label>
            </div>
            <div className="relative">
              <Search
                size={14}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                id="staff-work-search"
                value={filters.search}
                onChange={(e) => update({ search: e.target.value })}
                placeholder={M.searchPlaceholder}
                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-8.5 pr-3 text-xs text-slate-800 placeholder:text-slate-400 outline-none transition-colors focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* Results Tabpanel */}
        <div
          id="work-results"
          role="tabpanel"
          aria-labelledby={`work-tab-${filters.group}`}
          className="p-0"
        >
          {work.error && (
            <div className="p-4">
              <ErrorState message={M.partialError} onRetry={() => work.refresh()} />
            </div>
          )}

          {isMockMode && <p className="px-4 pt-3 text-xs text-slate-500">{M.mockHint}</p>}

          {work.pending ? (
            <div className="p-4">
              <LoadingState variant="table" />
            </div>
          ) : rows.length === 0 ? (
            work.error ? null : (
              <div className="p-8">
                <EmptyState title={M.noWork} description={M.noWorkHint} />
              </div>
            )
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="border-b border-slate-200 bg-slate-50/70">
                    <TableRow className="hover:bg-transparent border-0">
                      <TableHead className="h-9 px-4 text-xs font-bold uppercase tracking-wider text-slate-600">
                        Loại công việc
                      </TableHead>
                      <TableHead className="h-9 px-4 text-xs font-bold uppercase tracking-wider text-slate-600">
                        Nhiệm vụ & Khách hàng
                      </TableHead>
                      <TableHead className="h-9 px-4 text-xs font-bold uppercase tracking-wider text-slate-600">
                        Thời gian
                      </TableHead>
                      <TableHead className="h-9 px-4 text-center text-xs font-bold uppercase tracking-wider text-slate-600">
                        Trạng thái
                      </TableHead>
                      <TableHead className="h-9 px-4 text-right text-xs font-bold uppercase tracking-wider text-slate-600">
                        Thao tác
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice((page - 1) * 10, page * 10).map((item) => (
                      <StaffWorkTableRow key={item.id} item={item} />
                    ))}
                  </TableBody>
                </Table>
              </div>

              {rows.some((item) => !item.startsAt) && (
                <p className="border-t border-slate-100 bg-slate-50/50 px-4 py-2.5 text-[11px] leading-5 text-slate-500">
                  {M.unscheduledHint}
                </p>
              )}

              {/* Bottom Pagination Bar */}
              <div className="border-t border-slate-100 p-3 bg-slate-50/40">
                <ListPagination
                  label={M.title}
                  unitLabel="công việc"
                  page={page}
                  pageSize={10}
                  total={rows.length}
                  onPageChange={(p) => update({ page: p })}
                />
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function StaffWorkTableRow({ item }: StaffWorkRowProps) {
  const Icon = item.kind === "CHECK_IN" ? DoorOpen : CalendarDays;
  const tone =
    item.group === "done"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : item.group === "closed"
        ? "bg-slate-100 text-slate-600 border-slate-200"
        : "bg-blue-50 text-blue-700 border-blue-200";

  return (
    <TableRow role="listitem" className="hover:bg-slate-50/80 transition-colors">
      {/* Col 1: Work Type */}
      <TableCell className="py-2.5 px-4">
        <div className="flex items-center gap-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-emerald-50 text-emerald-800">
            <Icon size={15} aria-hidden="true" />
          </span>
          <span className="text-xs font-semibold text-slate-700">{item.typeLabel}</span>
        </div>
      </TableCell>

      {/* Col 2: Title & Reference */}
      <TableCell className="py-2.5 px-4 min-w-[200px] max-w-[320px]">
        <div className="min-w-0">
          <h2 className="text-xs font-bold text-slate-900 break-words">{item.title}</h2>
          {item.reference && (
            <p className="mt-0.5 font-mono text-[11px] text-slate-500 break-words">
              {item.reference}
            </p>
          )}
        </div>
      </TableCell>

      {/* Col 3: Starts At */}
      <TableCell className="py-2.5 px-4 text-xs text-slate-600">
        <div className="flex items-center gap-1.5">
          <Clock3 size={13} className="text-slate-400 shrink-0" aria-hidden="true" />
          <span>
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
      </TableCell>

      {/* Col 4: Status Badge */}
      <TableCell className="py-2.5 px-4 text-center">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
            tone,
          )}
        >
          {item.group === "done" && <CheckCircle2 size={11} aria-hidden="true" />}
          {item.statusLabel}
        </span>
      </TableCell>

      {/* Col 5: Action Button */}
      <TableCell className="py-2.5 px-4 text-right">
        <Link
          href={item.href}
          className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-white shadow-2xs transition-all hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-primary cursor-pointer"
        >
          <span>{item.action}</span>
          <ArrowRight size={13} aria-hidden="true" />
        </Link>
      </TableCell>
    </TableRow>
  );
}
