import type { z } from "zod";
import type {
  ConfirmReturnRefundResponseSchema,
  ReturnChecklistItem,
  ReturnChecklistResult,
  ReturnOperationalContextSchema,
  ReturnRefundResponseSchema,
  ReturnRefundSummarySchema,
  ReturnRequestDetailSchema,
  ReturnSettlementPreviewSchema,
} from "./returns";

export interface ReturnActor {
  id: string;
  role: string | null | undefined;
}
export interface ReturnRequestDto {
  id: string;
  rentalId: string;
  facilityId: string;
  status: string;
  version: number;
  assignedStaffId: string | null;
  startsAt: string;
  endsAt: string;
  timezone: string;
  reason: string;
  manualReviewRequired: boolean;
  createdAt: string;
}
export interface ReturnSlotDto {
  slotId: string;
  date: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
}
export interface ReturnPhotoDto {
  id: string;
  filename: string;
  mimeType: string;
  byteSize: number;
}
export interface ReturnInspectionDetailDto extends ReturnInspectionDto {
  photos: ReturnPhotoDto[];
}
export interface ReturnSettlementDetailDto extends ReturnSettlementDto {}
export interface ReturnTimeChangeDto {
  id: string;
  previousAt: string | null;
  proposedAt: string;
  status: string;
  reason: string;
  proposedBy: string;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionReason: string | null;
  evidencePhotoIds: string[];
  createdAt: string;
}
export interface ReturnEvidencePhotoDto {
  id: string;
  filename: string;
  mimeType: string;
  purpose: string;
}
export interface ReturnChecklistVersionDto {
  id: string;
  version: number;
  items: ReturnChecklistItem[];
  createdAt: string;
}
export interface ReturnInspectionDto {
  id: string;
  requestId: string;
  attempt: number;
  status: string;
  version: number;
  checklistVersionId: string;
  definition: ReturnChecklistItem[];
  results: ReturnChecklistResult[];
  propertyDisposition: string;
  propertyReceiver: string | null;
  propertyHandledAt: string | null;
  propertyEvidencePhotoIds: string[];
  createdBy: string;
  completedBy: string | null;
  completedAt: string | null;
  createdAt: string;
}
export interface ReturnSettlementDto {
  id: string;
  requestId: string;
  revision: number;
  depositSnapshot: string;
  rateSnapshot: number;
  overdueFeeAmount: string;
  damageAmount: string;
  unusedRentRefundAmount: string;
  refundEntitlement: string;
  debtAmount: string;
  remainingRefund: string;
  actualReturnAt: string;
  refundDueDate: string;
  approvedBy: string;
  approvedAt: string;
}

export type ReturnOperationalContextDto = z.infer<typeof ReturnOperationalContextSchema>;
export type ReturnQueueItemDto = ReturnRequestDto & { context: ReturnOperationalContextDto };
export type ReturnRefundSummaryDto = z.infer<typeof ReturnRefundSummarySchema>;
export type ReturnSettlementPreviewDto = z.infer<typeof ReturnSettlementPreviewSchema>;
export type ReturnRequestDetailDto = z.infer<typeof ReturnRequestDetailSchema>;
export type ReturnRefundDto = z.infer<typeof ReturnRefundResponseSchema>;
export type ConfirmReturnRefundDto = z.infer<typeof ConfirmReturnRefundResponseSchema>;
