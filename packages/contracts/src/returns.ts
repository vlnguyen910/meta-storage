import { z } from "zod";
import { RETURN_MESSAGES as m } from "./returns.messages";

export { RETURN_MESSAGES } from "./returns.messages";
export type * from "./returns.types";

export const ReturnRequestStatus = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  INSPECTING: "INSPECTING",
  FAILED: "FAILED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;
export const ReturnInspectionStatus = { DRAFT: "DRAFT", PASS: "PASS", FAIL: "FAIL" } as const;
export const ReturnTimeChangeStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;
export const RETURN_CHECKLIST_GROUPS = [
  "REMAINING_PROPERTY",
  "UNIT_CONDITION",
  "HYGIENE_SAFETY",
  "EVIDENCE",
] as const;

const version = z.number().int().nonnegative().max(2147483646);
const reason = z.string().trim().min(1, m.reason).max(4000);
const money = z.string().regex(/^(0|[1-9]\d{0,13})$/, m.invalidMoney);
const date = z.iso.date();
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const timezone = z.string().refine((value) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
});
export const ReturnChecklistItemSchema = z.strictObject({
  code: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(300),
  group: z.enum(RETURN_CHECKLIST_GROUPS),
  serious: z.boolean(),
});
export const ConfigureReturnChecklistSchema = z
  .strictObject({
    expectedVersion: version,
    items: z.array(ReturnChecklistItemSchema).min(4).max(100),
  })
  .refine(
    (input) =>
      new Set(input.items.map((i) => i.code)).size === input.items.length &&
      RETURN_CHECKLIST_GROUPS.every((group) => input.items.some((i) => i.group === group)),
    m.duplicateItems,
  );
export type ConfigureReturnChecklist = z.infer<typeof ConfigureReturnChecklistSchema>;
export type ReturnChecklistItem = z.infer<typeof ReturnChecklistItemSchema>;
export const ConfigureReturnCalendarSchema = z.strictObject({
  expectedVersion: version,
  timezone,
  holidays: z.array(date),
  reminderTime: time,
  operatingHours: z
    .array(
      z
        .strictObject({
          dayOfWeek: z.number().int().min(0).max(6),
          openTime: time,
          closeTime: time,
        })
        .refine((hours) => hours.openTime < hours.closeTime, m.invalidSlot),
    )
    .max(7)
    .refine((hours) => new Set(hours.map((h) => h.dayOfWeek)).size === hours.length, m.invalidSlot)
    .optional(),
});
export type ConfigureReturnCalendar = z.infer<typeof ConfigureReturnCalendarSchema>;
export const ConfigureOverdueRateSchema = z.strictObject({
  expectedVersion: version,
  rate: z.number().int().min(0).max(100),
});
export type ConfigureOverdueRate = z.infer<typeof ConfigureOverdueRateSchema>;
export const ReturnFacilityParamsSchema = z.object({ facilityId: z.uuid() });
export const ReturnRentalParamsSchema = z.object({ rentalId: z.uuid() });
export const ReturnRequestParamsSchema = z.object({ requestId: z.uuid() });
export const ReturnInspectionParamsSchema = z.object({
  requestId: z.uuid(),
  inspectionId: z.uuid(),
});
export const ReturnPhotoParamsSchema = ReturnInspectionParamsSchema.extend({ photoId: z.uuid() });
export const ReturnTimeChangeParamsSchema = z.object({ requestId: z.uuid(), changeId: z.uuid() });
export const ReturnVersionSchema = z.strictObject({ expectedVersion: version });
export type ReturnVersion = z.infer<typeof ReturnVersionSchema>;
export const CreateReturnRequestSchema = z.strictObject({ date, slotId: z.uuid(), reason });
export type CreateReturnRequest = z.infer<typeof CreateReturnRequestSchema>;
export const EditReturnRequestSchema = CreateReturnRequestSchema.extend({
  expectedVersion: version,
});
export const AssignReturnStaffSchema = z.strictObject({
  expectedVersion: version,
  staffId: z.uuid(),
  reason,
});
export type AssignReturnStaff = z.infer<typeof AssignReturnStaffSchema>;
export const RecordPhysicalReturnSchema = z.strictObject({
  expectedVersion: version,
  actualReturnAt: z.iso.datetime({ offset: true }),
  reason,
});
export type RecordPhysicalReturn = z.infer<typeof RecordPhysicalReturnSchema>;
export const ProposeReturnTimeSchema = RecordPhysicalReturnSchema.extend({
  evidencePhotoIds: z.array(z.uuid()).min(1).max(5),
  idempotencyKey: z.uuid(),
});
export const DecideReturnTimeSchema = z.strictObject({
  expectedVersion: version,
  approve: z.boolean(),
  reason,
});
export type ProposeReturnTime = z.infer<typeof ProposeReturnTimeSchema>;
export const ReturnChecklistResultSchema = z.strictObject({
  code: z.string().trim().min(1),
  issue: z.boolean(),
  note: z.string().trim().max(4000),
  photoIds: z.array(z.uuid()).max(5),
});
export type ReturnChecklistResult = z.infer<typeof ReturnChecklistResultSchema>;
export const SaveReturnInspectionSchema = z.strictObject({
  expectedVersion: version,
  results: z.array(ReturnChecklistResultSchema).max(100),
  propertyDisposition: z.enum(["NONE", "RESOLVED", "STORED"]),
  propertyReceiver: z.string().trim().max(300).nullable(),
  propertyHandledAt: z.iso.datetime({ offset: true }).nullable(),
  propertyEvidencePhotoIds: z.array(z.uuid()).max(5),
});
export type SaveReturnInspection = z.infer<typeof SaveReturnInspectionSchema>;
export const ReturnPhotoInputSchema = z.strictObject({
  expectedVersion: version,
  filename: z.string().trim().min(1).max(120),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  dataBase64: z.string().min(1).max(4194304),
});
export type ReturnPhotoInput = z.infer<typeof ReturnPhotoInputSchema>;
export const ReturnEvidenceInputSchema = ReturnPhotoInputSchema.extend({
  purpose: z.enum(["TIME_CORRECTION", "REFUND"]),
});
export const ReturnPropertySchema = SaveReturnInspectionSchema.omit({ results: true });
export const ReturnEvidenceParamsSchema = z.object({ requestId: z.uuid(), photoId: z.uuid() });
export const SettleReturnSchema = z.strictObject({
  expectedVersion: version,
  damageAmount: money,
  unusedRentRefundAmount: money.refine((value) => BigInt(value) === 0n, m.noEarlyRentRefund),
  reason,
});
export type SettleReturn = z.infer<typeof SettleReturnSchema>;
export const ConfirmReturnRefundSchema = z.strictObject({
  expectedVersion: version,
  amount: money.refine((v) => BigInt(v) > 0n, m.invalidMoney),
  depositRefundAmount: money.optional(),
  rentRefundAmount: money.optional(),
  reference: z.string().trim().min(1).max(128),
  evidencePhotoIds: z.array(z.uuid()).min(1).max(5),
  idempotencyKey: z.uuid(),
});
export type ConfirmReturnRefund = z.infer<typeof ConfirmReturnRefundSchema>;
export type ReturnEvidenceInput = z.infer<typeof ReturnEvidenceInputSchema>;
export const ReturnSlotsQuerySchema = z.object({ date });

export const ReturnQueueQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().nonnegative().default(0),
    status: z.enum(ReturnRequestStatus).optional(),
    fromDate: date.optional(),
    toDate: date.optional(),
  })
  .refine((query) => !query.fromDate || !query.toDate || query.fromDate <= query.toDate, {
    message: m.invalidDateRange,
    path: ["toDate"],
  });
export type ReturnQueueQuery = z.infer<typeof ReturnQueueQuerySchema>;

// Response schemas keep the documented contract aligned with HTTP serialization.
const responseMoney = money.meta({ example: "1000000" });
const iso = z.iso.datetime({ offset: true });
const photoResponse = z.object({
  id: z.uuid(),
  filename: z.string(),
  mimeType: z.string(),
  byteSize: z.number(),
});
export const ReturnOperationalContextSchema = z.object({
  booking: z.object({ id: z.uuid(), bookingCode: z.string().nullable() }),
  customer: z.object({
    id: z.string().nullable(),
    name: z.string().nullable(),
    phone: z.string().nullable(),
  }),
  rental: z.object({
    id: z.uuid(),
    status: z.string(),
    expectedEndAt: iso,
    depositSnapshot: responseMoney,
  }),
  unit: z.object({
    id: z.uuid(),
    code: z.string(),
    unitTypeName: z.string(),
    sizeLabel: z.string(),
  }),
  facility: z.object({ id: z.uuid(), name: z.string() }),
  assignedStaff: z.object({ id: z.string(), name: z.string() }).nullable(),
});
export const ReturnRefundSummarySchema = z.object({
  refundEntitlement: responseMoney,
  remainingRefund: responseMoney,
  remainingDepositRefund: responseMoney.nullable(),
  remainingRentRefund: responseMoney.nullable(),
  confirmedDepositRefund: responseMoney.nullable(),
  confirmedRentRefund: responseMoney.nullable(),
  allocationKnown: z.boolean(),
});
const requestResponse = z.object({
  id: z.uuid(),
  rentalId: z.uuid(),
  facilityId: z.uuid(),
  status: z.string(),
  version: z.number(),
  assignedStaffId: z.string().nullable(),
  startsAt: iso,
  endsAt: iso,
  timezone: z.string(),
  reason: z.string(),
  manualReviewRequired: z.boolean(),
  createdAt: iso,
});
export const ReturnSettlementResponseSchema = z.object({
  id: z.uuid(),
  requestId: z.uuid(),
  revision: z.number(),
  depositSnapshot: responseMoney,
  rateSnapshot: z.number(),
  overdueFeeAmount: responseMoney,
  damageAmount: responseMoney,
  unusedRentRefundAmount: responseMoney,
  refundEntitlement: responseMoney,
  debtAmount: responseMoney,
  remainingRefund: responseMoney,
  actualReturnAt: iso,
  refundDueDate: z.iso.date(),
  approvedBy: z.string(),
  approvedAt: iso,
});
export const ReturnSettlementBlockerCode = {
  REQUEST_NOT_INSPECTING: "REQUEST_NOT_INSPECTING",
  INSPECTION_NOT_PASSED: "INSPECTION_NOT_PASSED",
  ACTUAL_RETURN_MISSING: "ACTUAL_RETURN_MISSING",
  RENTAL_CLOSED: "RENTAL_CLOSED",
  PROPERTY_UNRESOLVED: "PROPERTY_UNRESOLVED",
  EVIDENCE_INVALID: "EVIDENCE_INVALID",
  DAMAGE_EVIDENCE_MISSING: "DAMAGE_EVIDENCE_MISSING",
  CONFIGURATION_MISSING: "CONFIGURATION_MISSING",
} as const;
export const ReturnSettlementPreviewSchema = z.object({
  requestId: z.uuid(),
  version: z.number(),
  canClose: z.boolean(),
  blockingReasons: z.array(
    z.object({ code: z.enum(ReturnSettlementBlockerCode), message: z.string() }),
  ),
  calculation: ReturnRefundSummarySchema.extend({
    depositSnapshot: responseMoney,
    rateSnapshot: z.number(),
    overdueFeeAmount: responseMoney,
    damageAmount: responseMoney,
    unusedRentRefundAmount: responseMoney,
    debtAmount: responseMoney,
  }).nullable(),
});
export const ReturnRefundResponseSchema = z.object({
  id: z.uuid(),
  amount: responseMoney,
  depositRefundAmount: responseMoney.nullable(),
  rentRefundAmount: responseMoney.nullable(),
  reference: z.string(),
  confirmedBy: z.string(),
  confirmedAt: iso,
  settlementId: z.uuid(),
});
export const ReturnRequestDetailSchema = z.object({
  request: requestResponse,
  context: ReturnOperationalContextSchema.nullable(),
  refundSummary: ReturnRefundSummarySchema.nullable(),
  actualReturnAt: iso.nullable(),
  inspections: z.array(
    z.object({
      id: z.uuid(),
      requestId: z.uuid(),
      attempt: z.number(),
      status: z.string(),
      version: z.number(),
      checklistVersionId: z.uuid(),
      definition: z.array(ReturnChecklistItemSchema),
      results: z.array(ReturnChecklistResultSchema),
      propertyDisposition: z.string(),
      propertyReceiver: z.string().nullable(),
      propertyHandledAt: iso.nullable(),
      propertyEvidencePhotoIds: z.array(z.uuid()),
      createdBy: z.string(),
      completedBy: z.string().nullable(),
      completedAt: iso.nullable(),
      createdAt: iso,
      photos: z.array(photoResponse),
    }),
  ),
  evidence: z.array(photoResponse.extend({ purpose: z.string() })),
  settlements: z.array(ReturnSettlementResponseSchema),
  timeChanges: z.array(
    z.object({
      id: z.uuid(),
      previousAt: iso.nullable(),
      proposedAt: iso,
      status: z.string(),
      reason: z.string(),
      proposedBy: z.string(),
      decidedBy: z.string().nullable(),
      decidedAt: iso.nullable(),
      decisionReason: z.string().nullable(),
      evidencePhotoIds: z.array(z.uuid()),
      createdAt: iso,
    }),
  ),
  refunds: z.array(ReturnRefundResponseSchema),
  audit: z.array(
    z.object({
      id: z.uuid(),
      action: z.string(),
      actorId: z.string().nullable(),
      details: z.unknown(),
      createdAt: iso,
    }),
  ),
});
export const ReturnQueueResponseSchema = z.array(
  requestResponse.extend({ context: ReturnOperationalContextSchema }),
);
export const ConfirmReturnRefundResponseSchema = z.object({
  id: z.uuid(),
  amount: responseMoney,
  confirmedAt: iso,
  version: z.number(),
  refundSummary: ReturnRefundSummarySchema,
});
export const ReturnQueueEnvelopeSchema = z.object({
  success: z.literal(true),
  data: ReturnQueueResponseSchema,
  timestamp: iso,
  message: z.string().optional(),
});
export const ReturnDetailEnvelopeSchema = ReturnQueueEnvelopeSchema.extend({
  data: ReturnRequestDetailSchema,
});
export const ReturnPreviewEnvelopeSchema = ReturnQueueEnvelopeSchema.extend({
  data: ReturnSettlementPreviewSchema,
});
export const ReturnSettlementEnvelopeSchema = ReturnQueueEnvelopeSchema.extend({
  data: ReturnSettlementResponseSchema,
});
export const ReturnRefundEnvelopeSchema = ReturnQueueEnvelopeSchema.extend({
  data: ConfirmReturnRefundResponseSchema,
});
