import type { Database, FacilityTask, Role } from "@metastorage/database";

export type TaskTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export interface FacilityTaskActor {
  id: string;
  role: Role | null | undefined;
}

export interface FacilityTaskRecord extends FacilityTask {
  assignedStaffName: string;
  assignerName: string;
}

export type TaskWriteResult =
  | { task: FacilityTaskRecord }
  | {
      error:
        | "TASK_NOT_FOUND"
        | "MANAGER_ACCESS_DENIED"
        | "STAFF_UNAVAILABLE"
        | "CONTEXT_MISMATCH"
        | "VERSION_CONFLICT"
        | "INVALID_TASK_STATE";
    };

export type LockedTaskActors =
  | { manager: { id: string; name: string }; staff: { id: string; name: string } }
  | { error: "MANAGER_ACCESS_DENIED" | "STAFF_UNAVAILABLE" };

export type FacilityTaskReportRecord = {
  id: string;
  taskId: string;
  submittedBy: string;
  submitterName: string;
  content: string;
  submittedAt: Date;
  acceptedBy: string | null;
  acceptedByName: string | null;
  acceptedAt: Date | null;
};
export type TaskReportWriteResult =
  | { report: FacilityTaskReportRecord }
  | { error: "TASK_NOT_FOUND" | "REPORT_ACCESS_DENIED" | "INVALID_TASK_STATE" };

export type TaskLifecycleWriteResult =
  | { task: FacilityTaskRecord }
  | {
      error:
        | "TASK_NOT_FOUND"
        | "TASK_ACCESS_DENIED"
        | "MANAGER_ACCESS_DENIED"
        | "INVALID_TASK_STATE"
        | "REPORT_NOT_FOUND"
        | "REPORT_NOT_LATEST";
    };
