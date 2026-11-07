import { z } from "zod";

export const CoverImageUrlSchema = z
  .string()
  .url()
  .refine((url) => url.startsWith("https://"));

export const CoverImageUploadSchema = z
  .object({
    filename: z.string().trim().min(1).max(255),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    dataBase64: z.string().min(1).max(4_194_304),
  })
  .strict();

export type CoverImageUploadInput = z.infer<typeof CoverImageUploadSchema>;

export const CoverImageUploadResultSchema = z.object({ coverUrl: CoverImageUrlSchema });
export type CoverImageUploadResult = z.infer<typeof CoverImageUploadResultSchema>;
