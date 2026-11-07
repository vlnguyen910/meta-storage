import postgres from "postgres";
import { getDatabaseUrl } from "../src/env";

const supportedOptions = new Set(["--upgrade", "--schema-only", "--migrations"]);
for (const option of process.argv.slice(2)) {
  if (!supportedOptions.has(option)) throw new Error(`Unsupported rental test option: ${option}`);
}

const original = new URL(getDatabaseUrl());
if (!["localhost", "127.0.0.1", "[::1]"].includes(original.hostname))
  throw new Error("Only local PostgreSQL is allowed");
const name = `metastorage_inspection_test_rental_reset_${Date.now()}`;
const adminUrl = new URL(original);
adminUrl.pathname = "/postgres";
const testUrl = new URL(original);
testUrl.pathname = `/${name}`;
const admin = postgres(adminUrl.href, { max: 1 });
const root = new URL("../../../", import.meta.url).pathname;
const env = {
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: testUrl.href,
  DOCKER_DATABASE_URL: testUrl.href,
  MY_STORAGE_LOCAL_DATABASE_URL: testUrl.href,
  RENTAL_MIGRATION_TEST_DATABASE_URL: testUrl.href,
  BOOKING_TEST_DATABASE_URL: testUrl.href,
  REDIS_URL: "redis://127.0.0.1:6379/12",
  BETTER_AUTH_SECRET: "rental-reset-test-secret-at-least-32-characters",
  BOOKING_MAGIC_LINK_SECRET: "rental-reset-test-magic-link-secret-32-chars",
  QR_TOKEN_SECRET: "rental-reset-test-qr-token-secret-at-least-32",
  BETTER_AUTH_URL: "http://localhost:4000",
  PUBLIC_APP_URL: "http://localhost:3000",
  WEB_URL: "http://localhost:3000",
  CORS_ORIGIN: "http://localhost:3000",
  AUTH_TRUSTED_ORIGINS: "http://localhost:3000,http://localhost:4000",
  RESEND_API_KEY: "rental-reset-test-key",
  RESEND_FROM_EMAIL: "test@example.test",
};
let created = false;
try {
  await admin.unsafe(`CREATE DATABASE "${name}"`);
  created = true;
  console.log(`Created isolated database ${name}`);
  if (process.argv.includes("--upgrade")) {
    const upgrade = Bun.spawn(
      [process.execPath, "test", "tests/rental-reset.integration.test.ts"],
      {
        cwd: new URL("..", import.meta.url).pathname,
        env,
        stdout: "inherit",
        stderr: "inherit",
      },
    );
    if ((await upgrade.exited) !== 0) throw new Error("Populated migration regression failed");
  }
  const useMigrations = !process.argv.includes("--schema-only");
  const push = Bun.spawn(
    useMigrations
      ? [process.execPath, "run", "db:migrate"]
      : [process.execPath, "x", "drizzle-kit", "push", "--force"],
    {
      cwd: new URL("..", import.meta.url).pathname,
      env,
      stdout: "inherit",
      stderr: "inherit",
    },
  );
  if ((await push.exited) !== 0)
    throw new Error(
      useMigrations ? "Isolated migration failed" : "Isolated schema creation failed",
    );
  const files = ["tests/integration/rentals-read.test.ts"];
  for (const testFile of files) {
    const tests = Bun.spawn([process.execPath, "test", testFile], {
      cwd: `${root}apps/api`,
      env,
      stdout: "inherit",
      stderr: "inherit",
    });
    if ((await tests.exited) !== 0) throw new Error(`Rental tests failed: ${testFile}`);
  }
} finally {
  if (created) await admin.unsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await admin.end();
  console.log("Removed isolated rental test database");
}
