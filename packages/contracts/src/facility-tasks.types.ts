import type { FacilityTaskStatus, FacilityTaskType } from "./facility-tasks";

export interface FacilityTaskDetail {
  id: string;
  facilityId: string;
  type: `${FacilityTaskType}`;
  status: `${FacilityTaskStatus}`;
  title: string;
  description: string | null;
  storageUnitId: string | null;
  bookingId: string | null;
  assignedStaffId: string;
  assignedStaffName: string;
  createdBy: string;
  assignedBy: string;
  assignerName: string;
  version: number;
  startedAt: string | null;
  completedBy: string | null;
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

export interface FacilityTaskReportDetail {
  id: string;
  taskId: string;
  submittedBy: string;
  submitterName: string;
  content: string;
  submittedAt: string;
  acceptedBy: string | null;
  acceptedByName: string | null;
  acceptedAt: string | null;
}
export interface FacilityTaskReportListResult {
  items: FacilityTaskReportDetail[];
  total: number;
  limit: number;
  offset: number;
}
