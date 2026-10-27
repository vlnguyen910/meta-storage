import type { SwaggerTransform } from "@fastify/swagger";
import { type FacilityTaskDetail, FACILITY_TASK_MESSAGES as m } from "@metastorage/contracts";
import { createJsonSchemaTransform } from "fastify-type-provider-zod";

const transform = createJsonSchemaTransform({ zodToJsonConfig: { target: "openapi-3.0" } });
const timestamp = "2026-10-28T03:00:00.000Z";
const task: FacilityTaskDetail = {
  id: "00000000-0000-4000-8000-000000000001",
  facilityId: "00000000-0000-4000-8000-000000000002",
  type: "UNIT_INSPECTION",
  status: "ASSIGNED",
  referenceType: "STORAGE_UNIT",
  referenceId: "00000000-0000-4000-8000-000000000005",
  assignedStaffId: "00000000-0000-4000-8000-000000000003",
  assignedStaffName: "Staff demo",
  assignedBy: "00000000-0000-4000-8000-000000000004",
  assignerName: "FM demo",
  version: 0,
  startedAt: null,
  completedAt: null,
  assignedAt: timestamp,
  createdAt: timestamp,
  updatedAt: timestamp,
};

function errorExample(code: number, message: string) {
  return {
    description: message,
    type: "object",
    example: { success: false, error: { code, message }, timestamp },
  };
}

export function facilityTaskSwaggerTransform(
  operation: "create" | "list" | "detail" | "assign" | "start" | "complete" | "cancel",
): SwaggerTransform {
  const isCreate = operation === "create";
  const isList = operation === "list";
  const data: FacilityTaskDetail =
    operation === "start"
      ? { ...task, status: "IN_PROGRESS", startedAt: timestamp }
      : operation === "complete"
        ? { ...task, status: "COMPLETED", startedAt: timestamp, completedAt: timestamp }
        : operation === "cancel"
          ? { ...task, status: "CANCELLED" }
          : task;
  return (input) => {
    const result = transform(input);
    result.schema = {
      ...result.schema,
      security: [{ sessionAuth: [] }],
      response: {
        [isCreate ? 201 : 200]: {
          description:
            operation === "start"
              ? m.taskStarted
              : operation === "complete"
                ? m.taskCompleted
                : operation === "cancel"
                  ? m.taskCancelled
                  : isCreate
                    ? m.created
                    : m.success,
          type: "object",
          example: {
            success: true,
            data: isList ? { items: [data], total: 1, limit: 20, offset: 0 } : data,
            timestamp,
          },
        },
        400: errorExample(400, m.invalidInput),
        401: errorExample(401, m.loginRequired),
        403: errorExample(403, m.accessDenied),
        ...(operation !== "list" && operation !== "create"
          ? { 404: errorExample(404, m.taskNotFound) }
          : {}),
        ...(operation === "assign" ? { 409: errorExample(409, m.versionConflict) } : {}),
        ...(operation === "start" || operation === "complete" || operation === "cancel"
          ? { 409: errorExample(409, m.taskNotReady) }
          : {}),
      },
    };
    return result;
  };
}
