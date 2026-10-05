import { z } from "zod";
import { INSPECTION_MESSAGES } from "./inspections.messages";

export const INSPECTION_PHOTO_MAX_BYTES = 3 * 1024 * 1024;
export const INSPECTION_PHOTO_MAX_COUNT = 8;
export const InspectionDraftInputSchema = z.object({
  version: z.number().int().nonnegative(),
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
export type Inspection = z.infer<typeof InspectionSchema>;
