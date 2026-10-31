import type { SupportAttachmentDto, SupportTicketDto } from "./support";
export interface SupportOperationsTicket extends SupportTicketDto {
  assignedStaffId: string | null;
  assignedStaffName: string | null;
  assignmentVersion: number;
  customerName: string;
  bookingCode: string | null;
  firstOnsiteStartedAt: string | null;
  firstBomResponseAt: string | null;
  latestReportId: string | null;
}
export interface SupportOperationsMessage {
  id: string;
  kind: "PUBLIC_REPLY" | "INTERNAL_NOTE" | "STAFF_REPORT";
  content: string;
  authorName: string;
  createdAt: string;
  attachments: SupportAttachmentDto[];
}
export interface SupportOperationsPage {
  items: SupportOperationsTicket[];
  total: number;
  limit: number;
  offset: number;
}
export interface SupportOperationsDetail {
  ticket: SupportOperationsTicket;
  messages: SupportOperationsMessage[];
  totalMessages: number;
  limit: number;
  offset: number;
}
