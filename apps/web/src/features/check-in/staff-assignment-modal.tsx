"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  type AssignBookingStaffInput,
  AssignBookingStaffInputSchema,
} from "@metastorage/contracts";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { flowError } from "@/features/facility-flow/use-check-in-flow";
import { useAssignStaffMutation, useFacilityStaff } from "./hooks";
import { STAFF_ASSIGNMENT_MESSAGES as M } from "./staff-assignment.messages";
import type { StaffAssignmentModalProps } from "./staff-assignment-modal.types";

export function StaffAssignmentModal({ booking, isOpen, onClose }: StaffAssignmentModalProps) {
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
      showToast(flowError(cause), "error");
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{M.title}</DialogTitle>
          <p className="mt-1 text-sm text-[#404945]">
            {booking.bookingCode} · {booking.contactName}
          </p>
          <p className="text-xs text-[#404945]">{booking.facilityName}</p>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} className="mt-5 space-y-5">
          {staff.isLoading ? (
            <LoadingState label={M.loading} variant="table" />
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
      </DialogContent>
    </Dialog>
  );
}
