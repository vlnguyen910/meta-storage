import { queryClient } from "./client";

async function clear() {
  const existingTables = await queryClient<{ tablename: string }[]>`
    SELECT tablename
    FROM pg_catalog.pg_tables
    WHERE schemaname = 'public' AND tablename <> '__drizzle_migrations'
  `;
  const tableNames = existingTables.map((table) => table.tablename);

  console.log("Clearing all application data, including users and sessions...");
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
