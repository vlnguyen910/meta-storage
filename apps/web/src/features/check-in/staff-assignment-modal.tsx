"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  type AssignBookingStaffInput,
  AssignBookingStaffInputSchema,
} from "@metastorage/contracts";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { flowError } from "@/features/facility-flow/use-check-in-flow";
import { useAssignStaffMutation, useFacilityStaff } from "./hooks";
import { STAFF_ASSIGNMENT_MESSAGES as M } from "./staff-assignment.messages";
import type { StaffAssignmentModalProps } from "./staff-assignment-modal.types";

export function StaffAssignmentModal({ booking, isOpen, onClose }: StaffAssignmentModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");
  const { showToast } = useToast();
  const staff = useFacilityStaff(booking.facilityId);
  const mutation = useAssignStaffMutation();
  const form = useForm<AssignBookingStaffInput>({
    resolver: zodResolver(AssignBookingStaffInputSchema),
    defaultValues: { staffId: booking.assignedStaff?.id ?? "" },
  });
  const selected = form.watch("staffId");
  const activeStaff = staff.data?.filter((member) => member.isActive) ?? [];
  const busy = mutation.isPending || form.formState.isSubmitting;

  useEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement;
    if (isOpen) element?.showModal();
    else element?.close();
    return () => {
      element?.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, [isOpen]);

  async function submit(input: AssignBookingStaffInput) {
    if (mutation.isPending || !activeStaff.some((member) => member.id === input.staffId)) return;
    setError("");
    try {
      await mutation.mutateAsync({ bookingId: booking.id, input: { staffId: input.staffId } });
      const member = activeStaff.find((item) => item.id === input.staffId);
      showToast(M.success(member?.name ?? M.staff, booking.bookingCode), "success");
      onClose();
    } catch (cause) {
      setError(flowError(cause));
    }
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="staff-assignment-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-line bg-surface p-6 text-ink shadow-2xl backdrop:bg-black/50"
    >
      <h2 id="staff-assignment-title" className="text-xl font-bold">
        {M.title}
      </h2>
      <p className="mt-2 text-sm text-[#404945]">
        {booking.bookingCode} · {booking.contactName}
      </p>
      <p className="mt-1 text-sm text-[#404945]">{booking.facilityName}</p>
      <form onSubmit={form.handleSubmit(submit)} className="mt-5 space-y-5">
        {staff.isLoading ? (
          <LoadingState label={M.loading} />
        ) : staff.isError ? (
          <ErrorState message={M.loadError} onRetry={() => staff.refetch()} />
        ) : activeStaff.length === 0 ? (
          <p role="status">{M.empty}</p>
        ) : (
          <fieldset disabled={busy} className="space-y-2">
            <legend className="mb-2 text-sm font-semibold">{M.choose}</legend>
            {activeStaff.map((member) => (
              <label
                key={member.id}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 focus-within:ring-2 focus-within:ring-primary"
              >
                <input
                  type="radio"
                  value={member.id}
                  {...form.register("staffId")}
                  className="mt-1"
                />
                <span className="min-w-0">
                  <strong className="block">{member.name}</strong>
                  {member.assignedTasksCount != null && (
                    <span className="block text-xs text-[#404945]">
                      {M.taskCount(member.assignedTasksCount)}
                    </span>
                  )}
                  <span className="block break-all text-xs text-[#404945]">{member.email}</span>
                  {member.phone && (
                    <span className="block text-xs text-[#404945]">{member.phone}</span>
                  )}
                </span>
              </label>
            ))}
          </fieldset>
        )}
        {form.formState.errors.staffId && (
          <p role="alert" className="text-sm text-danger">
            {M.invalidStaff}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3 border-t border-line pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            {M.cancel}
          </Button>
          <Button
            type="submit"
            loading={busy}
            disabled={staff.isError || !activeStaff.some((member) => member.id === selected)}
          >
            {M.confirm}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
