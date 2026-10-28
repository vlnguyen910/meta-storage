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

export const FacilityTaskTypeReferenceSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal(FacilityTaskType.CHECK_IN_HANDOVER),
    referenceType: z.literal(FacilityTaskReferenceType.BOOKING),
  }),
  z.object({
    type: z.literal(FacilityTaskType.UNIT_INSPECTION),
    referenceType: z.enum([
      FacilityTaskReferenceType.BOOKING,
      FacilityTaskReferenceType.STORAGE_UNIT,
    ]),
  }),
  z.object({
    type: z.literal(FacilityTaskType.HANDLE_SUPPORT),
    referenceType: z.literal(FacilityTaskReferenceType.SUPPORT_TICKET),
  }),
]);

export const CreateFacilityTaskSchema = z
  .object({
    facilityId: z.string().uuid(),
    assignedStaffId: z.string().uuid(),
    type: z.nativeEnum(FacilityTaskType),
    referenceType: z.nativeEnum(FacilityTaskReferenceType),
    referenceId: z.string().uuid(),
    description: z.string().trim().max(2000).optional(),
  })
  .strict();

const FacilityTaskPageSchema = z.object({
  type: z.nativeEnum(FacilityTaskType).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const StaffFacilityTaskListQuerySchema = FacilityTaskPageSchema.strict();
export const FacilityTaskListQuerySchema = FacilityTaskPageSchema.extend({
  assignedStaffId: z.string().uuid().optional(),
}).strict();

export const FacilityTaskParamsSchema = z.object({ id: z.string().uuid() });
const UpdateFacilityTaskDetailsSchema = z
  .object({
    type: z.nativeEnum(FacilityTaskType).optional(),
    assignedStaffId: z.string().uuid().optional(),
    description: z.string().trim().max(2000).nullable().optional(),
  })
  .strict()
  .refine(
    (input) =>
      input.type !== undefined ||
      input.assignedStaffId !== undefined ||
      input.description !== undefined,
  );
const UpdateFacilityTaskStatusSchema = z
  .object({
    status: z.enum([
      FacilityTaskStatus.IN_PROGRESS,
      FacilityTaskStatus.COMPLETED,
      FacilityTaskStatus.CANCELLED,
    ]),
  })
  .strict();
export const UpdateFacilityTaskSchema = z.union([
  UpdateFacilityTaskDetailsSchema,
  UpdateFacilityTaskStatusSchema,
]);

export const FacilityTaskDashboardSummarySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pendingCount: z.number().int().nonnegative(),
  byType: z.object({
    CHECK_IN_HANDOVER: z.number().int().nonnegative(),
    UNIT_INSPECTION: z.number().int().nonnegative(),
    HANDLE_SUPPORT: z.number().int().nonnegative(),
  }),
});

export type CreateFacilityTaskInput = z.infer<typeof CreateFacilityTaskSchema>;
export type FacilityTaskListQuery = z.infer<typeof FacilityTaskListQuerySchema>;
export type StaffFacilityTaskListQuery = z.infer<typeof StaffFacilityTaskListQuerySchema>;
export type UpdateFacilityTaskInput = z.infer<typeof UpdateFacilityTaskSchema>;
export type FacilityTaskDashboardSummary = z.infer<typeof FacilityTaskDashboardSummarySchema>;
export * from "./facility-tasks.messages";
export type * from "./facility-tasks.types";
