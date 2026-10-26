"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  type AssignFacilityTaskInput,
  AssignFacilityTaskSchema,
  type CreateFacilityTaskInput,
  type CreateFacilityTaskReportInput,
  CreateFacilityTaskReportSchema,
  CreateFacilityTaskSchema,
  type FacilityTaskDetail,
  FacilityTaskType,
} from "@metastorage/contracts";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form-controls";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { isMockMode } from "@/config/api-mode";
import { formatDateTime } from "@/lib/format";
import {
  managementError,
  useAcceptTaskReport,
  useAssignTask,
  useCreateTask,
  useFacilityOptions,
  useFacilityTaskDetail,
  useFacilityTaskList,
  useReportTask,
  useStartTask,
  useTaskReportHistory,
  useTaskStaff,
  useTaskUnitOptions,
} from "./hooks";
import { F5 } from "./management.messages";
import type { TaskPanelProps } from "./management.types";
import {
  ManagementDialog,
  ManagementField,
  PageControls,
  panelClass,
  textareaClass,
} from "./management-ui";
import { TASK_WORKSPACE_MESSAGES } from "./task-workspace.messages";

const TASK_STATUS_BADGE_CLASS: Record<FacilityTaskDetail["status"], string> = {
  ASSIGNED: "border-sky-200 bg-sky-50 text-sky-900",
  IN_PROGRESS: "border-blue-200 bg-blue-50 text-blue-900",
  AWAITING_APPROVAL: "border-amber-200 bg-amber-50 text-amber-950",
  COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-900",
};

export function TaskWorkspace({ manager }: { manager: boolean }) {
  const scope = useFacilityOptions();
  if (isMockMode) return <p role="status">{F5.noMock}</p>;
  if (scope.query.isPending) return <LoadingState variant="table" />;
  if (scope.query.isError)
    return <ErrorState message={F5.loadError} onRetry={() => scope.query.refetch()} />;
  return (
    <div className="grid gap-6">
      <header>
        <h1 className="text-3xl font-bold">{F5.tasks}</h1>
        <p className="mt-2 text-sm text-slate-600">{F5.taskLifecycleHint}</p>
      </header>
      {scope.query.data.length === 0 ? (
        <p role="status">{F5.noFacility}</p>
      ) : (
        <>
          <ManagementField label={F5.facility}>
            <Select value={scope.facilityId} onChange={(event) => scope.select(event.target.value)}>
              {scope.query.data.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} · {item.name}
                </option>
              ))}
            </Select>
          </ManagementField>
          <TaskPanel key={scope.facilityId} facilityId={scope.facilityId} manager={manager} />
        </>
      )}
    </div>
  );
}

function TaskPanel({ facilityId, manager }: TaskPanelProps) {
  const [offset, setOffset] = useState(0);
  const [type, setType] = useState<FacilityTaskType | "">("");
  const [staffId, setStaffId] = useState("");
  const [selected, select] = useState("");
  const [creating, setCreating] = useState(false);
  const staff = useTaskStaff(facilityId, manager);
  const query = useFacilityTaskList({
    facilityId,
    limit: 20,
    offset,
    ...(type ? { type } : {}),
    ...(manager && staffId ? { assignedStaffId: staffId } : {}),
  });
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <ManagementField label={F5.taskType}>
          <Select
            value={type}
            onChange={(event) => {
              setType(event.target.value as FacilityTaskType | "");
              setOffset(0);
            }}
          >
            <option value="">{F5.all}</option>
            {Object.values(FacilityTaskType).map((value) => (
              <option key={value} value={value}>
                {F5.typeLabels[value]}
              </option>
            ))}
          </Select>
        </ManagementField>
        {manager && (
          <ManagementField label={F5.staff}>
            <Select
              value={staffId}
              onChange={(event) => {
                setStaffId(event.target.value);
                setOffset(0);
              }}
            >
              <option value="">{F5.all}</option>
              {staff.data?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </ManagementField>
        )}
        <Button
          type="button"
          variant="outline"
          disabled={query.isFetching}
          onClick={() => query.refetch()}
        >
          {F5.refresh}
        </Button>
        {manager && (
          <Button type="button" onClick={() => setCreating(true)}>
            {F5.createTask}
          </Button>
        )}
      </div>
      {manager && staff.isError && (
        <ErrorState message={F5.loadError} onRetry={() => staff.refetch()} />
      )}
      {query.isPending ? (
        <LoadingState variant="table" />
      ) : query.isError ? (
        <ErrorState message={managementError(query.error)} onRetry={() => query.refetch()} />
      ) : (
        <>
          {query.data.items.length === 0 && (
            <p role="status" className={panelClass}>
              {F5.empty}
            </p>
          )}
          <ul className="grid gap-3 sm:grid-cols-2">
            {query.data.items.map((task) => (
              <li
                key={task.id}
                className={`${panelClass} flex min-h-48 flex-col gap-3 transition duration-150 hover:border-emerald-300 hover:shadow-md`}
              >
                <p className="inline-flex w-fit items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-900">
                  {F5.typeLabels[task.type]}
                </p>
                <h2 className="break-words text-lg font-extrabold tracking-tight text-ink">
                  {task.title}
                </h2>
                <p
                  className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-bold ${TASK_STATUS_BADGE_CLASS[task.status]}`}
                >
                  {F5.taskStatusLabels[task.status]}
                </p>
                <p className="text-sm text-slate-600">
                  {task.assignedStaffName} · {formatDateTime(task.assignedAt)}
                </p>
                <Button
                  type="button"
                  className="mt-auto w-full sm:w-auto"
                  onClick={() => select(task.id)}
                  aria-pressed={selected === task.id}
                >
                  {F5.detail}
                </Button>
              </li>
            ))}
          </ul>
          <PageControls
            label={F5.tasks}
            offset={offset}
            count={query.data.items.length}
            total={query.data.total}
            onChange={setOffset}
            pending={query.isFetching}
          />
        </>
      )}
      {selected && (
        <TaskDetails key={selected} id={selected} manager={manager} onClose={() => select("")} />
      )}
      {creating && (
        <TaskCreator
          facilityId={facilityId}
          onClose={() => setCreating(false)}
          onCreated={(task) => {
            setOffset(0);
            select(task.id);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

function TaskCreator({
  facilityId,
  onClose,
  onCreated,
}: {
  facilityId: string;
  onClose: () => void;
  onCreated: (task: FacilityTaskDetail) => void;
}) {
  const staff = useTaskStaff(facilityId);
  const units = useTaskUnitOptions(facilityId);
  const mutation = useCreateTask();
  const form = useForm<CreateFacilityTaskInput>({
    resolver: zodResolver(CreateFacilityTaskSchema),
    defaultValues: {
      facilityId,
      assignedStaffId: "",
      type: FacilityTaskType.INSPECT_UNIT,
      title: "",
      description: "",
    },
  });
  return (
    <ManagementDialog title={F5.createTask} onClose={onClose} pending={mutation.isPending}>
      <form
        noValidate
        className="grid gap-4"
        onSubmit={form.handleSubmit(async (input) => {
          try {
            onCreated(await mutation.mutateAsync(input));
          } catch {
            /* Preserve form and show server error. */
          }
        })}
      >
        <ManagementField label={F5.taskTitle} error={form.formState.errors.title?.message}>
          <Input {...form.register("title")} />
        </ManagementField>
        <ManagementField label={F5.taskType} error={form.formState.errors.type?.message}>
          <Select {...form.register("type")}>
            {Object.values(FacilityTaskType).map((value) => (
              <option key={value} value={value}>
                {F5.typeLabels[value]}
              </option>
            ))}
          </Select>
        </ManagementField>
        <ManagementField label={F5.staff} error={form.formState.errors.assignedStaffId?.message}>
          <Select {...form.register("assignedStaffId")}>
            <option value="">{F5.choose}</option>
            {staff.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </ManagementField>
        <ManagementField
          label={F5.descriptionLabel}
          error={form.formState.errors.description?.message}
        >
          <textarea className={textareaClass} {...form.register("description")} />
        </ManagementField>
        <ManagementField label={F5.unit} error={form.formState.errors.storageUnitId?.message}>
          <Select
            {...form.register("storageUnitId", { setValueAs: (value) => value || undefined })}
          >
            <option value="">{F5.optional}</option>
            {units.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code}
              </option>
            ))}
          </Select>
        </ManagementField>
        <ManagementField label={F5.booking} error={form.formState.errors.bookingId?.message}>
          <Input {...form.register("bookingId", { setValueAs: (value) => value || undefined })} />
        </ManagementField>
        <p className="text-sm text-slate-600">
          {F5.taskContext} {F5.printingHint}
        </p>
        {(staff.isError || units.isError) && (
          <ErrorState
            message={F5.loadError}
            onRetry={() => {
              void staff.refetch();
              void units.refetch();
            }}
          />
        )}
        {mutation.isError && (
          <p role="alert" className="text-danger">
            {managementError(mutation.error)}
          </p>
        )}
        <Button
          type="submit"
          disabled={
            mutation.isPending ||
            staff.isPending ||
            staff.isError ||
            units.isError ||
            units.isPending
          }
        >
          {F5.createTask}
        </Button>
      </form>
    </ManagementDialog>
  );
}

export function TaskDetails({
  id,
  manager,
  onClose,
}: {
  id: string;
  manager: boolean;
  onClose: () => void;
}) {
  const query = useFacilityTaskDetail(id);
  const detailRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (query.data?.id) detailRef.current?.scrollIntoView({ block: "start" });
  }, [query.data?.id]);
  const [offset, setOffset] = useState(0);
  const history = useTaskReportHistory(id, offset);
  const acceptReport = useAcceptTaskReport(id);
  if (query.isPending) return <LoadingState variant="detail" />;
  if (query.isError)
    return <ErrorState message={managementError(query.error)} onRetry={() => query.refetch()} />;
  const task = query.data;
  const Heading = manager ? "h2" : "h1";
  const ReportHeading = manager ? "h3" : "h2";
  return (
    <section
      ref={detailRef}
      aria-label={task.title}
      className={`${panelClass} grid scroll-mt-20 gap-5`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="inline-flex w-fit items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-900">
            {F5.typeLabels[task.type]}
          </p>
          <Heading className="mt-2 break-words text-xl font-extrabold tracking-tight text-ink">
            {task.title}
          </Heading>
          <p
            className={`mt-3 inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-bold ${TASK_STATUS_BADGE_CLASS[task.status]}`}
          >
            {F5.taskStatusLabels[task.status]}
          </p>
          <p className="mt-1 text-sm text-slate-600">{F5.taskStateHint[task.status]}</p>
        </div>
        {manager && (
          <Button type="button" variant="outline" onClick={onClose}>
            {F5.close}
          </Button>
        )}
      </div>
      <p className="whitespace-pre-wrap break-words text-sm">{task.description}</p>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        {manager && (
          <div>
            <dt className="text-slate-600">{F5.staff}</dt>
            <dd>{task.assignedStaffName}</dd>
          </div>
        )}
        <div>
          <dt className="text-slate-600">{F5.assignedBy}</dt>
          <dd>{task.assignerName}</dd>
        </div>
        <div>
          <dt className="text-slate-600">{F5.assignedAt}</dt>
          <dd>{formatDateTime(task.assignedAt)}</dd>
        </div>
        {manager && (
          <div>
            <dt className="text-slate-600">{F5.version}</dt>
            <dd>{task.version}</dd>
          </div>
        )}
        {manager && task.storageUnitId && (
          <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <dt className="text-xs font-semibold text-slate-600">{F5.unit}</dt>
            <dd className="mt-1 break-all font-mono text-xs text-ink">{task.storageUnitId}</dd>
          </div>
        )}
        {manager && task.bookingId && (
          <div className="min-w-0 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
            <dt className="text-xs font-bold text-emerald-900">{F5.booking}</dt>
            <dd className="mt-1 break-all font-mono text-xs text-emerald-950">{task.bookingId}</dd>
          </div>
        )}
      </dl>
      {manager ? (
        task.status !== "COMPLETED" && <TaskReassignment task={task} />
      ) : (
        <TaskExecution task={task} onReported={() => setOffset(0)} />
      )}
      <ReportHeading className="text-lg font-bold">{F5.reports}</ReportHeading>
      {history.isPending ? (
        <LoadingState variant="table" />
      ) : history.isError ? (
        <ErrorState message={managementError(history.error)} onRetry={() => history.refetch()} />
      ) : (
        <>
          {history.data.items.length === 0 && <p>{F5.empty}</p>}
          <ol className="grid gap-3">
            {history.data.items.map((report, index) => (
              <li
                key={report.id}
                className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 transition-colors hover:border-slate-300"
              >
                <p className="text-sm font-semibold">
                  {report.submitterName} · {formatDateTime(report.submittedAt)}
                </p>
                {report.acceptedAt ? (
                  <p className="mt-2 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-900">
                    {F5.acceptedReport(report.acceptedByName, formatDateTime(report.acceptedAt))}
                  </p>
                ) : manager &&
                  task.status === "AWAITING_APPROVAL" &&
                  offset === 0 &&
                  index === 0 ? (
                  <div className="mt-3">
                    {acceptReport.isError && (
                      <p role="alert" className="mb-2 text-danger">
                        {managementError(acceptReport.error)}
                      </p>
                    )}
                    <Button
                      type="button"
                      disabled={acceptReport.isPending}
                      onClick={() => acceptReport.mutate(report.id)}
                    >
                      {F5.acceptReport}
                    </Button>
                  </div>
                ) : null}
                <p className="mt-2 whitespace-pre-wrap break-words text-sm">{report.content}</p>
              </li>
            ))}
          </ol>
          <PageControls
            label={F5.reports}
            offset={offset}
            count={history.data.items.length}
            total={history.data.total}
            onChange={setOffset}
            pending={history.isFetching}
          />
        </>
      )}
    </section>
  );
}

function TaskExecution({ task, onReported }: { task: FacilityTaskDetail; onReported: () => void }) {
  const start = useStartTask(task.id);
  if (task.status === "ASSIGNED")
    return (
      <div className="grid justify-items-start gap-2">
        {start.isError && (
          <p role="alert" className="text-danger">
            {managementError(start.error)}
          </p>
        )}
        <Button type="button" disabled={start.isPending} onClick={() => start.mutate()}>
          {F5.startTask}
        </Button>
      </div>
    );
  if (task.status === "COMPLETED") return null;
  if (task.status === "AWAITING_APPROVAL")
    return (
      <details className="rounded-xl border border-slate-200 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-emerald-900">
          {TASK_WORKSPACE_MESSAGES.additionalReport}
        </summary>
        <div className="mt-4">
          <TaskReportEditor taskId={task.id} onReported={onReported} />
        </div>
      </details>
    );
  return <TaskReportEditor taskId={task.id} onReported={onReported} />;
}

function TaskReassignment({ task }: { task: FacilityTaskDetail }) {
  const staff = useTaskStaff(task.facilityId);
  const mutation = useAssignTask(task.id);
  const form = useForm<AssignFacilityTaskInput>({
    resolver: zodResolver(AssignFacilityTaskSchema),
    defaultValues: { assignedStaffId: task.assignedStaffId, version: task.version },
  });
  const { reset } = form;
  useEffect(
    () => reset({ assignedStaffId: task.assignedStaffId, version: task.version }),
    [reset, task.assignedStaffId, task.version],
  );
  return (
    <form
      noValidate
      className="grid gap-3"
      onSubmit={form.handleSubmit(async (input) => {
        try {
          await mutation.mutateAsync(input);
        } catch {
          /* Refresh latest assignment on conflict through the mutation hook. */
        }
      })}
    >
      <ManagementField label={F5.staff} error={form.formState.errors.assignedStaffId?.message}>
        <Select {...form.register("assignedStaffId")}>
          {!staff.data?.some((item) => item.id === task.assignedStaffId) && (
            <option value={task.assignedStaffId}>{task.assignedStaffName}</option>
          )}
          {staff.data?.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>
      </ManagementField>
      {staff.isError && <ErrorState message={F5.loadError} onRetry={() => staff.refetch()} />}
      {mutation.isError && (
        <p role="alert" className="text-danger">
          {managementError(mutation.error)}
        </p>
      )}
      {mutation.isSuccess && <p role="status">{F5.saved}</p>}
      <Button type="submit" disabled={mutation.isPending || staff.isPending || staff.isError}>
        {F5.reassign}
      </Button>
    </form>
  );
}

function TaskReportEditor({ taskId, onReported }: { taskId: string; onReported: () => void }) {
  const mutation = useReportTask(taskId);
  const form = useForm<CreateFacilityTaskReportInput>({
    resolver: zodResolver(CreateFacilityTaskReportSchema),
    defaultValues: { content: "" },
  });
  return (
    <form
      noValidate
      className="grid gap-3"
      onSubmit={form.handleSubmit(async (input) => {
        try {
          await mutation.mutateAsync(input);
          form.reset();
          onReported();
        } catch {
          /* Keep report draft on failure. */
        }
      })}
    >
      <ManagementField label={F5.reportContent} error={form.formState.errors.content?.message}>
        <textarea className={textareaClass} {...form.register("content")} />
      </ManagementField>
      {mutation.isError && (
        <p role="alert" className="text-danger">
          {managementError(mutation.error)}
        </p>
      )}
      {mutation.isSuccess && <p role="status">{F5.reported}</p>}
      <Button type="submit" disabled={mutation.isPending}>
        {F5.sendReport}
      </Button>
    </form>
  );
}
