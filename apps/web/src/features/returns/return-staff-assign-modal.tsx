"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ManagementDialog } from "@/features/facility-management/management-ui";
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
    <ManagementDialog
      title={request.assignedStaffId ? M.changeStaff : M.assignStaff}
      onClose={onClose}
      pending={assignment.isPending}
    >
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
        <Button variant="outline" type="button" disabled={assignment.isPending} onClick={onClose}>
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
    </ManagementDialog>
  );
}
