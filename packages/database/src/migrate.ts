import { fileURLToPath } from "node:url";
import { desc, sql } from "drizzle-orm";
import { type MigrationMeta, readMigrationFiles } from "drizzle-orm/migrator";
import { bigint, pgSchema, serial, text } from "drizzle-orm/pg-core";
import { type Database, db, queryClient } from "./client";

import {
  finishRentalReset,
  prepareRentalReset,
  RENTAL_RESET_TIMESTAMP,
  rentalResetStatements,
} from "./rental-reset-migration";

const journal = pgSchema("drizzle").table("__drizzle_migrations", {
  id: serial().primaryKey(),
  hash: text().notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export async function applyMigrations(database: Database, migrations: MigrationMeta[]) {
  return database.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(420218, 1)`);
    await tx.execute(sql`create schema if not exists drizzle`);
    await tx.execute(
      sql`create table if not exists drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint not null)`,
    );

    const appliedMigrations = await tx
      .select({ hash: journal.hash, createdAt: journal.createdAt })
      .from(journal)
      .orderBy(desc(journal.createdAt));
    const appliedHashes = new Set(appliedMigrations.map((migration) => migration.hash));
    let latestTimestamp = Number(appliedMigrations[0]?.createdAt ?? 0);
    let applied = 0;

    for (const migration of migrations) {
      if (appliedHashes.has(migration.hash) || latestTimestamp >= migration.folderMillis) continue;

      const isRentalReset = migration.folderMillis === RENTAL_RESET_TIMESTAMP;
      if (isRentalReset) await prepareRentalReset(tx);
      const statements = isRentalReset ? rentalResetStatements(migration.sql) : migration.sql;
      for (const statement of statements) await tx.execute(sql.raw(statement));
      if (isRentalReset) await finishRentalReset(tx);
      await tx.insert(journal).values({ hash: migration.hash, createdAt: migration.folderMillis });
      appliedHashes.add(migration.hash);
      latestTimestamp = migration.folderMillis;
      applied++;
    }

    return applied;
  });
}

if (import.meta.main) {
  try {
    const count = await applyMigrations(
      db,
      readMigrationFiles({
        migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)),
      }),
    );
    console.log(`Applied ${count} migrations.`);
  } catch (error) {
    console.error("Database migration failed; transaction rolled back:", error);
    process.exitCode = 1;
  } finally {
    await queryClient.end();
  }
}
