import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertTestDatabase } from "./fixtures/test-database";

export function assertDatabaseTestEnvironment(environment: Record<string, string | undefined>) {
  for (const key of [
    "BOOKING_TEST_DATABASE_URL",
    "MY_STORAGE_LOCAL_DATABASE_URL",
    "PRICING_TEST_DATABASE_URL",
    "REPORTS_TEST_DATABASE_URL",
  ])
    assertTestDatabase(environment[key], environment);
  if (environment.RUN_INSPECTION_DB_TESTS !== "1")
    throw new Error("RUN_INSPECTION_DB_TESTS=1 is required; database suites must not skip");
  const redis = environment.REDIS_TEST_URL ? new URL(environment.REDIS_TEST_URL) : null;
  if (
    redis?.protocol !== "redis:" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(redis.hostname) ||
    !/^\/(?:[1-9]|1[0-5])$/.test(redis.pathname) ||
    environment.REDIS_URL !== environment.REDIS_TEST_URL
  )
    throw new Error("Use matching loopback REDIS_URL/REDIS_TEST_URL with an explicit test DB 1–15");
}

export function assertExecutedSuite(report: string, file: string) {
  if (!/<testcase\b/.test(report) || /<skipped\b/.test(report))
    throw new Error(`${file}: required database tests did not run or were skipped`);
}

export function isDatabaseRegressionSuite(source: string) {
  return /\b(?:test|describe)\.(?:skipIf|skip)\(/.test(source);
}

async function run() {
  assertDatabaseTestEnvironment(process.env);
  const integration = join(import.meta.dirname, "integration");
  const files = [];
  for (const file of (await readdir(integration)).sort()) {
    if (
      file.endsWith(".test.ts") &&
      isDatabaseRegressionSuite(await readFile(join(integration, file), "utf8"))
    )
      files.push(file);
  }
  // Pricing explicitly verifies an unconfigured policy; run before installing test defaults.
  files.sort(
    (a, b) => Number(b === "pricing-postgres.test.ts") - Number(a === "pricing-postgres.test.ts"),
  );
  if (!files.length) throw new Error("No database regression suites were found");
  const reports = await mkdtemp(join(tmpdir(), "metastorage-db-tests-"));
  const { db, queryClient, systemSettings } = await import("@metastorage/database");
  const { SYSTEM_SETTING_DEFINITIONS } = await import("@metastorage/contracts/system-settings");
  try {
    for (const file of files) {
      if (file !== "pricing-postgres.test.ts")
        await db
          .insert(systemSettings)
          .values(
            Object.entries(SYSTEM_SETTING_DEFINITIONS).map(([key, setting]) => ({
              key: key as keyof typeof SYSTEM_SETTING_DEFINITIONS,
              value: setting.defaultValue,
              description: setting.description,
              version: key === "DEPOSIT_MONTHS" ? 1 : 0,
            })),
          )
          .onConflictDoNothing();
      const report = join(reports, `${file}.xml`);
      console.log(`Running database regression: ${file}`);
      const result = Bun.spawn(
        [
          process.execPath,
          "test",
          join(integration, file),
          "--reporter=junit",
          `--reporter-outfile=${report}`,
        ],
        { env: process.env, stdout: "inherit", stderr: "inherit" },
      );
      if ((await result.exited) !== 0)
        throw new Error(`${file} failed; stopping database regressions`);
      assertExecutedSuite(await readFile(report, "utf8"), file);
    }
    console.log(`Completed ${files.length} database regression suites without skips`);
  } finally {
    await queryClient.end();
    await rm(reports, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  try {
    await run();
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Database regressions failed");
    process.exitCode = 1;
  }
}
