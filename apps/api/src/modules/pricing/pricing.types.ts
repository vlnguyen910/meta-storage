import type { PricingChange } from "@metastorage/contracts";
import type { Database } from "@metastorage/database";

export type PricingTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type PricingWrite = Pick<PricingChange, "operation" | "before" | "after">;
export interface PricingRevision {
  depositMonths: number;
  version: number;
  updatedBy: string | null;
  updatedAt: Date;
}
