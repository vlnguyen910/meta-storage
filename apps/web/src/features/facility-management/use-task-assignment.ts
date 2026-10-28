"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  type CreateFacilityTaskInput,
  CreateFacilityTaskSchema,
  FacilityTaskReferenceType,
  FacilityTaskType,
} from "@metastorage/contracts";
import { useForm } from "react-hook-form";
import type { DropdownOption } from "@/components/ui/dropdown-select.types";
import { formatDateTime } from "@/lib/format";
import { useCreateTask, useTaskBookingOptions, useTaskStaff, useTaskUnitOptions } from "./hooks";
import { F5 } from "./management.messages";
import { TASK_ASSIGNMENT_MESSAGES as M } from "./task-assignment.messages";

export function useTaskAssignment(facilityId: string) {
  const create = useCreateTask();
  const form = useForm<CreateFacilityTaskInput>({
    resolver: zodResolver(CreateFacilityTaskSchema),
    defaultValues: {
      facilityId,
      assignedStaffId: "",
      type: FacilityTaskType.UNIT_INSPECTION,
      referenceType: FacilityTaskReferenceType.STORAGE_UNIT,
      referenceId: "",
      description: "",
    },
  });
  const referenceType = form.watch("referenceType");
  const referenceId = form.watch("referenceId");
  const assignedStaffId = form.watch("assignedStaffId");
  const isBooking = referenceType === FacilityTaskReferenceType.BOOKING;
  const staff = useTaskStaff(facilityId);
  const bookings = useTaskBookingOptions(facilityId, isBooking);
  const units = useTaskUnitOptions(facilityId, !isBooking);
  const referenceQuery = isBooking ? bookings : units;
  const staffOptions = (staff.data ?? [])
    .filter((person) => person.isActive)
    .map((person) => ({ value: person.id, label: `${person.name} · ${person.email}` }));
  const referenceOptions: DropdownOption[] = isBooking
    ? (bookings.data ?? [])
        .filter((booking) => booking.facilityId === facilityId)
        .map((booking) => ({
          value: booking.id,
          label: `${booking.bookingCode} · ${booking.contactName} · ${booking.assignedUnit?.physicalUnitCode ?? M.noUnit} · ${formatDateTime(booking.checkInSlotStart)}`,
          badge: M.bookingStatuses[booking.status],
        }))
    : (units.data ?? [])
        .filter((unit) => unit.facilityId === facilityId)
        .map((unit) => ({
          value: unit.id,
          label: `${unit.code} · ${unit.unitTypeName} · ${unit.unitTypeSizeLabel}`,
          badge: F5.statuses[unit.status],
        }));
  const staffSelected = staffOptions.some((option) => option.value === assignedStaffId);
  const referenceSelected = referenceOptions.some((option) => option.value === referenceId);
  const unavailable =
    staff.isPending || staff.isError || referenceQuery.isPending || referenceQuery.isError;

  const submit = form.handleSubmit((input) => {
    if (!staffSelected) {
      form.setError("assignedStaffId", { message: M.staffRequired });
      return;
    }
    if (!referenceSelected || unavailable) {
      form.setError("referenceId", { message: M.referenceRequired });
      return;
    }
    create.mutate(
      {
        ...input,
        facilityId,
        type: FacilityTaskType.UNIT_INSPECTION,
        description: input.description?.trim() || undefined,
      },
      {
        onSuccess: () => {
          form.reset({ ...input, referenceId: "", description: "" });
        },
      },
    );
  });

  return {
    form,
    create,
    staff,
    staffOptions,
    referenceQuery,
    referenceOptions,
    referenceType,
    referenceId,
    assignedStaffId,
    isBooking,
    submit,
    canSubmit: !unavailable && staffSelected && referenceSelected && !create.isPending,
    selectReferenceType: (value: FacilityTaskReferenceType) => {
      form.setValue("referenceType", value);
      form.setValue("referenceId", "");
      form.clearErrors("referenceId");
      create.reset();
    },
  };
}
