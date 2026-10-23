import type { SwaggerTransform } from "@fastify/swagger";
import {
  type FacilityTaskDetail,
  type FacilityTaskReportDetail,
  FACILITY_TASK_MESSAGES as m,
} from "@metastorage/contracts";
import { createJsonSchemaTransform } from "fastify-type-provider-zod";

const transform = createJsonSchemaTransform({ zodToJsonConfig: { target: "openapi-3.0" } });

const timestamp = "2026-10-22T03:00:00.000Z";
const example: FacilityTaskDetail = {
  id: "00000000-0000-4000-8000-000000000001",
  facilityId: "00000000-0000-4000-8000-000000000002",
  assignedStaffId: "00000000-0000-4000-8000-000000000003",
  assignedStaffName: "Staff demo",
  createdBy: "00000000-0000-4000-8000-000000000004",
  assignedBy: "00000000-0000-4000-8000-000000000004",
  assignerName: "FM demo",
  type: "INSPECT_UNIT",
  title: "Kiểm tra kho trước bàn giao",
  description: null,
  storageUnitId: "00000000-0000-4000-8000-000000000005",
  bookingId: null,
  status: "ASSIGNED",
  version: 0,
  startedAt: null,
  completedBy: null,
  completedAt: null,
  assignedAt: timestamp,
  createdAt: timestamp,
  updatedAt: timestamp,
};

const reportExample: FacilityTaskReportDetail = {
  id: "00000000-0000-4000-8000-000000000006",
  taskId: example.id,
  submittedBy: example.assignedStaffId,
  submitterName: example.assignedStaffName,
  content: "Đã kiểm tra cửa và tình trạng ô kho.",
  submittedAt: timestamp,
  acceptedBy: null,
  acceptedByName: null,
  acceptedAt: null,
};
const startedTaskExample: FacilityTaskDetail = {
  ...example,
  status: "IN_PROGRESS",
  startedAt: timestamp,
};
const completedTaskExample: FacilityTaskDetail = {
  ...example,
  status: "COMPLETED",
  startedAt: timestamp,
  completedBy: "00000000-0000-4000-8000-000000000004",
  completedAt: timestamp,
};

function errorExample(code: number, message: string) {
  return {
    description: message,
    type: "object",
    example: { success: false, error: { code, message }, timestamp },
  };
}

// Documentation only: runtime serialization and the service DTO stay independent.
export function facilityTaskSwaggerTransform(
  operation:
    | "create"
    | "list"
    | "detail"
    | "assign"
    | "start"
    | "accept-report"
    | "report-create"
    | "report-list",
): SwaggerTransform {
  const isCreate = operation === "create" || operation === "report-create";
  const isReport = operation === "report-create" || operation === "report-list";
  const isList = operation === "list" || operation === "report-list";
  const data = isReport
    ? reportExample
    : operation === "start"
      ? startedTaskExample
      : operation === "accept-report"
        ? completedTaskExample
        : example;
  return (input) => {
    const result = transform(input);
    result.schema = {
      ...result.schema,
      security: [{ sessionAuth: [] }],
      response: {
        [isCreate ? 201 : 200]: {
          description:
            operation === "report-create"
              ? m.reportCreated
              : operation === "start"
                ? m.taskStarted
                : operation === "accept-report"
                  ? m.taskAccepted
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
        ...(operation === "detail" ||
        operation === "assign" ||
        operation === "start" ||
        operation === "accept-report" ||
        isReport
          ? { 404: errorExample(404, m.taskNotFound) }
          : {}),
        ...(operation === "assign" ? { 409: errorExample(409, m.versionConflict) } : {}),
        ...(operation === "start" || operation === "accept-report"
          ? { 409: errorExample(409, m.taskNotReady) }
          : {}),
        ...(operation === "report-create" ? { 409: errorExample(409, m.taskNotReady) } : {}),
      },
    };
    return result;
  };
}
