import { z } from "zod";
import { HANDOVER_CHECKLIST_ITEMS, HandoverChecklistItemResultSchema } from "./handover-checklist";
import { INSPECTION_MESSAGES } from "./inspections.messages";
import type { InspectionChecklistData } from "./inspections.types";
import { ManualPaymentInputSchema } from "./payments";

export const PolicyViolationFeeSchema = z.strictObject({
  code: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[A-Z0-9_]+$/),
  name: z.string().trim().min(1).max(200),
  amount: z.number().int().nonnegative().max(2_147_483_647),
  isActive: z.boolean(),
});
export type PolicyViolationFee = z.infer<typeof PolicyViolationFeeSchema>;
export const PolicyViolationFeeCatalogSchema = z.object({
  version: z.number().int().nonnegative(),
  items: z.array(PolicyViolationFeeSchema),
});
export const UpdatePolicyViolationFeeCatalogSchema = z.strictObject({
  expectedVersion: z.number().int().nonnegative().max(2_147_483_646),
  items: z
    .array(PolicyViolationFeeSchema)
    .max(100)
    .superRefine((items, ctx) => {
      const codes = new Set<string>();
      items.forEach((item, index) => {
        if (codes.has(item.code))
          ctx.addIssue({
            code: "custom",
            path: [index, "code"],
            message: INSPECTION_MESSAGES.duplicateViolationCode,
          });
        codes.add(item.code);
      });
    }),
});
export type UpdatePolicyViolationFeeCatalog = z.infer<typeof UpdatePolicyViolationFeeCatalogSchema>;
const InspectionViolationInputSchema = z.strictObject({
  code: z.string().trim().min(1).max(64),
  note: z.string().trim().max(1000).optional(),
});

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

export const CreateInspectionInputSchema = z
  .object({ taskId: z.string().uuid(), storageUnitId: z.string().uuid().optional() })
  .strict();
export type CreateInspectionInput = z.infer<typeof CreateInspectionInputSchema>;

export const InspectionListQuerySchema = z
  .object({
    settlement: z
      .strictObject({
        confirmed: z.literal(true),
        deductionAmount: z.number().int().nonnegative(),
        refund: ManualPaymentInputSchema.optional(),
      })
      .optional(),
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
export type InspectionEvidenceInput = z.infer<typeof InspectionEvidenceInputSchema>;

export const ConfirmInspectionHandoverInputSchema = z.object({
  customerReceivedUnit: z.literal(true),
});
export type ConfirmInspectionHandoverInput = z.infer<typeof ConfirmInspectionHandoverInputSchema>;

export const UpdateInspectionInputSchema = z
  .object({
    settlement: z
      .strictObject({
        confirmed: z.literal(true),
        deductionAmount: z.number().int().nonnegative(),
        refund: ManualPaymentInputSchema.optional(),
      })
      .optional(),
    status: InspectionStatusValueSchema.optional(),
    condition: InspectionConditionValueSchema.nullable().optional(),
    checklist: z.record(z.string(), z.unknown()).optional(),
    notes: z.string().max(4000, INSPECTION_MESSAGES.notesLimit).nullable().optional(),
    addEvidence: z.array(InspectionEvidenceInputSchema).max(1).optional(),
    removeEvidenceIds: z.array(z.string().uuid()).max(INSPECTION_PHOTO_MAX_COUNT).optional(),
    violations: z.array(InspectionViolationInputSchema).max(100).optional(),
    policyVersion: z.number().int().nonnegative().optional(),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (input.violations !== undefined && input.policyVersion === undefined)
      ctx.addIssue({
        code: "custom",
        path: ["policyVersion"],
        message: INSPECTION_MESSAGES.policyVersionRequired,
      });
    const seen = new Set<string>();
    input.violations?.forEach((item, index) => {
      if (seen.has(item.code))
        ctx.addIssue({
          code: "custom",
          path: ["violations", index, "code"],
          message: INSPECTION_MESSAGES.duplicateViolationCode,
        });
      seen.add(item.code);
    });
  })
  .refine((input) => Object.keys(input).length > 0);
export type UpdateInspectionInput = z.infer<typeof UpdateInspectionInputSchema>;

export const InspectionRecordSchema = z.object({
  id: z.string().uuid(),
  storageUnitId: z.string().uuid(),
  unitCode: z.string(),
  rentalId: z.string().uuid().nullable(),
  reservationId: z.string().uuid().nullable(),
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
  returnContext: z
    .object({
      depositAmount: z.number().int().nonnegative(),
      deductionAmount: z.number().int().nonnegative().optional(),
      refundAmount: z.number().int().nonnegative().optional(),
      debtAmount: z.number().int().nonnegative().optional(),
      policyVersion: z.number().int().nonnegative(),
      penalties: z.array(
        z.object({ code: z.string(), name: z.string(), amount: z.number().int().nonnegative() }),
      ),
      fees: z.array(
        z.object({
          code: z.string(),
          name: z.string(),
          amount: z.number().int().nonnegative(),
          note: z.string().nullable(),
        }),
      ),
      checkIn: z
        .object({
          condition: InspectionConditionValueSchema.nullable(),
          checklist: z.record(z.string(), z.unknown()),
          notes: z.string().nullable(),
          inspectedAt: z.string().datetime().nullable(),
        })
        .nullable(),
    })
    .optional(),
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
