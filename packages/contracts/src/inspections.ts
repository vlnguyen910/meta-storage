import { z } from "zod";
import { HANDOVER_CHECKLIST_ITEMS, HandoverChecklistItemResultSchema } from "./handover-checklist";
import { INSPECTION_MESSAGES } from "./inspections.messages";
import type { InspectionChecklistData } from "./inspections.types";

export const INSPECTION_PHOTO_MAX_BYTES = 3 * 1024 * 1024;
export const INSPECTION_PHOTO_MAX_COUNT = 8;
export const INSPECTION_CHECKLIST_VERSION = "H6_4PASS_V1";
const draftResults = z
  .array(HandoverChecklistItemResultSchema)
  .max(4)
  .superRefine((results, ctx) => {
    const seen = new Set<string>();
    for (const result of results) {
      if (
        seen.has(result.itemCode) ||
        result.resultType !== "PASS_FAIL" ||
        !HANDOVER_CHECKLIST_ITEMS.some((item) => item.code === result.itemCode)
      ) {
        ctx.addIssue({ code: "custom", message: INSPECTION_MESSAGES.invalidResults });
      }
      seen.add(result.itemCode);
    }
  });
export const InspectionDraftInputSchema = z.object({
  version: z.number().int().nonnegative(),
  results: draftResults.optional(),
  correctUnit: z.boolean().nullable(),
  conditionNotes: z.string().max(4000, INSPECTION_MESSAGES.notesLimit),
});
export type InspectionDraftInput = z.infer<typeof InspectionDraftInputSchema>;
export const InspectionVersionInputSchema = z.object({ version: z.number().int().nonnegative() });
export const InspectionPhotoInputSchema = InspectionVersionInputSchema.extend({
  filename: z.string().trim().min(1).max(120),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  dataBase64: z
    .string()
    .min(1)
    .max(Math.ceil(INSPECTION_PHOTO_MAX_BYTES / 3) * 4),
});
export type InspectionPhotoInput = z.infer<typeof InspectionPhotoInputSchema>;
export const InspectionPhotoSchema = z.object({
  id: z.string().uuid(),
  filename: z.string(),
  mimeType: z.string(),
  byteSize: z.number(),
  createdAt: z.string().datetime(),
});
export type InspectionPhoto = z.infer<typeof InspectionPhotoSchema>;
export const InspectionPhotoContentSchema = InspectionPhotoSchema.extend({
  dataBase64: z.string().optional(),
  url: z.string().url().optional(),
}).refine((photo) => Boolean(photo.dataBase64 || photo.url));
export type InspectionPhotoContent = z.infer<typeof InspectionPhotoContentSchema>;
export const InspectionSchema = z.object({
  id: z.string().uuid(),
  bookingId: z.string().uuid(),
  facilityId: z.string().uuid(),
  physicalUnitId: z.string().uuid(),
  unitCode: z.string(),
  unitAssignmentId: z.string().uuid(),
  verificationId: z.string().uuid(),
  policyVersion: z.literal("H6_V1"),
  status: z.enum(["DRAFT", "COMPLETED"]),
  version: z.number().int(),
  correctUnit: z.boolean().nullable(),
  conditionNotes: z.string(),
  createdBy: z.string().uuid(),
  completedBy: z.string().uuid().nullable(),
  completedByName: z.string().nullable().optional(),
  handedOverByName: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  handedOverAt: z.string().datetime().nullable().optional(),
  handedOverBy: z.string().uuid().nullable().optional(),
  photos: z.array(InspectionPhotoSchema),
});
export type Inspection = z.infer<typeof InspectionSchema> & InspectionChecklistData;

export const InspectionTypeValueSchema = z.enum(["CHECK_IN", "CHECK_OUT", "MAINTENANCE"]);
export const InspectionStatusValueSchema = z.enum(["PENDING", "IN_PROGRESS", "PASSED", "FAILED"]);
export const InspectionConditionValueSchema = z.enum(["GOOD", "MINOR_DAMAGE", "MAJOR_DAMAGE"]);

export const CreateInspectionInputSchema = z.object({ taskId: z.string().uuid() }).strict();
export type CreateInspectionInput = z.infer<typeof CreateInspectionInputSchema>;

export const InspectionListQuerySchema = z
  .object({
    status: InspectionStatusValueSchema.optional(),
    inspectionType: InspectionTypeValueSchema.optional(),
    storageUnitId: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();
export type InspectionListQuery = z.infer<typeof InspectionListQuerySchema>;

export const InspectionEvidenceInputSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  dataBase64: z
    .string()
    .min(1)
    .max(Math.ceil(INSPECTION_PHOTO_MAX_BYTES / 3) * 4),
});

export const UpdateInspectionInputSchema = z
  .object({
    status: InspectionStatusValueSchema.optional(),
    condition: InspectionConditionValueSchema.nullable().optional(),
    checklist: z.record(z.string(), z.unknown()).optional(),
    notes: z.string().max(4000, INSPECTION_MESSAGES.notesLimit).nullable().optional(),
    addEvidence: z.array(InspectionEvidenceInputSchema).max(1).optional(),
    removeEvidenceIds: z.array(z.string().uuid()).max(INSPECTION_PHOTO_MAX_COUNT).optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0);
export type UpdateInspectionInput = z.infer<typeof UpdateInspectionInputSchema>;

export const InspectionRecordSchema = z.object({
  id: z.string().uuid(),
  storageUnitId: z.string().uuid(),
  unitCode: z.string(),
  rentalId: z.string().uuid().nullable(),
  bookingId: z.string().uuid().nullable(),
  inspectedBy: z.string().uuid(),
  taskId: z.string().uuid(),
  facilityId: z.string().uuid(),
  inspectionType: InspectionTypeValueSchema,
  status: InspectionStatusValueSchema,
  condition: InspectionConditionValueSchema.nullable(),
  checklist: z.record(z.string(), z.unknown()),
  notes: z.string().nullable(),
  inspectedAt: z.string().datetime().nullable(),
  inspectDoneAt: z.string().datetime().nullable(),
  evidence: z.array(InspectionPhotoSchema.extend({ url: z.string().url() })),
});
export type InspectionRecord = z.infer<typeof InspectionRecordSchema>;
export const InspectionListItemSchema = InspectionRecordSchema.omit({ evidence: true });
export const InspectionPageSchema = z.object({
  items: z.array(InspectionListItemSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});
export type InspectionPage = z.infer<typeof InspectionPageSchema>;
