import type { Database, handoverInspections } from "@metastorage/database";
import type { ContractStorage } from "../contracts/contracts.types";

export type InspectionTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type InspectionRow = typeof handoverInspections.$inferSelect;
export type NewInspectionRow = typeof handoverInspections.$inferInsert;

export interface InspectionsRoutesOptions {
  contractStorage?: ContractStorage;
}
