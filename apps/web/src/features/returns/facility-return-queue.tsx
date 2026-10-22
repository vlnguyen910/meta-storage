"use client";

import type { ReturnRequestDto } from "@metastorage/contracts";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Calendar,
  Clock,
  FileText,
  Search,
  UserCheck,
  UserCog,
  UserX,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/display";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useAuthStore } from "@/features/auth/auth-store";
import { useMyFacilityAssignments } from "@/features/check-in/hooks";
import { api } from "@/lib/api";
import type { FacilityReturnQueueProps, ReturnQueueRowProps } from "./facility-return-queue.types";
import { useFacilityReturnQueue } from "./hooks";
import { F3 } from "./integration.messages";
import { ReturnStaffAssignModal } from "./return-staff-assign-modal";
import { ReturnStatusBadge } from "./return-status-badge";
import { RETURNS_MESSAGES as M, returnStatusLabel } from "./returns.messages";

export function FacilityReturnQueue({ actorRole }: FacilityReturnQueueProps) {
  const assignments = useMyFacilityAssignments();
  const assignedFacilityId = useAuthStore((state) => state.session?.user.assignedFacilityId);
  const activeFacilities = assignments.data?.filter((item) => item.isActive) ?? [];
  const [selectedFacilityId, setSelectedFacilityId] = useState("");
  const facilityId =
    selectedFacilityId ||
    assignedFacilityId ||
    (activeFacilities.length === 1 ? activeFacilities[0]?.facilityId : "");
  const facility = activeFacilities.find((item) => item.facilityId === facilityId);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [assigningRequest, setAssigningRequest] = useState<ReturnRequestDto | null>(null);

  const queue = useFacilityReturnQueue(facility?.facilityId ?? "", actorRole, status || undefined);

  const staffQuery = useQuery({
    queryKey: ["facilities", facility?.facilityId, "staff"],
    queryFn: () => api.facilities.getStaff(facility?.facilityId ?? ""),
    enabled: Boolean(facility?.facilityId) && actorRole === "FACILITY_MANAGER",
  });

  const staffMap = useMemo(
    () => new Map(staffQuery.data?.map((s) => [s.id, s.name]) ?? []),
    [staffQuery.data],
  );

  const staffList = useMemo(
    () =>
      staffQuery.data?.map((person) => ({
        id: person.id,
        name: person.name,
        isActive: person.isActive,
      })) ?? [],
    [staffQuery.data],
  );

  const title = actorRole === "FACILITY_MANAGER" ? M.queueTitle : M.staffQueueTitle;

  const stats = useMemo(() => {
    const all = queue.data ?? [];
    return {
      total: all.length,
      pending: all.filter((r) => ["PENDING", "CONFIRMED"].includes(r.status)).length,
      inspecting: all.filter((r) => ["INSPECTING", "FAILED"].includes(r.status)).length,
      completed: all.filter((r) => r.status === "COMPLETED").length,
    };
  }, [queue.data]);

  const filteredRequests = useMemo(() => {
    if (!queue.data) return [];
    if (!search.trim()) return queue.data;
    const q = search.toLowerCase().trim();
    return queue.data.filter(
      (r) => r.id.toLowerCase().includes(q) || Boolean(r.reason?.toLowerCase().includes(q)),
    );
  }, [queue.data, search]);

  if (assignments.isLoading) return <LoadingState variant="table" />;
  if (assignments.isError)
    return <ErrorState message={M.queueError} onRetry={() => assignments.refetch()} />;
  const facilityPicker = (
    <label className="grid gap-2 text-sm font-semibold">
      {F3.facility}
      <select
        className="min-h-11 rounded border border-slate-300 bg-white px-3"
        value={facility?.facilityId ?? ""}
        onChange={(e) => {
          setSelectedFacilityId(e.target.value);
          setAssigningRequest(null);
        }}
      >
        <option value="">{F3.chooseFacility}</option>
        {activeFacilities.map((item) => (
          <option key={item.facilityId} value={item.facilityId}>
            {item.facilityName}
          </option>
        ))}
      </select>
    </label>
  );
  if (!facility) return <Card>{activeFacilities.length ? facilityPicker : M.noFacility}</Card>;
  if (queue.isLoading) return <LoadingState variant="table" />;
  if (queue.isError && !queue.data?.length)
    return <ErrorState message={M.queueError} onRetry={() => queue.refetch()} />;

  return (
    <div className="space-y-6">
      {activeFacilities.length > 1 && facilityPicker}
      {/* Page Header with Facility Info */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <PageHeader eyebrow="Vận hành cơ sở" title={title} />
          <p className="-mt-5 text-sm text-slate-600">{M.queueDescription}</p>
        </div>

        <div className="inline-flex items-center gap-2 self-start rounded-2xl border border-emerald-200/80 bg-emerald-50/70 px-4 py-2 text-xs font-semibold text-emerald-900 shadow-2xs sm:self-auto">
          <Building2 className="size-4 text-emerald-700" aria-hidden="true" />
          <span>{facility.facilityName ?? M.facilityFallback}</span>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <button
          type="button"
          onClick={() => setStatus("")}
          className={`flex flex-col rounded-2xl border p-4 text-left transition-all ${
            status === ""
              ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/20"
              : "border-slate-200/80 bg-white hover:border-slate-300 shadow-2xs"
          }`}
        >
          <span className="text-xs font-medium text-slate-500">{M.statAll}</span>
          <strong className="mt-1 text-2xl font-bold text-slate-900">{stats.total}</strong>
        </button>

        <button
          type="button"
          onClick={() => setStatus(status === "PENDING" ? "" : "PENDING")}
          className={`flex flex-col rounded-2xl border p-4 text-left transition-all ${
            status === "PENDING"
              ? "border-amber-500 bg-amber-50/80 shadow-xs ring-1 ring-amber-500/20"
              : "border-slate-200/80 bg-white hover:border-slate-300 shadow-2xs"
          }`}
        >
          <span className="text-xs font-medium text-amber-700">{M.statPending}</span>
          <strong className="mt-1 text-2xl font-bold text-amber-900">{stats.pending}</strong>
        </button>

        <button
          type="button"
          onClick={() => setStatus(status === "INSPECTING" ? "" : "INSPECTING")}
          className={`flex flex-col rounded-2xl border p-4 text-left transition-all ${
            status === "INSPECTING"
              ? "border-teal-500 bg-teal-50/80 shadow-xs ring-1 ring-teal-500/20"
              : "border-slate-200/80 bg-white hover:border-slate-300 shadow-2xs"
          }`}
        >
          <span className="text-xs font-medium text-teal-700">{M.statInspecting}</span>
          <strong className="mt-1 text-2xl font-bold text-teal-900">{stats.inspecting}</strong>
        </button>

        <button
          type="button"
          onClick={() => setStatus(status === "COMPLETED" ? "" : "COMPLETED")}
          className={`flex flex-col rounded-2xl border p-4 text-left transition-all ${
            status === "COMPLETED"
              ? "border-emerald-500 bg-emerald-50/80 shadow-xs ring-1 ring-emerald-500/20"
              : "border-slate-200/80 bg-white hover:border-slate-300 shadow-2xs"
          }`}
        >
          <span className="text-xs font-medium text-emerald-700">{M.statCompleted}</span>
          <strong className="mt-1 text-2xl font-bold text-emerald-900">{stats.completed}</strong>
        </button>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          {/* Search box */}
          <div className="relative min-w-56 max-w-sm flex-1">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={M.searchPlaceholder}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-10 pr-9 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label="Xóa tìm kiếm"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          {/* Status select dropdown */}
          <div className="flex items-center gap-2">
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 text-xs font-medium text-slate-800 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">{M.allStatuses}</option>
              {(
                ["PENDING", "CONFIRMED", "INSPECTING", "FAILED", "COMPLETED", "CANCELLED"] as const
              ).map((value) => (
                <option key={value} value={value}>
                  {returnStatusLabel(value)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Counter Badge */}
        <span className="self-end rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 sm:self-auto">
          {M.requestCount(filteredRequests.length)}
        </span>
      </div>

      {/* Requests List */}
      <p className="text-sm text-slate-600">{F3.loadedOnly}</p>
      {!filteredRequests.length ? (
        <Card className="py-14 text-center">
          <p className="m-0 text-sm font-medium text-slate-600">{M.noMatchingRequests}</p>
        </Card>
      ) : (
        <div className="grid gap-3.5">
          {filteredRequests.map((request) => (
            <ReturnQueueRow
              key={request.id}
              request={request}
              actorRole={actorRole}
              assignedStaffName={
                request.assignedStaffId ? staffMap.get(request.assignedStaffId) : null
              }
              onOpenAssignModal={(req) => setAssigningRequest(req)}
            />
          ))}
        </div>
      )}

      {/* Pop-out Assignment Modal */}
      {queue.isFetchNextPageError && (
        <p role="alert" className="text-red-700">
          {F3.error}
        </p>
      )}
      {queue.hasNextPage && (
        <Button
          variant="outline"
          loading={queue.isFetchingNextPage}
          disabled={queue.isFetchingNextPage}
          onClick={() => void queue.fetchNextPage()}
        >
          {F3.loadMore}
        </Button>
      )}
      {assigningRequest && facility && (
        <ReturnStaffAssignModal
          request={assigningRequest}
          facilityId={facility.facilityId}
          assignedStaffName={
            assigningRequest.assignedStaffId ? staffMap.get(assigningRequest.assignedStaffId) : null
          }
          staffList={staffList}
          isLoadingStaff={staffQuery.isLoading}
          isStaffError={staffQuery.isError}
          onClose={() => setAssigningRequest(null)}
        />
      )}
    </div>
  );
}

function ReturnQueueRow({
  request,
  actorRole,
  assignedStaffName,
  onOpenAssignModal,
}: ReturnQueueRowProps) {
  const canChangeAssignment =
    actorRole === "FACILITY_MANAGER" &&
    ["PENDING", "CONFIRMED", "INSPECTING", "FAILED"].includes(request.status);

  const href =
    actorRole === "FACILITY_MANAGER"
      ? `/facility-manager/returns/${request.id}`
      : `/staff/returns/${request.id}`;

  const formattedDate = new Date(request.startsAt).toLocaleString("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: request.timezone,
  });

  return (
    <div className="group rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all duration-200 hover:border-primary/40 hover:shadow-md">
      {/* Top Row: Request ID & Badges */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs font-bold tracking-wide text-slate-800">
            #{request.id.slice(-8)}
          </span>
          <span className="text-xs text-muted">{M.requestId}</span>
        </div>

        <div className="flex items-center gap-2">
          {request.manualReviewRequired && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 shadow-2xs">
              <AlertTriangle className="size-3 text-amber-600" aria-hidden="true" />
              {M.manualReviewBadge}
            </span>
          )}
          <ReturnStatusBadge status={request.status} />
        </div>
      </div>

      {/* Middle Content: Details */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {/* Schedule */}
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Calendar className="size-4" aria-hidden="true" />
          </div>
          <div>
            <span className="block text-xs font-medium text-muted">{M.schedule}</span>
            <strong className="text-sm font-semibold text-slate-900">{formattedDate}</strong>
          </div>
        </div>

        {/* Assigned Staff */}
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <UserCheck className="size-4 text-primary" aria-hidden="true" />
          </div>
          <div>
            <span className="block text-xs font-medium text-muted">{M.assignedStaff}</span>
            {assignedStaffName ? (
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-slate-900">
                {assignedStaffName}
              </span>
            ) : (
              <span className="mt-0.5 inline-flex items-center gap-1 rounded-md border border-amber-200/70 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                <UserX className="size-3 text-amber-500" aria-hidden="true" />
                {M.notAssigned}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Customer Reason / Note if exists */}
      {request.reason && (
        <div className="mt-3.5 flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs text-slate-700">
          <FileText className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" />
          <span className="line-clamp-2">{request.reason}</span>
        </div>
      )}

      {/* Bottom Actions Row */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3.5">
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <Clock className="size-3.5 text-slate-400" aria-hidden="true" />
          <span>{request.timezone}</span>
        </div>

        <div className="flex items-center gap-2.5">
          {canChangeAssignment && onOpenAssignModal && (
            <button
              type="button"
              onClick={() => onOpenAssignModal(request)}
              className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-primary/25 bg-white px-3.5 text-xs font-semibold text-primary shadow-2xs transition-all hover:border-primary hover:bg-primary/5 active:scale-[0.98]"
            >
              <UserCog className="size-4" aria-hidden="true" />
              {request.assignedStaffId ? M.changeStaff : M.assignStaff}
            </button>
          )}

          <Link
            href={href}
            aria-label={`${M.openRequest}: ${M.requestId} ${request.id}`}
            className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 text-xs font-semibold text-white shadow-2xs transition-all hover:bg-primary-dark hover:shadow active:scale-[0.98]"
          >
            {M.openRequest}
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}
