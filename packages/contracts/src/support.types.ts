import type { z } from "zod";
import type {
  SupportAttachmentSchema,
  SupportCreateInputSchema,
  SupportDetailSchema,
  SupportImageInputSchema,
  SupportImageResultSchema,
  SupportMessagePageSchema,
  SupportMessageSchema,
  SupportPageQuerySchema,
  SupportReplyInputSchema,
  SupportReplyResultSchema,
  SupportTicketPageSchema,
  SupportTicketQuerySchema,
  SupportTicketSchema,
} from "./support";

export type SupportCreateInput = z.infer<typeof SupportCreateInputSchema>;
export type SupportReplyInput = z.infer<typeof SupportReplyInputSchema>;
export type SupportImageInput = z.infer<typeof SupportImageInputSchema>;
export type SupportTicketQuery = z.infer<typeof SupportTicketQuerySchema>;
export type SupportPageQuery = z.infer<typeof SupportPageQuerySchema>;
export type SupportTicketDto = z.infer<typeof SupportTicketSchema>;
export type SupportMessageDto = z.infer<typeof SupportMessageSchema>;
export type SupportAttachmentDto = z.infer<typeof SupportAttachmentSchema>;
export type SupportTicketPage = z.infer<typeof SupportTicketPageSchema>;
export type SupportMessagePage = z.infer<typeof SupportMessagePageSchema>;
export type SupportDetail = z.infer<typeof SupportDetailSchema>;
export type SupportReplyResult = z.infer<typeof SupportReplyResultSchema>;
export type SupportImageResult = z.infer<typeof SupportImageResultSchema>;
