import { randomUUID } from "node:crypto";
import { type Database, type NewUnitType, type SQL, unitTypes } from "@metastorage/database";

type Executor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];
export async function createTestUnitType(executor: Executor, input: NewUnitType) {
  await executor
    .insert(unitTypes)
    .values({ ...input, id: input.id ?? randomUUID() })
    .onConflictDoNothing();
}
export async function deleteTestUnitTypes(executor: Executor, filter: SQL) {
  await executor.delete(unitTypes).where(filter);
}
