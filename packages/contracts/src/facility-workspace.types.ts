import type { SupportAttachmentDto, SupportTicketDto } from "./support";
export interface FacilityRentalItem {
  id: string;
  bookingId: string;
  bookingCode: string | null;
  customerId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  facilityId: string;
  unitCode: string;
  unitTypeName: string;
  status: string;
  startAt: string;
  expectedEndAt: string;
  closedAt: string | null;
  depositAmount: string;
}
export interface FacilityRentalPayment {
  id: string;
  paymentCode: string;
  status: string;
  provider: string;
  totalAmount: string;
  currency: string;
  paidAt: string | null;
  createdAt: string;
  category: string | null;
}
export interface FacilityRentalPage {
  items: FacilityRentalItem[];
  total: number;
  limit: number;
  offset: number;
}
export interface FacilityRentalDetail {
  rental: FacilityRentalItem;
  payments: FacilityRentalPayment[];
}
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
