import { z } from "zod";

export { RENTAL_DOCUMENT_MESSAGES } from "./rental-documents.messages";
export type * from "./rental-documents.types";
export const RentalDocumentStatus = { UPLOADED: "UPLOADED", ISSUED: "ISSUED" } as const;
export const CONTRACT_PDF_MAX_BYTES = 20 * 1024 * 1024;
export const ContractBookingParamsSchema = z.object({ bookingId: z.uuid() });
export const ContractRentalParamsSchema = z.object({ rentalId: z.uuid() });
export const ContractDocumentParamsSchema = ContractBookingParamsSchema.extend({
  contractId: z.uuid(),
});
export const ContractUploadSchema = z.strictObject({
  filename: z.string().trim().min(1).max(200),
  mimeType: z.literal("application/pdf"),
  dataBase64: z
    .string()
    .min(1)
    .max(Math.ceil(CONTRACT_PDF_MAX_BYTES / 3) * 4),
  idempotencyKey: z.uuid(),
});
export type ContractUpload = z.infer<typeof ContractUploadSchema>;
export const ContractIssueSchema = z.strictObject({ expectedCurrentIssuedId: z.uuid().nullable() });
export type ContractIssue = z.infer<typeof ContractIssueSchema>;
export const ContractDownloadQuerySchema = z.object({
  download: z.enum(["true", "false"]).default("false"),
});
