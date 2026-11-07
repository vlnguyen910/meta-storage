import { randomUUID } from "node:crypto";
import {
  type Database,
  facilityUnitTypes,
  inArray,
  type SQL,
  unitTypes,
} from "@metastorage/database";

type Executor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];
type FixtureType = Omit<typeof unitTypes.$inferInsert, "minMonthlyPrice" | "maxMonthlyPrice"> & {
  facilityId: string;
  monthlyPrice: number;
  minMonthlyPrice?: number;
  maxMonthlyPrice?: number;
};
export async function createTestUnitType(executor: Executor, input: FixtureType) {
  const { facilityId, monthlyPrice, ...metadata } = input;
  const id = input.id ?? randomUUID();
  await executor
    .insert(unitTypes)
    .values({
      ...metadata,
      id,
      minMonthlyPrice: input.minMonthlyPrice ?? 1,
      maxMonthlyPrice: input.maxMonthlyPrice ?? 2147483647,
    })
    .onConflictDoNothing();
  await executor
    .insert(facilityUnitTypes)
    .values({
      id,
      facilityId,
      unitTypeId: id,
      monthlyPrice,
      isActive: input.isActive,
      version: input.version,
      updatedBy: input.updatedBy,
    })
    .onConflictDoNothing();
}
export async function deleteTestUnitTypes(executor: Executor, filter: SQL) {
  await executor
    .delete(facilityUnitTypes)
    .where(
      inArray(
        facilityUnitTypes.unitTypeId,
        executor.select({ id: unitTypes.id }).from(unitTypes).where(filter),
      ),
    );
  await executor.delete(unitTypes).where(filter);
}
