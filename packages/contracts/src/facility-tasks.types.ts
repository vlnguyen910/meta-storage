import type {
  FacilityTaskReferenceType,
  FacilityTaskStatus,
  FacilityTaskType,
} from "./facility-tasks";

export interface FacilityTaskDetail {
  id: string;
  facilityId: string;
  type: `${FacilityTaskType}`;
  status: `${FacilityTaskStatus}`;
  referenceType: `${FacilityTaskReferenceType}`;
  referenceId: string;
  assignedStaffId: string;
  assignedStaffName: string;
  assignedBy: string;
  assignerName: string;
  version: number;
  startedAt: string | null;
  completedAt: string | null;
  assignedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface FacilityTaskListResult {
  items: FacilityTaskDetail[];
  total: number;
  limit: number;
  offset: number;
}
