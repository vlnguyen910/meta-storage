"use client";

import type { FacilityTaskDetail } from "@metastorage/contracts";
import { FacilityTaskReferenceType } from "@metastorage/contracts";
import { formatReference } from "@metastorage/shared";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Eye, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CustomerTable } from "@/components/ui/customer-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { OperationalBadge } from "@/components/ui/operational";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { InspectionPhotoCard } from "@/features/facility-flow/inspection-screen";
import { api } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/format";
import { managementError, useFacilityTaskList, useTaskStaff } from "./hooks";
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

function taskTypeLabel(task: Pick<FacilityTaskDetail, "type" | "referenceType">) {
  if (
    task.type === "UNIT_INSPECTION" &&
    task.referenceType === FacilityTaskReferenceType.APPOINTMENT
  )
    return M.taskTypes.RETURN_INSPECTION;
  return M.taskTypes[task.type];
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
  const inspections = useQuery({
    queryKey: ["facility-task-related-inspections", facilityId, appointmentId],
    queryFn: () => api.inspections.forAppointment(appointmentId),
    enabled: Boolean(appointmentId),
  });
  const inspectionRecord =
    inspections.data?.find((i) => i.taskId === selectedTask?.id) ?? inspections.data?.[0];
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
          <DropdownSelect
            ariaLabel={M.staffFilter}
            value={staffId}
            onChange={(val) => {
              setStaffId(val);
              setOffset(0);
              setSelectedTaskId(null);
            }}
            options={[
              { value: "", label: F5.all },
              ...(staff.data?.map((s) => ({ value: s.id, label: s.name })) ?? []),
            ]}
            className="w-full"
            triggerClassName="min-h-11 h-auto w-full bg-white py-2.5 text-sm text-left"
          />
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
              <td>{taskTypeLabel(task)}</td>
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
      <Dialog
        open={Boolean(selectedTask)}
        onOpenChange={(open) => !open && setSelectedTaskId(null)}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto p-5 sm:max-w-2xl sm:p-7">
          {selectedTask && (
            <>
              <DialogHeader className="pr-12">
                <DialogTitle>{M.detailTitle}</DialogTitle>
                <OperationalBadge
                  value={selectedTask.status}
                  label={M.taskStatuses[selectedTask.status]}
                />
              </DialogHeader>
              <section className="grid gap-3 rounded-xl border border-line bg-canvas p-4 text-sm sm:grid-cols-2">
                <DetailValue label={F5.taskType} value={taskTypeLabel(selectedTask)} />
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
                        label={M.customer}
                        value={appointment.data.customerName ?? "—"}
                      />
                      <DetailValue
                        label={M.contactPhone}
                        value={appointment.data.contactPhone ?? "—"}
                      />
                      {appointment.data.customerEmail && (
                        <DetailValue
                          label={M.contactEmail}
                          value={appointment.data.customerEmail}
                        />
                      )}
                      <DetailValue
                        label={M.appointmentType}
                        value={
                          M.appointmentTypes[appointment.data.appointmentType] ??
                          appointment.data.appointmentType
                        }
                      />
                      <DetailValue
                        label={M.appointmentSchedule}
                        value={`${formatDate(appointment.data.scheduledDate)} · ${appointment.data.slotStart?.slice(0, 5) ?? "—"}–${appointment.data.slotEnd?.slice(0, 5) ?? "—"}`}
                      />
                      {appointment.data.assignedUnit?.physicalUnitCode && (
                        <DetailValue
                          label={M.assignedPhysicalUnit}
                          value={appointment.data.assignedUnit.physicalUnitCode}
                        />
                      )}
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
                      <Link
                        className="font-semibold text-primary inline-flex items-center gap-1.5 underline underline-offset-2 sm:col-span-2 mt-1 text-xs"
                        href={`/facility-manager/check-in?appointmentId=${encodeURIComponent(appointmentId)}`}
                      >
                        <span>{M.openCheckInFlow}</span>
                        <ExternalLink size={13} />
                      </Link>
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
              {selectedTask.referenceType === FacilityTaskReferenceType.APPOINTMENT &&
                (inspections.isPending ? (
                  <LoadingState variant="detail" />
                ) : inspectionRecord ? (
                  <section className="grid gap-3 rounded-xl border border-line bg-slate-50/50 p-4 text-sm">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-ink">{M.inspectionResult}</h3>
                      {inspectionRecord.status && (
                        <OperationalBadge
                          value={inspectionRecord.status}
                          label={
                            inspectionRecord.status === "PASSED"
                              ? "Đạt chuẩn"
                              : inspectionRecord.status === "FAILED"
                                ? "Không đạt"
                                : "Đang kiểm tra"
                          }
                        />
                      )}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {inspectionRecord.condition && (
                        <DetailValue
                          label={M.inspectionCondition}
                          value={
                            M.conditionLabels[inspectionRecord.condition] ??
                            inspectionRecord.condition
                          }
                        />
                      )}
                      {inspectionRecord.inspectDoneAt && (
                        <DetailValue
                          label={M.inspectDoneAt}
                          value={formatDateTime(inspectionRecord.inspectDoneAt)}
                        />
                      )}
                      {inspectionRecord.notes && (
                        <div className="sm:col-span-2">
                          <span className="text-xs text-muted block mb-1">{M.inspectionNotes}</span>
                          <p className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-800 whitespace-pre-wrap">
                            {inspectionRecord.notes}
                          </p>
                        </div>
                      )}
                    </div>
                    {inspectionRecord.evidence && inspectionRecord.evidence.length > 0 && (
                      <div className="pt-2 border-t border-slate-200/80">
                        <span className="text-xs font-semibold text-slate-700 block mb-2">
                          {M.inspectionEvidence} ({inspectionRecord.evidence.length})
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {inspectionRecord.evidence.map((photo) => (
                            <InspectionPhotoCard key={photo.id} photo={photo} />
                          ))}
                        </div>
                      </div>
                    )}
                  </section>
                ) : null)}
            </>
          )}
        </DialogContent>
      </Dialog>
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
