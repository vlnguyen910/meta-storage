import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SQL } from "bun";

type RenewalFixture = {
  api: string;
  rentalIds: string[];
  facilityId: string;
  typeId: string;
  [key: string]: unknown;
};

// Own a fresh loopback database; never load application .env credentials into the fixture.
const name = `metastorage_inspection_test_renewal_${randomUUID().replaceAll("-", "")}`;
const admin = new SQL("postgres://postgres:postgres@127.0.0.1:5433/postgres");
const directory = await mkdtemp(join(tmpdir(), "renewal-postman-"));
const fixturePath = join(directory, "fixture.json");
const databaseUrl = `postgres://postgres:postgres@127.0.0.1:5433/${name}`;
const env = {
  ...process.env,
  NODE_ENV: "test",
  CI: "true",
  LOG_LEVEL: "silent",
  DATABASE_URL: databaseUrl,
  DOCKER_DATABASE_URL: "",
  BOOKING_TEST_DATABASE_URL: databaseUrl,
  MY_STORAGE_LOCAL_DATABASE_URL: databaseUrl,
  CUSTOMER_E2E_FIXTURE: fixturePath,
  CUSTOMER_E2E_API_PORT: "0",
  REDIS_URL: "redis://127.0.0.1:6379/13",
  AUTH_TRUSTED_ORIGINS: "http://localhost:3000",
  CORS_ORIGIN: "http://localhost:3000",
  BETTER_AUTH_URL: "http://localhost:4000/api/auth",
  WEB_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: "renewal-test-secret-minimum-32-characters",
  BOOKING_MAGIC_LINK_SECRET: "renewal-test-booking-secret-minimum-32-characters",
  QR_TOKEN_SECRET: "renewal-test-qr-secret-minimum-32-characters",
  PAYMENT_PROVIDER: "sepay",
  SEPAY_ENV: "sandbox",
  SEPAY_MERCHANT_ID: "renewal-local-test",
  SEPAY_SECRET_KEY: "renewal-provider-local-test-only",
  RESEND_API_KEY: "re_local_test_only",
  RESEND_FROM_EMAIL: "Test <test@example.test>",
  CLOUDINARY_CLOUD_NAME: "local-test",
  CLOUDINARY_API_KEY: "local-test",
  CLOUDINARY_API_SECRET: "local-test",
  GOOGLE_CLIENT_ID: "local-test",
  GOOGLE_CLIENT_SECRET: "local-test",
};
let server: ReturnType<typeof Bun.spawn> | undefined;
let created = false;
try {
  await admin.unsafe(`CREATE DATABASE "${name}"`);
  created = true;
  const migrate = Bun.spawn([process.execPath, "packages/database/src/migrate.ts"], {
    env,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (await migrate.exited) throw new Error("Migration failed");
  server = Bun.spawn([process.execPath, "apps/api/tests/fixtures/customer-rental-live-server.ts"], {
    env,
    stdout: "inherit",
    stderr: "inherit",
  });
  const deadline = Date.now() + 60_000;
  let fixture: RenewalFixture | undefined;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error("Fixture server failed");
    try {
      fixture = JSON.parse(await readFile(fixturePath, "utf8"));
      break;
    } catch {
      await Bun.sleep(200);
    }
  }
  if (!fixture) throw new Error("Fixture startup timed out");
  const target = new SQL(databaseUrl);
  try {
    await target`update rentals set end_at = now() + interval '3 days' where id = ${fixture.rentalIds[1]}`;
  } finally {
    await target.close();
  }
  const environmentPath = join(directory, "environment.json");
  const variables = {
    ...fixture,
    rentalId: fixture.rentalIds[0],
    closedRentalId: fixture.rentalIds[2],
    cutoffRentalId: fixture.rentalIds[1],
    scheduledDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
    key: randomUUID(),
    providerSecret: env.SEPAY_SECRET_KEY,
  };
  await writeFile(
    environmentPath,
    JSON.stringify({
      name: "Isolated renewal test",
      values: Object.entries(variables).map(([key, value]) => ({ key, value, enabled: true })),
    }),
  );
  const capacityDb = new SQL(databaseUrl);
  let capacityCode = 0;
  try {
    const available =
      await capacityDb`update storage_units set status = 'MAINTENANCE' where facility_id = ${fixture.facilityId} and unit_type_id = ${fixture.typeId} and status = 'AVAILABLE' returning id`;
    try {
      const capacity = Bun.spawn(
        [
          "postman",
          "collection",
          "run",
          "apps/api/tests/postman/rental-renewal-capacity.postman_collection.json",
          "-e",
          environmentPath,
          "--no-report-events",
          "--timeout-request",
          "10000",
        ],
        { stdout: "pipe", stderr: "pipe" },
      );
      const [out, err, code] = await Promise.all([
        new Response(capacity.stdout).text(),
        new Response(capacity.stderr).text(),
        capacity.exited,
      ]);
      await writeFile("/tmp/rental-renewal-capacity-postman.log", out + err);
      console.log(out);
      capacityCode = code;
    } finally {
      for (const row of available)
        await capacityDb`update storage_units set status = 'AVAILABLE' where id = ${row.id}`;
    }
  } finally {
    await capacityDb.close();
  }
  const postman = Bun.spawn(
    [
      "postman",
      "collection",
      "run",
      "apps/api/tests/postman/rental-renewal.postman_collection.json",
      "-e",
      environmentPath,
      "--no-report-events",
      "--timeout-request",
      "10000",
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const [stdout, stderr, code] = await Promise.all([
    new Response(postman.stdout).text(),
    new Response(postman.stderr).text(),
    postman.exited,
  ]);
  await writeFile("/tmp/rental-renewal-postman.log", stdout + stderr);
  console.log(stdout);
  if (stderr) console.error(stderr);
  console.log(`POSTMAN_EXIT_CODE=${code}`);
  console.log(`CAPACITY_POSTMAN_EXIT_CODE=${capacityCode}`);
  process.exitCode = code || capacityCode;
} finally {
  if (server && server.exitCode === null) {
    server.kill();
    await server.exited;
  }
  if (created) await admin.unsafe(`DROP DATABASE "${name}" WITH (FORCE)`);
  await admin.close();
  await rm(directory, { recursive: true, force: true });
}
