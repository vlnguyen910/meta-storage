import { z } from "zod";
import { FACILITY_TASK_MESSAGES as m } from "./facility-tasks.messages";

export enum FacilityTaskType {
  INSPECT_UNIT = "INSPECT_UNIT",
  PRINT_DOCUMENT = "PRINT_DOCUMENT",
  REPORT_TO_MANAGER = "REPORT_TO_MANAGER",
}

export enum FacilityTaskStatus {
  ASSIGNED = "ASSIGNED",
  IN_PROGRESS = "IN_PROGRESS",
  AWAITING_APPROVAL = "AWAITING_APPROVAL",
  COMPLETED = "COMPLETED",
}

export const CreateFacilityTaskSchema = z
  .object({
    facilityId: z.string().uuid(),
    assignedStaffId: z.string().uuid(),
    type: z.nativeEnum(FacilityTaskType),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).optional(),
    storageUnitId: z.string().uuid().optional(),
    bookingId: z.string().uuid().optional(),
  })
  .strict();

export const FacilityTaskListQuerySchema = z
  .object({
    facilityId: z.string().uuid(),
    assignedStaffId: z.string().uuid().optional(),
    type: z.nativeEnum(FacilityTaskType).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export const FacilityTaskParamsSchema = z.object({ id: z.string().uuid() });
export const FacilityTaskReportParamsSchema = z.object({
  id: z.string().uuid(),
  reportId: z.string().uuid(),
});
export const AssignFacilityTaskSchema = z
  .object({
    assignedStaffId: z.string().uuid(),
    version: z.number().int().nonnegative(),
  })
  .strict();

export type CreateFacilityTaskInput = z.infer<typeof CreateFacilityTaskSchema>;
export type FacilityTaskListQuery = z.infer<typeof FacilityTaskListQuerySchema>;
export type AssignFacilityTaskInput = z.infer<typeof AssignFacilityTaskSchema>;
export * from "./facility-tasks.messages";
export type * from "./facility-tasks.types";

export const CreateFacilityTaskReportSchema = z
  .object({
    content: z.string().trim().min(1, m.reportContentRequired).max(5000, m.reportContentTooLong),
  })
  .strict();
export const FacilityTaskReportListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();
export type CreateFacilityTaskReportInput = z.infer<typeof CreateFacilityTaskReportSchema>;
export type FacilityTaskReportListQuery = z.infer<typeof FacilityTaskReportListQuerySchema>;
