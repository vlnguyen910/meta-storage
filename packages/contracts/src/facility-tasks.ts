import { z } from "zod";

export enum FacilityTaskType {
  CHECK_IN_HANDOVER = "CHECK_IN_HANDOVER",
  UNIT_INSPECTION = "UNIT_INSPECTION",
  HANDLE_SUPPORT = "HANDLE_SUPPORT",
}

export enum FacilityTaskStatus {
  ASSIGNED = "ASSIGNED",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export enum FacilityTaskReferenceType {
  BOOKING = "BOOKING",
  STORAGE_UNIT = "STORAGE_UNIT",
  SUPPORT_TICKET = "SUPPORT_TICKET",
}

export const CreateFacilityTaskSchema = z
  .object({
    facilityId: z.string().uuid(),
    assignedStaffId: z.string().uuid(),
    type: z.nativeEnum(FacilityTaskType),
    referenceType: z.nativeEnum(FacilityTaskReferenceType),
    referenceId: z.string().uuid(),
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
