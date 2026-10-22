import type {
  bookings,
  Database,
  rentals,
  returnRefunds,
  returnRequests,
  returnSettlements,
} from "@metastorage/database";
import type { InspectionPhotoStorage } from "../../common/adapters/storage/photo-storage.types";

export interface ReturnsRoutesOptions {
  photoStorage?: InspectionPhotoStorage;
}

export type ReturnTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export interface ReturnContext {
  rental: typeof rentals.$inferSelect;
  booking: typeof bookings.$inferSelect;
}
export type ReturnRequestRow = typeof returnRequests.$inferSelect;

export type SettlementHistoryRow = Pick<
  typeof returnSettlements.$inferSelect,
  | "id"
  | "depositSnapshot"
  | "overdueFeeAmount"
  | "damageAmount"
  | "unusedRentRefundAmount"
  | "refundEntitlement"
>;
export type RefundAllocationRow = Pick<
  typeof returnRefunds.$inferSelect,
  "amount" | "settlementId" | "depositRefundAmount" | "rentRefundAmount"
>;
export interface SettlementCalculationInput {
  depositSnapshot: string;
  rateSnapshot: number;
  expectedEndAt: Date;
  actualReturnAt: Date;
  timezone: string;
  damageAmount: string;
  unusedRentRefundAmount: string;
  paid: bigint;
}

export type ReturnOperationalRow = Awaited<
  ReturnType<import("./returns.repository").ReturnsRepository["operationalContexts"]>
>[number];
