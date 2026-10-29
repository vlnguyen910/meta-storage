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
import { useCreateTask, useTaskStaff, useTaskUnitOptions } from "./hooks";
import { F5 } from "./management.messages";
import { TASK_ASSIGNMENT_MESSAGES as M } from "./task-assignment.messages";

export function useTaskAssignment(facilityId: string, onCreated?: () => void) {
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
  const staff = useTaskStaff(facilityId);
  const units = useTaskUnitOptions(facilityId, true);
  const referenceQuery = units;
  const staffOptions = (staff.data ?? [])
    .filter((person) => person.isActive)
    .map((person) => ({ value: person.id, label: `${person.name} · ${person.email}` }));
  const referenceOptions: DropdownOption[] = (units.data ?? [])
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
          onCreated?.();
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
