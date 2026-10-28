import { z } from "zod";

export { RenewalStatus } from "@metastorage/database/schema-domain";
export { RENEWAL_MESSAGES } from "./renewals.messages";
export type * from "./renewals.types";

export const RenewalRentalParamsSchema = z.object({ rentalId: z.uuid() });
export const RenewalParamsSchema = z.object({ renewalId: z.uuid() });
export const QuoteRenewalSchema = z.strictObject({
  months: z.number().int().min(1).max(12),
  idempotencyKey: z.string().trim().min(16).max(128),
});
export type QuoteRenewal = z.infer<typeof QuoteRenewalSchema>;
export const AcceptRenewalSchema = z.strictObject({
  acceptedTerms: z.literal(true),
  termsVersion: z.string().min(1).max(128),
});
export type AcceptRenewal = z.infer<typeof AcceptRenewalSchema>;
export const RenewalPageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type RenewalPageQuery = z.infer<typeof RenewalPageQuerySchema>;
