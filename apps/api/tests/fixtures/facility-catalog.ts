import { randomUUID } from "node:crypto";
import {
  and,
  type Database,
  eq,
  inArray,
  type NewUnitType,
  notExists,
  rentalPriceRanges,
  type SQL,
  unitTypes,
} from "@metastorage/database";

type Executor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

export async function createTestUnitType(
  executor: Executor,
  input: Omit<NewUnitType, "priceRangeId"> & { priceRangeId?: string },
) {
  const id = input.id ?? randomUUID(),
    priceRangeId = input.priceRangeId ?? id;
  // Explicit test-only bounds keep unrelated fixture scenarios independent of BOM setup.
  await executor
    .insert(rentalPriceRanges)
    .values({
      id: priceRangeId,
      code: `TEST-${priceRangeId}`,
      name: input.name,
      minMonthlyPrice: 1,
      maxMonthlyPrice: 2147483647,
    })
    .onConflictDoNothing();
  await executor
    .insert(unitTypes)
    .values({ ...input, id, priceRangeId })
    .onConflictDoNothing();
}

export async function deleteTestUnitTypes(executor: Executor, filter: SQL) {
  const rows = await executor
    .select({ rangeId: unitTypes.priceRangeId })
    .from(unitTypes)
    .where(filter);
  await executor.delete(unitTypes).where(filter);
  await executor.delete(rentalPriceRanges).where(
    and(
      inArray(
        rentalPriceRanges.id,
        rows.map((row) => row.rangeId),
      ),
      notExists(
        executor
          .select({ id: unitTypes.id })
          .from(unitTypes)
          .where(eq(unitTypes.priceRangeId, rentalPriceRanges.id)),
      ),
    ),
  );
}
