import { getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { queryClient } from "./client";
import * as schema from "./schema";

async function clear() {
  // A schema change can be present in code before its migration has run.
  const existingTables = await queryClient<{ tablename: string }[]>`
    SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'
  `;
  const existingTableNames = new Set(existingTables.map((table) => table.tablename));
  // Schema exports contain application tables only; migration history stays intact.
  const tableNames = Object.values(schema)
    .filter((value) => is(value, PgTable))
    .map((table) => getTableName(table))
    .filter((name) => existingTableNames.has(name));

  console.log("Clearing all application data, including users and sessions...");
  // One atomic statement handles foreign keys between all application tables.
  if (tableNames.length > 0) {
    await queryClient`TRUNCATE TABLE ${queryClient(tableNames)} RESTART IDENTITY`;
  }
  console.log("Database cleared. Run bun run db:seed to restore test data.");
}

clear()
  .catch((error) => {
    console.error("Database clear failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await queryClient.end();
  });
