"use client";

import { FacilityTaskReferenceType } from "@metastorage/contracts";
import { formatReference } from "@metastorage/shared";
import { useQuery } from "@tanstack/react-query";
import { Eye, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CustomerTable } from "@/components/ui/customer-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { Select } from "@/components/ui/form-controls";
import { OperationalBadge } from "@/components/ui/operational";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { isMockMode } from "@/config/api-mode";
import { api } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/format";
import { managementError, useFacilityOptions, useFacilityTaskList, useTaskStaff } from "./hooks";
import { F5 } from "./management.messages";
import type { TaskPanelProps } from "./management.types";
import { ManagementField, PageControls, panelClass } from "./management-ui";
import { TASK_ASSIGNMENT_MESSAGES as M } from "./task-assignment.messages";
import { TaskAssignmentForm } from "./task-assignment-form";

function taskReference(type: string, id: string) {
  const prefixes: Record<string, string> = {
    APPOINTMENT: "LH",
    STORAGE_UNIT: "OK",
    BOOKING: "BK",
    SUPPORT_TICKET: "YC",
  };
  const prefix = prefixes[type] ?? "CV";
  return formatReference(id, prefix);
}

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
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const staff = useTaskStaff(facilityId, manager);
  const query = useFacilityTaskList({
    limit: 20,
    offset,
    ...(staffId ? { assignedStaffId: staffId } : {}),
  });
  const selectedTask = query.data?.items.find((task) => task.id === selectedTaskId) ?? null;
  const appointmentId =
    selectedTask?.referenceType === FacilityTaskReferenceType.APPOINTMENT
      ? selectedTask.referenceId
      : "";
  const unitId =
    selectedTask?.referenceType === FacilityTaskReferenceType.STORAGE_UNIT
      ? selectedTask.referenceId
      : "";
  const appointment = useQuery({
    queryKey: ["facility-task-related-appointment", facilityId, appointmentId],
    queryFn: () => api.appointments.get(appointmentId),
    enabled: Boolean(appointmentId),
  });
  const unit = useQuery({
    queryKey: ["facility-task-related-unit", facilityId, unitId],
    queryFn: () => api.flow5.units.get(unitId),
    enabled: Boolean(unitId),
  });
  const rentalId = appointment.data?.rentalId ?? "";
  const rental = useQuery({
    queryKey: ["facility-task-related-rental", facilityId, rentalId],
    queryFn: () => api.rentals.facilityDetail(facilityId, rentalId),
    enabled: Boolean(rentalId),
  });
  if (query.isPending) return <LoadingState variant="table" />;
  if (query.isError)
    return <ErrorState message={managementError(query.error)} onRetry={() => query.refetch()} />;
  return (
    <div className="grid gap-5">
      {manager && (
        <div className="flex justify-end">
          <Button
            icon={<Plus className="size-4" aria-hidden="true" />}
            onClick={() => setCreateOpen(true)}
          >
            {M.createTaskButton}
          </Button>
        </div>
      )}
      {manager && (
        <ManagementField label={M.staffFilter}>
          <Select
            value={staffId}
            onChange={(e) => {
              setStaffId(e.target.value);
              setOffset(0);
              setSelectedTaskId(null);
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
        <CustomerTable title={M.tableTitle} headings={M.tableHeadings} minWidth="min-w-[900px]">
          {query.data.items.map((task) => (
            <tr key={task.id}>
              <td>
                <span className="font-semibold text-ink">
                  {task.description || M.noDescription}
                </span>
                <span className="mt-1 block font-mono text-xs text-muted">
                  {M.taskCode}: {formatReference(task.id, "CV")}
                </span>
              </td>
              <td>{M.taskTypes[task.type]}</td>
              <td>{task.assignedStaffName}</td>
              <td>
                <OperationalBadge value={task.status} label={M.taskStatuses[task.status]} />
              </td>
              <td>
                <span>{M.referenceTypes[task.referenceType]}</span>
                <span className="mt-1 block font-mono text-xs text-muted">
                  {taskReference(task.referenceType, task.referenceId)}
                </span>
              </td>
              <td>
                <Button
                  variant="outline"
                  className="min-h-10 px-3 text-xs"
                  icon={<Eye className="size-4" aria-hidden="true" />}
                  onClick={() => setSelectedTaskId(task.id)}
                >
                  {M.viewDetails}
                </Button>
              </td>
            </tr>
          ))}
        </CustomerTable>
      )}
      <PageControls
        label={F5.tasks}
        offset={offset}
        count={query.data.items.length}
        total={query.data.total}
        onChange={(nextOffset) => {
          setOffset(nextOffset);
          setSelectedTaskId(null);
        }}
        pending={query.isFetching}
      />
      <Sheet open={Boolean(selectedTask)} onOpenChange={(open) => !open && setSelectedTaskId(null)}>
        <SheetContent className="w-full max-w-xl p-5 sm:p-7">
          {selectedTask && (
            <>
              <SheetHeader className="pr-12">
                <SheetTitle>{M.detailTitle}</SheetTitle>
                <OperationalBadge
                  value={selectedTask.status}
                  label={M.taskStatuses[selectedTask.status]}
                />
              </SheetHeader>
              <section className="grid gap-3 rounded-xl border border-line bg-canvas p-4 text-sm sm:grid-cols-2">
                <DetailValue label={F5.taskType} value={M.taskTypes[selectedTask.type]} />
                <div className="grid gap-1">
                  <span className="text-xs text-muted">{F5.status}</span>
                  <OperationalBadge
                    value={selectedTask.status}
                    label={M.taskStatuses[selectedTask.status]}
                  />
                </div>
                <DetailValue label={M.taskCode} value={formatReference(selectedTask.id, "CV")} />
                <DetailValue label={F5.staff} value={selectedTask.assignedStaffName} />
                <DetailValue label={M.assignedBy} value={selectedTask.assignerName} />
                <DetailValue label={M.assignedAt} value={formatDateTime(selectedTask.assignedAt)} />
                <DetailValue
                  label={M.startedAt}
                  value={selectedTask.startedAt ? formatDateTime(selectedTask.startedAt) : "—"}
                />
                <DetailValue
                  label={M.completedAt}
                  value={selectedTask.completedAt ? formatDateTime(selectedTask.completedAt) : "—"}
                />
                <DetailValue label={M.createdAt} value={formatDateTime(selectedTask.createdAt)} />
                <DetailValue
                  label={M.referenceType}
                  value={M.referenceTypes[selectedTask.referenceType]}
                />
                <DetailValue
                  label={M.referenceId}
                  value={taskReference(selectedTask.referenceType, selectedTask.referenceId)}
                />
                <div className="grid gap-1 sm:col-span-2">
                  <span className="text-xs text-muted">{M.description}</span>
                  <p className="font-medium text-ink">
                    {selectedTask.description || M.noDescription}
                  </p>
                </div>
              </section>
              <section className="grid gap-3 rounded-xl border border-line p-4 text-sm">
                <h3 className="font-semibold text-ink">{M.relatedInfo}</h3>
                {selectedTask.referenceType === FacilityTaskReferenceType.APPOINTMENT &&
                  (appointment.isPending ? (
                    <LoadingState variant="detail" />
                  ) : appointment.isError ? (
                    <ErrorState
                      message={M.loadRelatedError}
                      onRetry={() => appointment.refetch()}
                    />
                  ) : appointment.data ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <DetailValue
                        label={M.appointmentType}
                        value={
                          M.appointmentTypes[appointment.data.appointmentType] ??
                          appointment.data.appointmentType
                        }
                      />
                      <DetailValue
                        label={M.customer}
                        value={appointment.data.customerName ?? "—"}
                      />
                      <DetailValue
                        label={M.appointmentSchedule}
                        value={`${formatDate(appointment.data.scheduledDate)} · ${appointment.data.slotStart?.slice(0, 5) ?? "—"}–${appointment.data.slotEnd?.slice(0, 5) ?? "—"}`}
                      />
                      {appointment.data.unitType?.name && (
                        <DetailValue label={F5.unitType} value={appointment.data.unitType.name} />
                      )}
                      {rentalId &&
                        (rental.isPending ? (
                          <LoadingState variant="detail" />
                        ) : rental.isError ? (
                          <ErrorState
                            message={M.loadRelatedError}
                            onRetry={() => rental.refetch()}
                          />
                        ) : rental.data ? (
                          <>
                            <DetailValue
                              label={M.rentalRecord}
                              value={formatReference(
                                rental.data.bookingCode ?? rental.data.id,
                                "KT",
                              )}
                            />
                            <DetailValue
                              label={F5.unit}
                              value={`${rental.data.unit.code} · ${rental.data.unit.unitTypeName}`}
                            />
                            <Link
                              className="font-semibold text-primary underline underline-offset-2 sm:col-span-2"
                              href={`/facility-manager/rentals?rentalId=${encodeURIComponent(rentalId)}`}
                            >
                              {M.openRental}
                            </Link>
                          </>
                        ) : null)}
                    </div>
                  ) : null)}
                {selectedTask.referenceType === FacilityTaskReferenceType.STORAGE_UNIT &&
                  (unit.isPending ? (
                    <LoadingState variant="detail" />
                  ) : unit.isError ? (
                    <ErrorState message={M.loadRelatedError} onRetry={() => unit.refetch()} />
                  ) : unit.data ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <DetailValue label={F5.unit} value={unit.data.code} />
                      <DetailValue label={M.unitStatus} value={unit.data.status} />
                      <DetailValue
                        label={M.unitLocation}
                        value={
                          [unit.data.floor, unit.data.locationDescription]
                            .filter(Boolean)
                            .join(" · ") || "—"
                        }
                      />
                    </div>
                  ) : null)}
                {selectedTask.referenceType !== FacilityTaskReferenceType.APPOINTMENT &&
                  selectedTask.referenceType !== FacilityTaskReferenceType.STORAGE_UNIT && (
                    <DetailValue
                      label={M.referenceId}
                      value={taskReference(selectedTask.referenceType, selectedTask.referenceId)}
                    />
                  )}
              </section>
            </>
          )}
        </SheetContent>
      </Sheet>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader className="pr-10">
            <DialogTitle>{M.createTaskButton}</DialogTitle>
            <p className="text-sm text-muted">{M.hint}</p>
          </DialogHeader>
          <TaskAssignmentForm
            key={facilityId}
            facilityId={facilityId}
            hideHeading
            onCreated={() => setCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 gap-1">
      <span className="text-xs text-muted">{label}</span>
      <span className="break-words font-medium text-ink">{value}</span>
    </div>
  );
}
