import type { ReturnChecklistItem, ReturnChecklistResult } from "./returns";

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
