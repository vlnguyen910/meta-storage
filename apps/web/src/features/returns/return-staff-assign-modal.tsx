"use client";

import { UserCheck, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { ReturnStaffAssignModalProps } from "./facility-return-queue.types";
import { useAssignReturnStaff } from "./hooks";
import { ReturnStatusBadge } from "./return-status-badge";
import { RETURNS_MESSAGES as M } from "./returns.messages";

export function ReturnStaffAssignModal({
  request,
  facilityId,
  assignedStaffName,
  staffList,
  isLoadingStaff,
  isStaffError,
  onClose,
}: ReturnStaffAssignModalProps) {
  const [staffId, setStaffId] = useState(request.assignedStaffId ?? "");
  const [reason, setReason] = useState("");
  const assignment = useAssignReturnStaff(request.id, facilityId);

  const formattedDate = new Date(request.startsAt).toLocaleString("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: request.timezone,
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`dialog-title-${request.id}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        id={`assignment-${request.id}`}
        className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-150"
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-line pb-4">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <UserCheck className="size-5" />
            </div>
            <div>
              <h2 id={`dialog-title-${request.id}`} className="m-0 text-lg font-bold text-ink">
                {request.assignedStaffId ? M.changeStaff : M.assignStaff}
              </h2>
              <p className="mb-0 mt-0.5 text-xs text-muted">
                {M.requestId}:{" "}
                <strong className="font-mono text-ink">…{request.id.slice(-8)}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label={M.cancelAssignment}
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Context Preview Strip */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs">
          <div>
            <span className="block text-muted">{M.schedule}</span>
            <span className="font-semibold text-slate-800">{formattedDate}</span>
          </div>
          <div>
            <span className="block text-muted">{M.status}</span>
            <ReturnStatusBadge status={request.status} />
          </div>
          {assignedStaffName && (
            <div>
              <span className="block text-muted">{M.assignedStaff}</span>
              <span className="font-semibold text-emerald-800">{assignedStaffName}</span>
            </div>
          )}
        </div>

        {/* Form Controls */}
        <div className="mt-4 space-y-4">
          <label className="grid gap-1.5 text-sm font-semibold text-slate-800">
            {M.chooseStaff}
            <select
              value={staffId}
              onChange={(event) => setStaffId(event.target.value)}
              className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 font-normal text-ink shadow-2xs focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
            >
              <option value="">{M.chooseStaff}</option>
              {staffList
                .filter((person) => person.isActive)
                .map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
            </select>
          </label>

          <label className="grid gap-1.5 text-sm font-semibold text-slate-800">
            {M.assignmentReason}
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={M.assignmentReasonPlaceholder}
              rows={3}
              className="rounded-xl border border-slate-300 bg-white p-3 font-normal text-ink shadow-2xs focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
            />
          </label>

          {isLoadingStaff && (
            <p role="status" className="m-0 flex items-center gap-2 text-sm text-slate-600">
              <Spinner variant="brand" size="sm" />
              {M.staffLoading}
            </p>
          )}
          {isStaffError && (
            <p role="alert" className="text-sm text-red-600">
              {M.staffLoadFailed}
            </p>
          )}
          {assignment.isError && (
            <p role="alert" className="text-sm text-red-600">
              {M.assignFailed}
            </p>
          )}
        </div>

        {/* Modal Footer */}
        <div className="mt-6 flex justify-end gap-3 border-t border-line pt-4">
          <Button variant="outline" type="button" onClick={onClose}>
            {M.cancelAssignment}
          </Button>
          <Button
            variant="primary"
            type="button"
            disabled={!staffId || !reason.trim() || assignment.isPending || isLoadingStaff}
            loading={assignment.isPending}
            onClick={() =>
              assignment.mutate(
                { expectedVersion: request.version, staffId, reason: reason.trim() },
                {
                  onSuccess: () => {
                    onClose();
                  },
                },
              )
            }
          >
            {assignment.isPending ? M.saving : M.assign}
          </Button>
        </div>
      </div>
    </div>
  );
}
