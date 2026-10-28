"use client";

import {
  FacilityTaskReferenceType,
  FacilityTaskStatus,
  FacilityTaskType,
} from "@metastorage/contracts";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { Input, Select } from "@/components/ui/form-controls";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { isMockMode } from "@/config/api-mode";
import { formatDateTime } from "@/lib/format";
import {
  managementError,
  useCreateTask,
  useFacilityOptions,
  useFacilityTaskList,
  useTaskStaff,
  useUpdateTask,
} from "./hooks";
import { F5 } from "./management.messages";
import type { TaskPanelProps } from "./management.types";
import { ManagementField, PageControls, panelClass } from "./management-ui";

const statuses = [
  FacilityTaskStatus.ASSIGNED,
  FacilityTaskStatus.IN_PROGRESS,
  FacilityTaskStatus.COMPLETED,
  FacilityTaskStatus.CANCELLED,
];
const typeLabels: Record<FacilityTaskType, string> = {
  CHECK_IN_HANDOVER: "Check-in handover",
  UNIT_INSPECTION: "Unit inspection",
  HANDLE_SUPPORT: "Handle support",
};
const statusLabels: Record<FacilityTaskStatus, string> = {
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export function TaskWorkspace({ manager }: { manager: boolean }) {
  const scope = useFacilityOptions();
  if (isMockMode) return <p role="status">{F5.noMock}</p>;
  if (scope.query.isPending) return <LoadingState variant="table" />;
  if (scope.query.isError)
    return <ErrorState message={F5.loadError} onRetry={() => scope.query.refetch()} />;
  if (!scope.query.data.length) return <p role="status">{F5.noFacility}</p>;
  return (
    <div className="grid gap-6">
      <h1 className="text-3xl font-bold">{F5.tasks}</h1>
      <ManagementField label={F5.facility}>
        <DropdownSelect
          value={scope.facilityId}
          onChange={scope.select}
          className="w-full"
          options={scope.query.data.map((f) => ({ value: f.id, label: `${f.code} · ${f.name}` }))}
        />
      </ManagementField>
      <TaskPanel key={scope.facilityId} facilityId={scope.facilityId} manager={manager} />
    </div>
  );
}

export function TaskPanel({ facilityId, manager }: TaskPanelProps) {
  const [offset, setOffset] = useState(0);
  const [staffId, setStaffId] = useState("");
  const staff = useTaskStaff(facilityId, manager);
  const query = useFacilityTaskList({
    limit: 20,
    offset,
    ...(staffId ? { assignedStaffId: staffId } : {}),
  });
  const create = useCreateTask();
  const [assignedStaffId, setAssignedStaffId] = useState("");
  const [type, setType] = useState<FacilityTaskType>(FacilityTaskType.UNIT_INSPECTION);
  const [referenceType, setReferenceType] = useState("STORAGE_UNIT");
  const [referenceId, setReferenceId] = useState("");
  if (query.isPending) return <LoadingState variant="table" />;
  if (query.isError)
    return <ErrorState message={managementError(query.error)} onRetry={() => query.refetch()} />;
  return (
    <div className="grid gap-5">
      {manager && (
        <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
          <ManagementField label={F5.staff}>
            <Select value={assignedStaffId} onChange={(e) => setAssignedStaffId(e.target.value)}>
              <option value="">{F5.choose}</option>
              {staff.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </ManagementField>
          <ManagementField label={F5.taskType}>
            <Select value={type} onChange={(e) => setType(e.target.value as FacilityTaskType)}>
              {Object.values(FacilityTaskType).map((t) => (
                <option key={t} value={t}>
                  {typeLabels[t]}
                </option>
              ))}
            </Select>
          </ManagementField>
          <ManagementField label="Reference type">
            <Select value={referenceType} onChange={(e) => setReferenceType(e.target.value)}>
              {Object.values(FacilityTaskReferenceType).map((v) => (
                <option key={v} value={v}>
                  {v.replaceAll("_", " ")}
                </option>
              ))}
            </Select>
          </ManagementField>
          <ManagementField label="Reference ID">
            <Input value={referenceId} onChange={(e) => setReferenceId(e.target.value)} />
          </ManagementField>
          <Button
            disabled={create.isPending || !assignedStaffId || !referenceId}
            onClick={() =>
              create.mutate({
                facilityId,
                assignedStaffId,
                type,
                referenceType: referenceType as FacilityTaskReferenceType,
                referenceId,
              })
            }
          >
            {F5.createTask}
          </Button>
          {create.isError && <p role="alert">{managementError(create.error)}</p>}
        </div>
      )}
      {manager && (
        <ManagementField label={F5.staff}>
          <Select
            value={staffId}
            onChange={(e) => {
              setStaffId(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">{F5.all}</option>
            {staff.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </ManagementField>
      )}
      {query.data.items.length === 0 ? (
        <p role="status" className={panelClass}>
          {F5.empty}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {query.data.items.map((task) => (
            <li key={task.id} className={`${panelClass} grid gap-2`}>
              <strong>{typeLabels[task.type]}</strong>
              <span>{task.description || task.referenceId}</span>
              <span>
                {task.assignedStaffName} · {formatDateTime(task.assignedAt)}
              </span>
              <TaskStatus taskId={task.id} status={task.status} />
            </li>
          ))}
        </ul>
      )}
      <PageControls
        label={F5.tasks}
        offset={offset}
        count={query.data.items.length}
        total={query.data.total}
        onChange={setOffset}
        pending={query.isFetching}
      />
    </div>
  );
}

function TaskStatus({ taskId, status }: { taskId: string; status: `${FacilityTaskStatus}` }) {
  const update = useUpdateTask(taskId);
  const options =
    status === FacilityTaskStatus.ASSIGNED
      ? statuses.slice(0, 1).concat(statuses.slice(1))
      : statuses;
  return (
    <Select
      aria-label="Task status"
      value={status}
      onChange={(event) => {
        const next = event.target.value as FacilityTaskStatus;
        if (next !== FacilityTaskStatus.ASSIGNED) update.mutate({ status: next });
      }}
      disabled={update.isPending}
    >
      {options.map((value) => (
        <option key={value} value={value}>
          {statusLabels[value]}
        </option>
      ))}
    </Select>
  );
}
