import type {
  Database,
  SupportAttachmentRow,
  SupportTicketRow,
  supportMessages,
} from "@metastorage/database";
import type { SupportRepository } from "./support.repository";

export type SupportTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type SupportConnection = Database | SupportTransaction;
export type SupportResultReference = {
  ticketId: string;
  messageId?: string;
  attachmentId?: string;
};
export type SupportCursor = { id: string; createdAt: Date };
export type SupportMessageRecord = typeof supportMessages.$inferSelect & {
  authorName: string;
  authorRole: string | null;
};
export interface SupportImageStorage {
  put(key: string, bytes: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  remove(key: string): Promise<void>;
}
export interface SupportRoutesOptions {
  storage?: SupportImageStorage;
  repository?: SupportRepository;
}
export interface SupportImageFile {
  attachment: SupportAttachmentRow;
  bytes: Uint8Array;
}
export interface SupportMutationContext {
  ticket: SupportTicketRow;
  tx: SupportTransaction;
}
