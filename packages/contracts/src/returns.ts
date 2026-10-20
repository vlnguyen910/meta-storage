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
export const RecordPhysicalReturnSchema = z.strictObject({
  expectedVersion: version,
  actualReturnAt: z.iso.datetime({ offset: true }),
  reason,
});
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
export const ReturnEvidenceInputSchema = ReturnPhotoInputSchema.extend({
  purpose: z.enum(["TIME_CORRECTION", "REFUND"]),
});
export const ReturnPropertySchema = SaveReturnInspectionSchema.omit({ results: true });
export const ReturnEvidenceParamsSchema = z.object({ requestId: z.uuid(), photoId: z.uuid() });
export const SettleReturnSchema = z.strictObject({
  expectedVersion: version,
  damageAmount: money,
  unusedRentRefundAmount: money,
  reason,
});
export type SettleReturn = z.infer<typeof SettleReturnSchema>;
export const ConfirmReturnRefundSchema = z.strictObject({
  expectedVersion: version,
  amount: money.refine((v) => BigInt(v) > 0n, m.invalidMoney),
  reference: z.string().trim().min(1).max(128),
  evidencePhotoIds: z.array(z.uuid()).min(1).max(5),
  idempotencyKey: z.uuid(),
});
export type ConfirmReturnRefund = z.infer<typeof ConfirmReturnRefundSchema>;
export type ReturnEvidenceInput = z.infer<typeof ReturnEvidenceInputSchema>;
export const ReturnSlotsQuerySchema = z.object({ date });

export const ReturnQueueQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
  status: z.enum(ReturnRequestStatus).optional(),
});
export type ReturnQueueQuery = z.infer<typeof ReturnQueueQuerySchema>;
