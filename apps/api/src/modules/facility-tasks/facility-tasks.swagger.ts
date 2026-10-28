import type { SwaggerTransform } from "@fastify/swagger";
import {
  type FacilityTaskDashboardSummary,
  type FacilityTaskDetail,
  FacilityTaskReferenceType,
  FacilityTaskStatus,
  FacilityTaskType,
  FACILITY_TASK_MESSAGES as m,
} from "@metastorage/contracts";
import { createJsonSchemaTransform } from "fastify-type-provider-zod";

const transform = createJsonSchemaTransform({ zodToJsonConfig: { target: "openapi-3.0" } });
const timestamp = "2026-10-28T03:00:00.000Z";
const task: FacilityTaskDetail = {
  id: "00000000-0000-4000-8000-000000000001",
  facilityId: "00000000-0000-4000-8000-000000000002",
  type: FacilityTaskType.UNIT_INSPECTION,
  status: FacilityTaskStatus.ASSIGNED,
  referenceType: FacilityTaskReferenceType.STORAGE_UNIT,
  referenceId: "00000000-0000-4000-8000-000000000005",
  assignedStaffId: "00000000-0000-4000-8000-000000000003",
  assignedStaffName: "Staff demo",
  assignedBy: "00000000-0000-4000-8000-000000000004",
  assignerName: "FM demo",
  description: null,
  startedAt: null,
  completedAt: null,
  assignedAt: timestamp,
  createdAt: timestamp,
  updatedAt: timestamp,
};
const dashboard: FacilityTaskDashboardSummary = {
  date: "2026-10-28",
  pendingCount: 2,
  byType: {
    [FacilityTaskType.CHECK_IN_HANDOVER]: 1,
    [FacilityTaskType.UNIT_INSPECTION]: 1,
    [FacilityTaskType.HANDLE_SUPPORT]: 0,
  },
};

function errorExample(code: number, message: string) {
  return {
    description: message,
    type: "object",
    example: { success: false, error: { code, message }, timestamp },
  };
}

export function facilityTaskSwaggerTransform(
  operation: "create" | "list" | "update" | "dashboard",
): SwaggerTransform {
  const isCreate = operation === "create";
  const isList = operation === "list";
  return (input) => {
    const result = transform(input);
    result.schema = {
      ...result.schema,
      security: [{ sessionAuth: [] }],
      response: {
        [isCreate ? 201 : 200]: {
          description: isCreate ? m.created : m.success,
          type: "object",
          example: {
            success: true,
            data:
              operation === "dashboard"
                ? dashboard
                : isList
                  ? { items: [task], total: 1, limit: 20, offset: 0 }
                  : task,
            timestamp,
          },
        },
        400: errorExample(400, m.invalidInput),
        401: errorExample(401, m.loginRequired),
        403: errorExample(403, m.accessDenied),
        ...(operation === "update" ? { 404: errorExample(404, m.taskNotFound) } : {}),
        ...(operation === "update" ? { 409: errorExample(409, m.taskNotReady) } : {}),
      },
    };
    return result;
  };
}
