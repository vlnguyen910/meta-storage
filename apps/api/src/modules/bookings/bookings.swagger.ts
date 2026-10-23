import type { SwaggerTransform } from "@fastify/swagger";
import {
  type BookingDraft,
  type BookingDraftInput,
  type BookingListItem,
  BookingListItemSchema,
  type BookingTracking,
  type CheckInSlotOption,
  EligibleUnitSchema,
  PhysicalUnitAssignmentSchema,
} from "@metastorage/contracts";
import { SEED_IDS, SEED_USERS } from "@metastorage/database/seed";
import type { FastifySchema } from "fastify";
import { createJsonSchemaTransform } from "fastify-type-provider-zod";
import { z } from "zod";
import { ERROR_MESSAGES } from "../../common/errors/error.messages";
import { BOOKING_MESSAGES, BOOKING_SWAGGER_MESSAGES as m } from "./bookings.messages";

const facilityId = SEED_IDS.facilities["HCM-01"];
const unitTypeId = SEED_IDS.unitTypes["UT-2M"];
const bookingId = SEED_IDS.bookings["BK-2026-0001"];
const staffId = SEED_USERS[1].id;
const physicalUnitId = SEED_IDS.storageUnits["HCM-01-002"];
const timestamp = "2031-01-01T00:00:00.000Z";
const draftInput = {
  facilityId,
  unitTypeId,
  checkInSlotId: SEED_IDS.checkInSlots[0],
  checkInDate: "2031-02-01",
  durationMonths: 2,
} satisfies BookingDraftInput;
const draft = {
  id: bookingId,
  facilityId,
  unitTypeId,
  checkInAt: "2031-02-01T02:00:00.000Z",
  rentalEndAt: "2031-04-01T02:00:00.000Z",
  durationMonths: 2,
  draftAccessToken: "0123456789abcdef".repeat(4),
  status: "DRAFT",
  pricing: {
    monthlyRateSnapshot: "900000",
    rentalFeeAmount: "1800000",
    depositAmount: "900000",
    totalAmount: "2700000",
    currency: "VND",
  },
} satisfies BookingDraft;
const booking = {
  id: bookingId,
  bookingCode: "BK-EXAMPLE",
  facilityId,
  facilityName: "HCM-01",
  unitTypeId,
  unitTypeName: "Small storage",
  unitTypeSizeLabel: "S",
  contactName: "Nguyen Van An",
  contactEmail: "an@example.test",
  contactPhone: "+84901234567",
  checkInSlotStart: draft.checkInAt,
  checkInSlotEnd: "2031-02-01T05:00:00.000Z",
  rentalEndAt: draft.rentalEndAt,
  requestedMonths: 2,
  totalAmount: 2700000,
  status: "CONFIRMED",
  paidAt: timestamp,
  assignedUnit: null,
  assignedStaff: null,
  createdAt: timestamp,
} satisfies BookingListItem;
const assignment = {
  id: "66666666-6666-4666-8666-666666666666",
  bookingId,
  physicalUnitId,
  physicalUnitCode: "HCM-01-002",
  assignedBy: SEED_USERS[2].id,
  status: "ACTIVE",
  assignedAt: timestamp,
  endedAt: null,
  reason: null,
};
const units = [
  {
    id: physicalUnitId,
    facilityId,
    unitTypeId,
    code: "HCM-01-002",
    status: "AVAILABLE",
    isAvailableForPeriod: true,
  },
];

const uuid = { type: "string", format: "uuid" };
const dateTime = { type: "string", format: "date-time" };
const draftProperties = {
  id: uuid,
  facilityId: uuid,
  unitTypeId: uuid,
  checkInAt: dateTime,
  rentalEndAt: dateTime,
  durationMonths: { type: "integer", minimum: 1, maximum: 12 },
  draftAccessToken: { type: "string", minLength: 64 },
  status: { type: "string", enum: ["DRAFT"] },
  pricing: {
    type: "object",
    required: Object.keys(draft.pricing),
    properties: Object.fromEntries(
      Object.keys(draft.pricing).map((key) => [
        key,
        key === "currency" ? { type: "string", enum: ["VND"] } : { type: "string" },
      ]),
    ),
  },
};
const draftSchema = {
  type: "object",
  required: Object.keys(draftProperties),
  properties: draftProperties,
};
const bookingSchema = z.toJSONSchema(BookingListItemSchema, { target: "openapi-3.0" });
const assignmentSchema = z.toJSONSchema(PhysicalUnitAssignmentSchema, { target: "openapi-3.0" });
const unitsSchema = {
  type: "array",
  items: z.toJSONSchema(EligibleUnitSchema, { target: "openapi-3.0" }),
};
const bookingsSchema = { type: "array", items: bookingSchema };

function success(schema: object, data: unknown) {
  return {
    description: m.success,
    type: "object",
    required: ["success", "data", "timestamp"],
    properties: {
      success: { type: "boolean", enum: [true] },
      message: { type: "string" },
      data: schema,
      timestamp: dateTime,
    },
    example: { success: true, data, timestamp },
  };
}

function failure(code: number, message: string) {
  return {
    description: m.failure,
    type: "object",
    required: ["success", "error", "timestamp"],
    properties: {
      success: { type: "boolean", enum: [false] },
      error: {
        type: "object",
        required: ["code", "message"],
        properties: {
          code: { type: "integer", enum: [code] },
          message: { type: "string" },
          details: {
            type: "array",
            items: {
              type: "object",
              required: ["message"],
              properties: { field: { type: "string" }, message: { type: "string" } },
            },
          },
        },
      },
      timestamp: dateTime,
    },
    example: { success: false, error: { code, message }, timestamp },
  };
}

const errors = {
  400: failure(400, ERROR_MESSAGES.requestValidationFailed),
  401: failure(401, ERROR_MESSAGES.unauthorized),
  403: failure(403, ERROR_MESSAGES.forbidden),
  404: failure(404, BOOKING_MESSAGES.bookingNotFound),
  500: failure(500, ERROR_MESSAGES.unexpectedInternalServerError),
};
const optionalSession: FastifySchema["security"] = [{}, { sessionAuth: [] }];
const trackingExample = {
  bookingCode: booking.bookingCode,
  status: "CONFIRMED",
  facility: { name: "HCM-01", address: "Ho Chi Minh City" },
  unitType: { name: booking.unitTypeName, sizeLabel: booking.unitTypeSizeLabel },
  checkInSlotStart: booking.checkInSlotStart,
  checkInSlotEnd: booking.checkInSlotEnd,
  rentalEndAt: booking.rentalEndAt,
  durationMonths: booking.requestedMonths,
  contact: {
    fullName: booking.contactName,
    email: booking.contactEmail,
    phone: booking.contactPhone,
  },
  pricing: draft.pricing,
  payment: {
    status: "SUCCEEDED",
    paidAt: timestamp,
    refundAmount: null,
    depositForfeitedAmount: "0.00",
  },
} satisfies BookingTracking;
const text = { type: "string" };
const objectSchema = (properties: Record<string, object>) => ({
  type: "object",
  required: Object.keys(properties),
  properties,
});
const trackingSchema = objectSchema({
  bookingCode: text,
  status: { type: "string", enum: ["CONFIRMED", "CHECKED_IN", "CANCELLED", "NO_SHOW"] },
  facility: objectSchema({ name: text, address: text }),
  unitType: objectSchema({ name: text, sizeLabel: text }),
  checkInSlotStart: dateTime,
  checkInSlotEnd: dateTime,
  rentalEndAt: dateTime,
  durationMonths: { type: "integer" },
  contact: objectSchema({
    fullName: text,
    email: { type: "string", format: "email" },
    phone: text,
  }),
  pricing: draftProperties.pricing,
  payment: objectSchema({
    status: { type: "string", enum: ["SUCCEEDED", "REFUND_PENDING", "REFUNDED"] },
    paidAt: dateTime,
    refundAmount: { type: "string", nullable: true },
    depositForfeitedAmount: text,
  }),
});
const trackingErrors = {
  400: errors[400],
  401: failure(401, BOOKING_MESSAGES.accessInvalid),
  403: errors[403],
  503: failure(503, BOOKING_MESSAGES.accessUnavailable),
};
const operations = {
  slots: {
    summary: m.slotsSummary,
    description: m.slotsDescription,
    security: [],
    response: {
      200: success(
        {
          type: "array",
          items: objectSchema({
            id: { type: "string", format: "uuid" },
            name: text,
            startTime: text,
            endTime: text,
          }),
        },
        [
          {
            id: SEED_IDS.checkInSlots[0],
            name: "Morning",
            startTime: "09:00:00",
            endTime: "11:00:00",
          },
        ] satisfies CheckInSlotOption[],
      ),
      500: errors[500],
    },
  },
  exchange: {
    summary: BOOKING_MESSAGES.exchangeSummary,
    description: BOOKING_MESSAGES.exchangeDescription,
    security: [],
    body: { token: "0123456789abcdef".repeat(4) },
    response: {
      ...trackingErrors,
      429: failure(429, BOOKING_MESSAGES.accessRateLimited),
      200: {
        ...success(
          objectSchema({ bookingCode: text, expiresAt: dateTime, booking: trackingSchema }),
          {
            bookingCode: booking.bookingCode,
            expiresAt: timestamp,
            booking: trackingExample,
          },
        ),
        headers: {
          "Set-Cookie": { type: "string", description: BOOKING_MESSAGES.exchangeDescription },
        },
      },
    },
  },
  tracking: {
    summary: BOOKING_MESSAGES.trackingSummary,
    description: BOOKING_MESSAGES.trackingDescription,
    security: [{ bookingTrackingSession: [] }],
    response: {
      ...trackingErrors,
      404: errors[404],
      200: success(trackingSchema, trackingExample),
    },
  },
  revoke: {
    summary: BOOKING_MESSAGES.revokeSummary,
    description: BOOKING_MESSAGES.revokeDescription,
    security: [],
    response: {
      403: errors[403],
      503: trackingErrors[503],
      204: { description: BOOKING_MESSAGES.sessionRevoked, type: "null" },
    },
  },
  draft: {
    summary: m.draftSummary,
    description: m.draftDescription,
    body: draftInput,
    security: optionalSession,
    response: {
      ...errors,
      201: success(draftSchema, draft),
      409: failure(409, BOOKING_MESSAGES.unitTypeCapacityUnavailable),
    },
  },
  facility: {
    summary: m.facilitySummary,
    description: m.facilityDescription,
    response: { ...errors, 200: success(bookingsSchema, [booking]) },
  },
  tasks: {
    summary: m.tasksSummary,
    description: m.tasksDescription,
    response: {
      200: success(bookingsSchema, [booking]),
      400: errors[400],
      401: errors[401],
      403: errors[403],
      500: errors[500],
    },
  },
  detail: {
    summary: m.detailSummary,
    description: m.detailDescription,
    response: { ...errors, 200: success(bookingSchema, booking) },
  },
  units: {
    summary: m.unitsSummary,
    description: m.unitsDescription,
    response: { ...errors, 200: success(unitsSchema, units) },
  },
  assignUnit: {
    summary: m.assignUnitSummary,
    description: m.assignUnitDescription,
    body: { physicalUnitId, reason: "" },
    response: {
      ...errors,
      200: success(assignmentSchema, assignment),
      409: failure(409, BOOKING_MESSAGES.physicalUnitAssignmentConflict),
      422: failure(422, BOOKING_MESSAGES.physicalUnitDoesNotMatchReservation),
    },
  },
  assignStaff: {
    summary: m.assignStaffSummary,
    description: m.assignStaffDescription,
    body: { staffId },
    response: {
      ...errors,
      200: success(bookingSchema, {
        ...booking,
        assignedStaff: {
          id: staffId,
          name: "Tran Thi Binh",
          email: "binh@example.test",
          phone: null,
          role: "FACILITY_STAFF",
          isActive: true,
        },
      }),
    },
  },
};

const transform = createJsonSchemaTransform({ zodToJsonConfig: { target: "openapi-3.0" } });

// Response schemas are added only during Swagger generation, never to Fastify's
// runtime serializer/validator. The service DTO remains the response boundary.
export function bookingSwaggerTransform(operation: keyof typeof operations): SwaggerTransform {
  return (input) => {
    const result = transform(input);
    const docs = operations[operation];
    result.schema = {
      ...result.schema,
      tags: [m.tag],
      summary: docs.summary,
      description: docs.description,
      security: "security" in docs ? docs.security : [{ sessionAuth: [] }],
      response: docs.response,
      ...("body" in docs
        ? { body: { ...(result.schema.body as object), example: docs.body } }
        : {}),
    };
    return result;
  };
}
