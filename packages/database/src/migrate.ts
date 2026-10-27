import { fileURLToPath } from "node:url";
import { SYSTEM_SETTING_DEFINITIONS } from "@metastorage/contracts/system-settings";
import { desc, eq, getTableColumns, type SQL, sql } from "drizzle-orm";
import { type MigrationMeta, readMigrationFiles } from "drizzle-orm/migrator";
import { bigint, integer, pgSchema, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { type Database, db, queryClient } from "./client";
import { removeGuestBookings } from "./migrate-account-bookings";
import { migrateFacilityUnitTypes } from "./migrate-facility-unit-types";
import { systemSettings } from "./schema/system-settings";

// Historical definitions are migration-only: never exported to the active schema.
const legacyPricing = pgTable("pricing_settings", {
  id: text().primaryKey(),
  depositMonths: integer("deposit_months").notNull(),
  version: integer().notNull(),
  updatedBy: uuid("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});
const legacyRate = pgTable("return_overdue_settings", {
  id: text().primaryKey(),
  rate: integer().notNull(),
  version: integer().notNull(),
  updatedBy: uuid("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});
const legacyLifecycle = pgTable("rental_lifecycle_settings", {
  key: text().primaryKey(),
  value: integer().notNull(),
  description: text().notNull(),
  version: integer().notNull(),
  updatedBy: uuid("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});
const journal = pgSchema("drizzle").table("__drizzle_migrations", {
  hash: text().notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export async function applyMigrations(database: Database, migrations: MigrationMeta[]) {
  // Drizzle-generated SQL cannot express the cross-table data transfer. Apply its
  // trusted migration files and the data step in ONE transaction, preserving rollback.
  return database.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(420218, 1)`);
    const presence = await tx.execute<{
      pricing: string | null;
      rate: string | null;
      lifecycle: string | null;
    }>(sql`
      select to_regclass('public.pricing_settings')::text as pricing,
             to_regclass('public.return_overdue_settings')::text as rate,
             to_regclass('public.rental_lifecycle_settings')::text as lifecycle
    `);
    // Keep PostgreSQL timestamp text during transfer to retain sub-millisecond precision.
    const originals: (Omit<typeof systemSettings.$inferInsert, "updatedAt"> & {
      updatedAt: SQL;
    })[] = [];
    if (presence[0]?.pricing) {
      const [row] = await tx
        .select({
          ...getTableColumns(legacyPricing),
          updatedAt: sql<string>`${legacyPricing.updatedAt}::text`,
        })
        .from(legacyPricing)
        .where(eq(legacyPricing.id, "default"))
        .for("update");
      if (row)
        originals.push({
          key: "DEPOSIT_MONTHS",
          value: row.depositMonths,
          description: SYSTEM_SETTING_DEFINITIONS.DEPOSIT_MONTHS.description,
          version: row.version,
          updatedBy: row.updatedBy,
          updatedAt: sql`${row.updatedAt}::timestamptz`,
        });
    }
    if (presence[0]?.rate) {
      const [row] = await tx
        .select({
          ...getTableColumns(legacyRate),
          updatedAt: sql<string>`${legacyRate.updatedAt}::text`,
        })
        .from(legacyRate)
        .where(eq(legacyRate.id, "default"))
        .for("update");
      if (row)
        originals.push({
          key: "OVERDUE_FEE_RATE",
          value: row.rate,
          description: SYSTEM_SETTING_DEFINITIONS.OVERDUE_FEE_RATE.description,
          version: row.version,
          updatedBy: row.updatedBy,
          updatedAt: sql`${row.updatedAt}::timestamptz`,
        });
    }
    if (presence[0]?.lifecycle) {
      const rows = await tx
        .select({
          ...getTableColumns(legacyLifecycle),
          updatedAt: sql<string>`${legacyLifecycle.updatedAt}::text`,
        })
        .from(legacyLifecycle)
        .for("update");
      for (const row of rows) {
        if (row.key !== "EXPIRY_REMINDER_DAYS" && row.key !== "ABANDONED_REVIEW_DAYS")
          throw new Error("Unknown legacy lifecycle key; migration requires explicit mapping");
        originals.push({ ...row, key: row.key, updatedAt: sql`${row.updatedAt}::timestamptz` });
      }
    }
    // Same journal layout and migration ordering as Drizzle's PostgreSQL migrator.
    // DDL and trusted generated statements have no query-builder equivalent.
    await tx.execute(sql`create schema if not exists drizzle`);
    await tx.execute(
      sql`create table if not exists drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint)`,
    );
    const appliedMigrations = await tx
      .select({ hash: journal.hash, createdAt: journal.createdAt })
      .from(journal)
      .orderBy(desc(journal.createdAt));
    const [last] = appliedMigrations;
    const appliedHashes = new Set(appliedMigrations.map((migration) => migration.hash));
    let applied = 0;
    for (const migration of migrations) {
      // A rebase can move a generated migration's timestamp without changing its SQL.
      if (
        appliedHashes.has(migration.hash) ||
        (last && Number(last.createdAt) >= migration.folderMillis)
      )
        continue;
      if (
        migration.sql.some((statement) =>
          statement.includes('ALTER TABLE "bookings" ALTER COLUMN "user_id" SET NOT NULL'),
        )
      )
        await removeGuestBookings(tx);
      const contractsLocalTypes = migration.sql.some((statement) =>
        statement.includes('ALTER TABLE "unit_types" ALTER COLUMN "facility_id" SET NOT NULL'),
      );
      if (contractsLocalTypes) await migrateFacilityUnitTypes(tx);
      const removesTaskReportHistory = migration.sql.some((statement) =>
        statement.includes('DROP TABLE "facility_task_reports"'),
      );
      const removesFacilitySchedules = migration.sql.some((statement) =>
        statement.includes('DROP TABLE "facility_operating_hours"'),
      );
      if (removesFacilitySchedules) {
        const [schedule] = await tx.execute<{
          rows: number;
          variants: number;
          opening: string | null;
          closing: string | null;
          timezone: string | null;
          invalid_minutes: number;
        }>(sql`
          SELECT count(*)::integer AS rows,
                 count(DISTINCT (open_time, close_time, timezone))::integer AS variants,
                 min(open_time)::text AS opening,
                 min(close_time)::text AS closing,
                 min(timezone)::text AS timezone,
                 count(*) FILTER (WHERE extract(minute FROM open_time) <> 0 OR extract(minute FROM close_time) <> 0)::integer AS invalid_minutes
          FROM facility_operating_hours
        `);
        const [coverage] = await tx.execute<{
          facilities: number;
          total_facilities: number;
          incomplete: number;
        }>(sql`
          SELECT count(DISTINCT facility_id)::integer AS facilities,
                 (SELECT count(*)::integer FROM facilities) AS total_facilities,
                 count(*) FILTER (WHERE days <> 7)::integer AS incomplete
          FROM (
            SELECT facility_id, count(DISTINCT day_of_week)::integer AS days
            FROM facility_operating_hours GROUP BY facility_id
          ) hours
        `);
        const emptyInstallation = schedule?.rows === 0 && coverage?.total_facilities === 0;
        if (
          !schedule ||
          !coverage ||
          (!emptyInstallation &&
            (schedule.rows === 0 ||
              schedule.variants !== 1 ||
              schedule.invalid_minutes !== 0 ||
              !schedule.opening ||
              !schedule.closing ||
              schedule.opening >= schedule.closing ||
              schedule.timezone !== "Asia/Ho_Chi_Minh" ||
              coverage.facilities === 0 ||
              coverage.facilities !== coverage.total_facilities ||
              coverage.incomplete !== 0))
        )
          throw new Error(
            "Facility schedules differ or are incomplete; resolve them before consolidation.",
          );
        for (const [key, value] of [
          [
            "OPENING_HOUR",
            emptyInstallation
              ? SYSTEM_SETTING_DEFINITIONS.OPENING_HOUR.defaultValue
              : Number(schedule.opening?.slice(0, 2)),
          ],
          [
            "CLOSING_HOUR",
            emptyInstallation
              ? SYSTEM_SETTING_DEFINITIONS.CLOSING_HOUR.defaultValue
              : Number(schedule.closing?.slice(0, 2)),
          ],
        ] as const) {
          const [existing] = await tx
            .select()
            .from(systemSettings)
            .where(eq(systemSettings.key, key));
          if (existing && existing.value !== value)
            throw new Error(`Existing ${key} conflicts with the shared facility schedule.`);
          if (!existing)
            await tx.insert(systemSettings).values({
              key,
              value,
              description: SYSTEM_SETTING_DEFINITIONS[key].description,
              version: 0,
            });
        }
      }
      let statements = migration.sql;
      if (removesTaskReportHistory) {
        const reportRls = migration.sql.find((statement) =>
          statement
            .trimStart()
            .startsWith('ALTER TABLE "facility_task_reports" DISABLE ROW LEVEL SECURITY'),
        );
        const reportColumns = migration.sql.filter((statement) =>
          statement.trimStart().startsWith('ALTER TABLE "facility_tasks" ADD COLUMN "report_'),
        );
        if (reportRls) await tx.execute(sql.raw(reportRls));
        for (const statement of reportColumns) await tx.execute(sql.raw(statement));
        // Copy only each task's latest report before dropping the append-only history table.
        await tx.execute(sql`
          WITH latest AS (
            SELECT DISTINCT ON (task_id) id, task_id, submitted_by, content, submitted_at
            FROM facility_task_reports
            ORDER BY task_id, submitted_at DESC, id DESC
          )
          UPDATE facility_tasks AS task
          SET report_id = latest.id,
              report_content = latest.content,
              report_submitted_by = latest.submitted_by,
              report_submitted_at = latest.submitted_at
          FROM latest
          WHERE task.id = latest.task_id
        `);
        statements = migration.sql.filter(
          (statement) => statement !== reportRls && !reportColumns.includes(statement),
        );
      }
      // Drizzle can emit DROP TABLE CASCADE before explicit FK drops; execute those
      // trusted generated constraint drops first so PostgreSQL does not see missing constraints.
      const dropsTableCascade = statements.some(
        (statement) => statement.includes("DROP TABLE") && statement.includes("CASCADE"),
      );
      statements =
        contractsLocalTypes || dropsTableCascade
          ? [
              ...statements.filter((statement) => statement.includes(" DROP CONSTRAINT ")),
              ...statements.filter((statement) => !statement.includes(" DROP CONSTRAINT ")),
            ]
          : statements;
      for (const statement of statements) await tx.execute(sql.raw(statement));
      await tx.insert(journal).values({ hash: migration.hash, createdAt: migration.folderMillis });
      appliedHashes.add(migration.hash);
      applied++;
    }
    if (originals.length) await tx.insert(systemSettings).values(originals);
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
    console.log(`Applied ${count} migrations; configuration transfer committed atomically.`);
  } catch (error) {
    console.error("Database migration failed; transaction rolled back:", error);
    process.exitCode = 1;
  } finally {
    await queryClient.end();
  }
}
