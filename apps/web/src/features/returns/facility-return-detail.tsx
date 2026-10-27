"use client";

import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Clock,
  Copy,
  FileText,
  MapPin,
  UserCheck,
  UserCog,
  UserX,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/display";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useMyFacilityAssignments } from "@/features/check-in/hooks";
import { api } from "@/lib/api";
import type { FacilityReturnDetailProps } from "./facility-return-detail.types";
import {
  useConfirmReturnRequest,
  useFinalizeReturnRequest,
  useRecordPhysicalReturn,
  useReturnRequest,
  useStartReturnInspection,
} from "./hooks";
import { F3 } from "./integration.messages";
import { facilityTimeToIso, money } from "./integration-utils";
import { ReturnFinancePanel } from "./return-finance-panel";
import { ReturnInspectionWorkspace } from "./return-inspection-workspace";
import { ReturnOperationalContext } from "./return-operational-context";
import { ReturnPrivatePhoto } from "./return-private-photo";
import { ReturnInspectionReview } from "./return-property-form";
import { ReturnStaffAssignModal } from "./return-staff-assign-modal";
import { ReturnStatusBadge } from "./return-status-badge";
import { ReturnTimeChanges } from "./return-time-changes";
import {
  RETURNS_MESSAGES as M,
  returnAuditLabel,
  returnStatusLabel,
  returnTimeChangeStatusLabel,
} from "./returns.messages";

function formatDateTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}

export function FacilityReturnDetail({ requestId, actorRole }: FacilityReturnDetailProps) {
  const assignments = useMyFacilityAssignments();
  const query = useReturnRequest(requestId);
  const facility = assignments.data?.find(
    (item) => item.isActive && item.facilityId === query.data?.request.facilityId,
  );
  const facilityId = facility?.facilityId ?? "";
  const confirm = useConfirmReturnRequest(requestId, facilityId);
  const start = useStartReturnInspection(requestId, facilityId);
  const record = useRecordPhysicalReturn(requestId, facilityId);
  const finalize = useFinalizeReturnRequest(requestId, facilityId);

  const [receiptAt, setReceiptAt] = useState("");
  const [receiptReason, setReceiptReason] = useState("");
  const [copied, setCopied] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [moreInfoOpen, setMoreInfoOpen] = useState(false);

  const staffQuery = useQuery({
    queryKey: ["facilities", facilityId, "staff"],
    queryFn: () => api.facilities.getStaff(facilityId),
    enabled: Boolean(facilityId) && actorRole === "FACILITY_MANAGER",
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

  if (assignments.isLoading || query.isLoading) return <LoadingState variant="detail" />;
  const accessLost =
    isAxiosError(query.error) && [401, 403, 404].includes(query.error.response?.status ?? 0);
  if (
    assignments.isError ||
    accessLost ||
    (query.isError && !query.data) ||
    !query.data ||
    !facility
  )
    return <ErrorState message={M.detailUnavailable} onRetry={() => void query.refetch()} />;

  const { request, actualReturnAt, inspections, evidence, timeChanges, audit } = query.data;

  const latestInspection = inspections[0];
  const isStaff = actorRole === "FACILITY_STAFF";
  const canFinalize = latestInspection?.status === "PASS" && request.status === "INSPECTING";
  const canRecordReceipt =
    isStaff &&
    !actualReturnAt &&
    !canFinalize &&
    ["CONFIRMED", "INSPECTING", "FAILED"].includes(request.status);
  const showChecklist = isStaff && latestInspection?.status === "DRAFT";
  const canStartInspection = isStaff && ["CONFIRMED", "FAILED"].includes(request.status);

  const nextStep = isStaff
    ? request.status === "PENDING"
      ? M.nextConfirm
      : canStartInspection
        ? M.nextStartInspection
        : showChecklist
          ? M.nextContinueInspection
          : canFinalize
            ? M.finalizeReturnReady
            : request.status === "COMPLETED"
              ? M.nextCompleted
              : M.nextWaiting
    : canFinalize
      ? M.finalizeReturnReady
      : M.nextManager;

  const shortId = request.id.slice(-8).toUpperCase();
  const backHref = isStaff ? "/staff/tasks" : "/facility-manager/tasks?view=returns";
  const assignedStaffName =
    query.data.context?.assignedStaff?.name ??
    (request.assignedStaffId ? staffMap.get(request.assignedStaffId) : null);
  const canChangeAssignment =
    actorRole === "FACILITY_MANAGER" &&
    ["PENDING", "CONFIRMED", "INSPECTING", "FAILED"].includes(request.status);

  async function copyRequestId() {
    try {
      await navigator.clipboard.writeText(request.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={`mx-auto w-full ${isStaff ? "max-w-4xl" : "max-w-6xl"} space-y-6 pb-10`}>
      {/* Top Navigation & Header */}
      <div>
        <Link
          href={backHref}
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 transition-colors hover:text-primary"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          <span>{M.backToQueue}</span>
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <PageHeader
              eyebrow={`${M.sectionTitle} · ${facility.facilityName ?? M.facilityFallback}`}
              title={M.details}
            />
            <p className="-mt-5 text-sm text-slate-600">
              {isStaff ? M.detailStaffDescription : M.detailManagerDescription}
            </p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            <ReturnStatusBadge status={request.status} />
            <button
              type="button"
              onClick={() => void copyRequestId()}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 hover:text-primary"
            >
              {copied ? (
                <>
                  <Check size={14} className="text-emerald-600" aria-hidden="true" />
                  <span>{M.copied}</span>
                </>
              ) : (
                <>
                  <Copy size={14} aria-hidden="true" />
                  <span>{M.copyId}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 2-Column Responsive Layout */}
      <div className={`grid grid-cols-1 items-start gap-6 ${isStaff ? "" : "lg:grid-cols-12"}`}>
        {/* ==================== LEFT COLUMN (Main Workflow Area: 7 cols) ==================== */}
        <div className={`space-y-6 ${isStaff ? "" : "lg:col-span-7"}`}>
          {/* Card 1: Next Action Hero Card */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  {request.status === "COMPLETED" ? (
                    <CheckCircle2 className="size-5 text-primary" aria-hidden="true" />
                  ) : request.status === "INSPECTING" ? (
                    <ClipboardCheck className="size-5 text-teal-600" aria-hidden="true" />
                  ) : (
                    <Clock className="size-5 text-primary" aria-hidden="true" />
                  )}
                </div>
                <div>
                  <span className="block text-xs font-bold uppercase tracking-wider text-primary">
                    {M.taskTitle}
                  </span>
                  <h2 className="m-0 text-lg font-bold text-slate-900">
                    {returnStatusLabel(request.status)}
                  </h2>
                </div>
              </div>
              <ReturnStatusBadge status={request.status} />
            </div>

            <p className="mt-4 text-sm leading-relaxed text-slate-700">{nextStep}</p>

            {/* Action Buttons for FS / FM */}
            {request.status === "PENDING" ||
            canStartInspection ||
            showChecklist ||
            canFinalize ||
            canRecordReceipt ? (
              <div className="mt-5 flex flex-wrap gap-3 border-t border-slate-100 pt-4">
                {request.status === "PENDING" && (
                  <Button
                    variant="primary"
                    type="button"
                    disabled={confirm.isPending}
                    loading={confirm.isPending}
                    onClick={() => confirm.mutate({ expectedVersion: request.version })}
                  >
                    <CheckCircle2 size={16} aria-hidden="true" />
                    {confirm.isPending ? M.saving : M.confirmSchedule}
                  </Button>
                )}

                {canStartInspection && (
                  <Button
                    variant="primary"
                    type="button"
                    disabled={start.isPending}
                    loading={start.isPending}
                    onClick={() => start.mutate({ expectedVersion: request.version })}
                  >
                    <ClipboardCheck size={16} aria-hidden="true" />
                    {start.isPending ? M.saving : M.startInspection}
                  </Button>
                )}

                {showChecklist && (
                  <a
                    href="#inspection-checklist"
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 font-semibold text-white shadow-2xs transition-colors hover:bg-primary-dark"
                  >
                    <ClipboardCheck size={16} aria-hidden="true" />
                    {M.jumpToChecklist}
                  </a>
                )}

                {canFinalize && (
                  <Button
                    variant="primary"
                    type="button"
                    disabled={finalize.isPending}
                    loading={finalize.isPending}
                    onClick={() => finalize.mutate({ expectedVersion: request.version })}
                  >
                    <CheckCircle2 size={16} aria-hidden="true" />
                    {finalize.isPending ? M.saving : M.finalizeReturnButton}
                  </Button>
                )}

                {canRecordReceipt && (
                  <a
                    href="#physical-receipt"
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-5 font-semibold text-primary transition-colors hover:bg-primary/10"
                  >
                    <MapPin size={16} aria-hidden="true" />
                    {M.jumpToReceipt}
                  </a>
                )}
              </div>
            ) : null}

            {/* Stale or Mutation Errors */}
            {(confirm.isError || start.isError || finalize.isError) && (
              <p
                role="alert"
                className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-800 border border-rose-200"
              >
                {M.stale}
              </p>
            )}

            {/* Manual Review Alert */}
            {request.manualReviewRequired && (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900">
                <AlertTriangle
                  className="mt-0.5 size-4 shrink-0 text-amber-600"
                  aria-hidden="true"
                />
                <span>{M.requestManualReview}</span>
              </div>
            )}
          </div>

          {/* Card 2: Finalize Return & Refund Card or Physical Receipt State */}
          {canFinalize ? (
            <div
              id="physical-receipt"
              className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/50 p-6 shadow-xs space-y-4"
            >
              <div className="flex items-start gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
                  <CheckCircle2 className="size-6" aria-hidden="true" />
                </div>
                <div>
                  <span className="block text-xs font-bold uppercase tracking-wider text-emerald-700">
                    {M.inspectionStep} · Đạt yêu cầu (PASS)
                  </span>
                  <h2 className="m-0 text-base font-bold text-slate-900">
                    {M.finalizeReturnTitle}
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-slate-700">
                    {M.finalizeReturnReady}
                  </p>
                </div>
              </div>

              {query.data.context && (
                <div className="grid gap-3 rounded-xl border border-emerald-200 bg-white p-4 sm:grid-cols-3 text-xs">
                  <div>
                    <span className="block text-slate-500">{F3.unitLabel}</span>
                    <strong className="text-sm font-bold text-slate-900">
                      {query.data.context.unit.code}
                    </strong>
                  </div>
                  <div>
                    <span className="block text-slate-500">Tiền cọc hoàn trả khách</span>
                    <strong className="text-sm font-bold text-emerald-700">
                      {money(query.data.context.rental.depositSnapshot)}
                    </strong>
                  </div>
                  <div>
                    <span className="block text-slate-500">Trạng thái sau xác nhận</span>
                    <strong className="text-sm font-bold text-slate-900">
                      Hoàn tất & Đóng hợp đồng
                    </strong>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
                <Button
                  variant="primary"
                  type="button"
                  disabled={finalize.isPending}
                  loading={finalize.isPending}
                  onClick={() => finalize.mutate({ expectedVersion: request.version })}
                >
                  <CheckCircle2 size={16} aria-hidden="true" />
                  {finalize.isPending ? M.saving : M.finalizeReturnButton}
                </Button>
              </div>
            </div>
          ) : actualReturnAt ? (
            <div className="flex items-center justify-between rounded-2xl border border-emerald-200/80 bg-emerald-50/60 p-5 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600/15 text-emerald-800">
                  <CheckCircle2 className="size-5" aria-hidden="true" />
                </div>
                <div>
                  <span className="block text-xs font-semibold text-emerald-800">
                    {M.receiptRecorded}
                  </span>
                  <strong className="text-sm font-bold text-slate-900">
                    {formatDateTime(actualReturnAt, request.timezone)}
                  </strong>
                </div>
              </div>
              <span className="rounded-full border border-emerald-300 bg-white px-3 py-1 text-xs font-semibold text-emerald-800 shadow-2xs">
                {M.receiptRecorded}
              </span>
            </div>
          ) : canRecordReceipt ? (
            <div
              id="physical-receipt"
              className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs"
            >
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <MapPin className="size-5" aria-hidden="true" />
                </div>
                <div>
                  <span className="block text-xs font-bold uppercase tracking-wider text-primary">
                    {M.receiptStep}
                  </span>
                  <h2 className="m-0 text-base font-bold text-slate-900">{M.receiptTitle}</h2>
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-600">{M.receiptHint}</p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-xs font-semibold text-slate-800">
                  {M.receiptTime}
                  <input
                    type="datetime-local"
                    value={receiptAt}
                    onChange={(event) => setReceiptAt(event.target.value)}
                    className="h-11 rounded-xl border border-slate-300 bg-white px-3 font-normal text-slate-900 shadow-2xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </label>

                <label className="grid gap-1.5 text-xs font-semibold text-slate-800">
                  {M.receiptReason}
                  <input
                    value={receiptReason}
                    onChange={(event) => setReceiptReason(event.target.value)}
                    placeholder="Ghi chú tiếp nhận bàn giao kho"
                    className="h-11 rounded-xl border border-slate-300 bg-white px-3 font-normal text-slate-900 shadow-2xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </label>
              </div>

              <div className="mt-5 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                <Button
                  variant="primary"
                  type="button"
                  disabled={!receiptAt || !receiptReason.trim() || record.isPending}
                  loading={record.isPending}
                  onClick={() =>
                    record.mutate({
                      expectedVersion: request.version,
                      actualReturnAt: facilityTimeToIso(receiptAt, request.timezone),
                      reason: receiptReason.trim(),
                    })
                  }
                >
                  {record.isPending ? M.saving : M.confirmReceipt}
                </Button>
              </div>

              {record.isError && (
                <p role="alert" className="mt-3 text-xs text-rose-600">
                  {M.stale}
                </p>
              )}
            </div>
          ) : null}

          {/* Card 3: Active Checklist Inspection Workspace (if DRAFT) */}
          {showChecklist && (
            <div id="inspection-checklist">
              <ReturnInspectionWorkspace
                requestId={request.id}
                facilityId={facility.facilityId}
                inspection={latestInspection}
                timezone={request.timezone}
                requestVersion={request.version}
              />
            </div>
          )}

          <ReturnInspectionReview detail={query.data} staff={isStaff} />
          <ReturnTimeChanges detail={query.data} staff={isStaff} />
          {(!isStaff || query.data.settlements.length > 0) && (
            <ReturnFinancePanel detail={query.data} manager={!isStaff} stale={query.isError} />
          )}

          {/* Card 5: Activity Log / Audit Trail */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
              <Clock className="size-5 text-primary" aria-hidden="true" />
              <h2 className="m-0 text-base font-bold text-slate-900">{M.activityTitle}</h2>
            </div>

            {audit.length === 0 ? (
              <p className="mt-4 text-xs text-slate-500">{M.noActivity}</p>
            ) : (
              <div className="relative mt-5 border-l-2 border-slate-200 pl-4 space-y-4">
                {audit.map((item) => (
                  <div key={item.id} className="relative">
                    <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-primary ring-4 ring-white" />
                    <strong className="block text-xs font-semibold text-slate-900">
                      {returnAuditLabel(item.action)}
                    </strong>
                    <small className="block text-xs text-slate-500">
                      {formatDateTime(item.createdAt, request.timezone)}
                    </small>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ==================== RIGHT COLUMN (Context Sidebar: 5 cols) ==================== */}
        <div className={`space-y-6 ${isStaff ? "row-start-1" : "lg:col-span-5"}`}>
          {/* Sidebar Card 1: Request Summary */}
          {query.data.context && (
            <ReturnOperationalContext context={query.data.context} timezone={request.timezone} />
          )}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2.5">
                <CalendarClock className="size-5 text-primary" aria-hidden="true" />
                <h3 className="m-0 text-sm font-bold text-slate-900">{M.requestSummary}</h3>
              </div>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-700">
                …{shortId}
              </span>
            </div>

            {/* Schedule Section */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
              <div className="flex items-center gap-2 text-xs text-slate-600 mb-1">
                <Calendar className="size-3.5 text-primary" aria-hidden="true" />
                <span>{M.requestSchedule}</span>
              </div>
              <strong className="block text-xs font-semibold text-slate-900">
                {formatDateTime(request.startsAt, request.timezone)}
              </strong>
              <small className="mt-0.5 block text-xs text-slate-500">{M.timezoneLocal}</small>
            </div>

            {/* Assigned Staff Section */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-600 mb-1">
                  <UserCheck className="size-3.5 text-primary" aria-hidden="true" />
                  <span>{M.assignedStaffLabel}</span>
                </div>
              </div>

              <div className="mt-1">
                {isStaff ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/60 rounded-md px-2.5 py-1">
                    <UserCheck className="size-3.5 text-emerald-600" />
                    {M.assignedToYou}
                  </span>
                ) : assignedStaffName ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/60 rounded-md px-2.5 py-1">
                    <UserCheck className="size-3.5 text-emerald-600" />
                    {assignedStaffName}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200/60 rounded-md px-2.5 py-1">
                    <UserX className="size-3.5 text-amber-500" />
                    {M.notAssigned}
                  </span>
                )}
              </div>

              {canChangeAssignment && (
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(true)}
                  className="mt-3 inline-flex w-full min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-primary/25 bg-white px-3 text-xs font-semibold text-primary shadow-2xs transition-all hover:border-primary hover:bg-primary/5 active:scale-[0.98]"
                >
                  <UserCog className="size-3.5" aria-hidden="true" />
                  <span>{request.assignedStaffId ? M.changeStaff : M.assignStaff}</span>
                </button>
              )}
            </div>

            {/* Customer Reason Note */}
            {request.reason && (
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 text-xs text-slate-700">
                <span className="text-slate-600 block text-xs font-medium mb-1">
                  {M.requestReasonLabel}
                </span>
                <p className="m-0 whitespace-pre-wrap">{request.reason}</p>
              </div>
            )}
          </div>

          {/* Sidebar Card 3: Collapsible Details (Evidence, Time Changes, Technical) */}
          <div className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
            <button
              type="button"
              onClick={() => setMoreInfoOpen(!moreInfoOpen)}
              className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-slate-50"
            >
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-primary" aria-hidden="true" />
                <span className="text-xs font-bold text-slate-900">{M.moreInfo}</span>
              </div>
              {moreInfoOpen ? (
                <ChevronUp className="size-4 text-slate-400" />
              ) : (
                <ChevronDown className="size-4 text-slate-400" />
              )}
            </button>

            {moreInfoOpen && (
              <div className="border-t border-slate-100 p-4 space-y-4 text-xs">
                {/* Evidence Section */}
                <div>
                  <strong className="block font-semibold text-slate-800 mb-1.5">
                    {M.evidenceCount} ({evidence.length})
                  </strong>
                  {evidence.length === 0 ? (
                    <p className="text-slate-500 m-0">{M.noEvidence}</p>
                  ) : (
                    <ul className="m-0 pl-4 space-y-1 text-slate-700">
                      {evidence.map((item) => (
                        <li key={item.id} className="break-all">
                          <ReturnPrivatePhoto
                            requestId={request.id}
                            photoId={item.id}
                            filename={item.filename}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Time Changes Section */}
                <div className="border-t border-slate-100 pt-3">
                  <strong className="block font-semibold text-slate-800 mb-1.5">
                    {M.timeChangesTitle} ({timeChanges.length})
                  </strong>
                  {timeChanges.length === 0 ? (
                    <p className="text-slate-500 m-0">{M.noTimeChanges}</p>
                  ) : (
                    <ul className="m-0 pl-4 space-y-2 text-slate-700">
                      {timeChanges.map((change) => (
                        <li key={change.id}>
                          <strong>{returnTimeChangeStatusLabel(change.status)}</strong>
                          <span className="ml-1 text-slate-500">
                            {formatDateTime(change.proposedAt, request.timezone)}
                          </span>
                          {change.reason && <p className="m-0 text-slate-600">{change.reason}</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Technical IDs */}
                <div className="border-t border-slate-100 pt-3 space-y-2 font-mono text-[11px] text-slate-600">
                  <div>
                    <span className="font-sans text-slate-600 block">{M.fullRequestId}:</span>
                    <span className="break-all">{request.id}</span>
                  </div>
                  <div>
                    <span className="font-sans text-slate-600 block">{M.rentalReference}:</span>
                    <span className="break-all">{request.rentalId}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pop-out Assignment Modal */}
      {assignModalOpen && (
        <ReturnStaffAssignModal
          request={request}
          facilityId={facilityId}
          assignedStaffName={assignedStaffName}
          staffList={staffList}
          isLoadingStaff={staffQuery.isLoading}
          isStaffError={staffQuery.isError}
          onClose={() => setAssignModalOpen(false)}
        />
      )}
    </div>
  );
}
