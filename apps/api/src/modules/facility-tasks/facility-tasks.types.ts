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
        | "INVALID_TASK_STATE"
        | "TASK_ACCESS_DENIED"
        | "TASK_TYPE_LOCKED";
    };
