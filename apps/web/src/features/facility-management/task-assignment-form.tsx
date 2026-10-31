"use client";

import { FacilityTaskReferenceType, FacilityTaskType } from "@metastorage/contracts";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { Select } from "@/components/ui/form-controls";
import { managementError } from "./hooks";
import { F5 } from "./management.messages";
import { ManagementField, panelClass, textareaClass } from "./management-ui";
import { TASK_ASSIGNMENT_MESSAGES as M } from "./task-assignment.messages";
import { useTaskAssignment } from "./use-task-assignment";

export function TaskAssignmentForm({
  facilityId,
  hideHeading = false,
  onCreated,
}: {
  facilityId: string;
  hideHeading?: boolean;
  onCreated?: () => void;
}) {
  const work = useTaskAssignment(facilityId, onCreated);
  const errors = work.form.formState.errors;
  const referenceLabel = M.unit;
  const loading = work.referenceQuery.isPending;
  return (
    <form onSubmit={work.submit} className={`${panelClass} grid gap-5`}>
      {!hideHeading && (
        <header>
          <h2 className="text-lg font-bold text-slate-900">{M.title}</h2>
          <p className="mt-1 text-sm text-slate-600">{M.hint}</p>
        </header>
      )}
      <fieldset disabled={work.create.isPending} className="grid min-w-0 gap-4 sm:grid-cols-2">
        <ManagementField label={F5.staff} error={errors.assignedStaffId && M.staffRequired}>
          <DropdownSelect
            ariaLabel={F5.staff}
            value={work.assignedStaffId}
            onChange={(value) =>
              work.form.setValue("assignedStaffId", value, { shouldValidate: true })
            }
            options={work.staffOptions}
            placeholder={work.staff.isPending ? M.loading : M.chooseStaff}
            disabled={work.staff.isPending || work.staff.isError || !work.staffOptions.length}
            className="w-full min-w-0"
            triggerClassName="min-h-11 h-auto w-full bg-white py-2.5 text-sm text-left"
            dropdownClassName="w-full max-w-full"
          />
        </ManagementField>
        <ManagementField label={F5.taskType}>
          <Select value={FacilityTaskType.UNIT_INSPECTION} disabled>
            <option value={FacilityTaskType.UNIT_INSPECTION}>{M.taskTypes.UNIT_INSPECTION}</option>
          </Select>
        </ManagementField>
        <ManagementField label={M.referenceType}>
          <Select
            value={work.referenceType}
            onChange={(event) =>
              work.selectReferenceType(event.target.value as FacilityTaskReferenceType)
            }
          >
            <option value={FacilityTaskReferenceType.STORAGE_UNIT}>{F5.unit}</option>
          </Select>
        </ManagementField>
        <div className="min-w-0">
          <ManagementField label={referenceLabel} error={errors.referenceId && M.referenceRequired}>
            <DropdownSelect
              key={work.referenceType}
              ariaLabel={referenceLabel}
              value={work.referenceId}
              onChange={(value) =>
                work.form.setValue("referenceId", value, { shouldValidate: true })
              }
              options={work.referenceOptions}
              placeholder={loading ? M.loading : M.chooseUnit}
              disabled={loading || work.referenceQuery.isError || !work.referenceOptions.length}
              className="w-full min-w-0"
              triggerClassName="min-h-11 h-auto w-full bg-white py-2.5 text-sm text-left [&_span.truncate]:whitespace-normal"
              dropdownClassName="w-full max-w-full [&_span.truncate]:whitespace-normal"
            />
          </ManagementField>
        </div>
        {work.staff.isError && (
          <div role="alert" className="sm:col-span-2">
            <p className="text-sm text-danger">{M.staffError}</p>
            <Button type="button" variant="outline" onClick={() => void work.staff.refetch()}>
              {F5.retry}
            </Button>
          </div>
        )}
        {work.staff.isSuccess && !work.staffOptions.length && (
          <p role="status" className="text-sm text-slate-600 sm:col-span-2">
            {M.noStaff}
          </p>
        )}
        {work.referenceQuery.isError && (
          <div role="alert" className="sm:col-span-2">
            <p className="text-sm text-danger">{M.referenceError}</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => void work.referenceQuery.refetch()}
            >
              {F5.retry}
            </Button>
          </div>
        )}
        {work.referenceQuery.isSuccess && !work.referenceOptions.length && (
          <p role="status" className="text-sm text-slate-600 sm:col-span-2">
            {M.noUnits}
          </p>
        )}
        <div className="sm:col-span-2">
          <ManagementField label={M.description} error={errors.description && M.descriptionLimit}>
            <textarea
              {...work.form.register("description")}
              maxLength={2000}
              placeholder={M.descriptionPlaceholder}
              className={textareaClass}
            />
          </ManagementField>
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={!work.canSubmit} loading={work.create.isPending}>
          {F5.createTask}
        </Button>
        {work.create.isSuccess && (
          <p role="status" className="text-sm font-medium text-emerald-700">
            {F5.taskCreated}
          </p>
        )}
        {work.create.isError && (
          <p role="alert" className="text-sm text-danger">
            {managementError(work.create.error)}
          </p>
        )}
      </div>
      <div className="space-y-1 border-t border-slate-100 pt-4 text-sm text-slate-600">
        <p>
          {M.handoverHint}{" "}
          <Link
            href="/facility-manager/tasks?view=appointments"
            className="font-semibold text-primary underline underline-offset-2"
          >
            {M.handoverLink}
          </Link>
          .
        </p>
        <p>{M.supportUnavailable}</p>
      </div>
    </form>
  );
}
