import { fileURLToPath } from "node:url";
import { desc, sql } from "drizzle-orm";
import { type MigrationMeta, readMigrationFiles } from "drizzle-orm/migrator";
import { bigint, pgSchema, serial, text } from "drizzle-orm/pg-core";
import { type Database, db, queryClient } from "./client";
import { migrateBookingsToReservations } from "./migrate-bookings-to-reservations";

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
  const committedEnumStatements = await database.transaction(async (tx) => {
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
    const committed = new Set<string>();
    for (const migration of migrations) {
      if (appliedHashes.has(migration.hash) || latestTimestamp >= migration.folderMillis) continue;
      for (const statement of migration.sql) {
        // Drizzle emits quoted enum names. Existing enums need a commit before DDL uses new values.
        const addition = statement.match(
          /^\s*ALTER TYPE\s+("[^"]+"(?:\."[^"]+")?)\s+ADD VALUE\s+(?:IF NOT EXISTS\s+)?/i,
        );
        if (!addition) continue;
        const [existing] = await tx.execute(sql`select to_regtype(${addition[1]}) as name`);
        if (!existing?.name) continue;
        await tx.execute(
          sql.raw(
            statement.replace(addition[0], `ALTER TYPE ${addition[1]} ADD VALUE IF NOT EXISTS `),
          ),
        );
        committed.add(statement);
      }
      latestTimestamp = migration.folderMillis;
    }
    return committed;
  });

  return database.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(420218, 1)`);
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
      for (const statement of statements) {
        if (!committedEnumStatements.has(statement)) await tx.execute(sql.raw(statement));
      }
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
    const { converted } = await db.transaction(migrateBookingsToReservations);
    console.log(`Applied ${count} schema migrations; converted ${converted} historical bookings.`);
  } catch (error) {
    console.error(
      "Database migration failed; the failing phase rolled back. Retry after resolving the error:",
      error,
    );
    process.exitCode = 1;
  } finally {
    await queryClient.end();
  }
}
