import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import Redis from "ioredis";

const root = fileURLToPath(new URL("../../..", import.meta.url));

export function localTestUrls(environment: Record<string, string | undefined>) {
  const postgres = new URL(
    environment.LOCAL_TEST_POSTGRES_URL ?? "postgres://postgres:postgres@127.0.0.1:5433/postgres",
  );
  const redis = new URL(environment.LOCAL_TEST_REDIS_URL ?? "redis://127.0.0.1:6379/12");
  const loopback = (host: string) => ["localhost", "127.0.0.1", "[::1]"].includes(host);
  if (
    !["postgres:", "postgresql:"].includes(postgres.protocol) ||
    !loopback(postgres.hostname) ||
    postgres.pathname !== "/postgres" ||
    postgres.search ||
    postgres.hash
  )
    throw new Error(
      "LOCAL_TEST_POSTGRES_URL must target the loopback postgres administration database",
    );
  if (
    redis.protocol !== "redis:" ||
    !loopback(redis.hostname) ||
    !/^\/(?:[1-9]|1[0-5])$/.test(redis.pathname) ||
    redis.search ||
    redis.hash
  )
    throw new Error("LOCAL_TEST_REDIS_URL must target a reserved loopback Redis database 1–15");
  return { postgres, redis };
}

async function run() {
  const urls = localTestUrls(process.env);
  const suffix = randomUUID().replaceAll("-", "").slice(0, 16);
  const names = [
    `metastorage_inspection_test_local_${suffix}`,
    `metastorage_local_${suffix}_seed_test`,
  ] as const;
  const databaseUrl = (name: string) => {
    const url = new URL(urls.postgres);
    url.pathname = `/${name}`;
    return url.href;
  };
  // Set test-only values before importing the database; local .env credentials are not test inputs.
  const environment = {
    ...process.env,
    NODE_ENV: "test",
    CI: "true",
    LOG_LEVEL: "silent",
    TRUSTED_PROXY_CIDRS: "127.0.0.1",
    DATABASE_URL: databaseUrl(names[0]),
    DOCKER_DATABASE_URL: "",
    REDIS_URL: urls.redis.href,
    REDIS_TEST_URL: urls.redis.href,
    RUN_INSPECTION_DB_TESTS: "1",
    CORS_ORIGIN: "http://localhost:3000",
    AUTH_TRUSTED_ORIGINS: "http://localhost:3000",
    BETTER_AUTH_SECRET: "local-only-auth-secret-32-characters-long",
    BETTER_AUTH_URL: "http://localhost:4000/api/auth",
    BOOKING_MAGIC_LINK_SECRET: "local-only-booking-secret-32-characters",
    QR_TOKEN_SECRET: "local-only-qr-secret-32-characters-long",
    PUBLIC_APP_URL: "http://localhost:3000",
    WEB_URL: "http://localhost:3000",
    RESEND_API_KEY: "re_local_test_only",
    RESEND_FROM_EMAIL: "Local tests <test@example.test>",
    CLOUDINARY_CLOUD_NAME: "local-test-cloud",
    CLOUDINARY_API_KEY: "local-test-key",
    CLOUDINARY_API_SECRET: "local-test-cloudinary-secret",
    GOOGLE_CLIENT_ID: "local-test-google-client",
    GOOGLE_CLIENT_SECRET: "local-test-google-secret",
    PAYMENT_PROVIDER: "mock",
    SEPAY_ENV: "sandbox",
    SEPAY_MERCHANT_ID: "workflow-test",
    SEPAY_SECRET_KEY: "workflow-test-local-only",
    BOOKING_TEST_DATABASE_URL: databaseUrl(names[0]),
    MY_STORAGE_LOCAL_DATABASE_URL: databaseUrl(names[0]),
    PRICING_TEST_DATABASE_URL: databaseUrl(names[0]),
    REPORTS_TEST_DATABASE_URL: databaseUrl(names[0]),
    RENTAL_RENEWAL_TEST_DATABASE_URL: databaseUrl(names[0]),
    SEED_TEST_DATABASE_URL: databaseUrl(names[1]),
  };
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = urls.postgres.href;
  const { db, queryClient, sql } = await import("@metastorage/database");
  const redis = new Redis(urls.redis.href, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    retryStrategy: null,
    connectTimeout: 3000,
  });
  const lock = "metastorage:local-tests:owner";
  const created: string[] = [];
  let ownsRedis = false;
  async function command(args: string[], env = environment) {
    const child = Bun.spawn([process.execPath, ...args], {
      cwd: root,
      env,
      stdout: "inherit",
      stderr: "inherit",
    });
    const exitCode = await child.exited;
    if (exitCode !== 0) throw new Error(`Local check failed (${exitCode}): bun ${args.join(" ")}`);
  }
  try {
    await redis.connect();
    if (await redis.dbsize())
      throw new Error(
        "Reserved Redis test database is not empty; select another LOCAL_TEST_REDIS_URL",
      );
    ownsRedis = (await redis.set(lock, suffix, "NX")) === "OK";
    if (!ownsRedis) throw new Error("Reserved Redis test database is already in use");
    for (const name of names) {
      await db.execute(sql`CREATE DATABASE ${sql.identifier(name)}`);
      created.push(name);
      await command(["run", "--filter", "@metastorage/database", "db:migrate"], {
        ...environment,
        DATABASE_URL: databaseUrl(name),
      });
    }
    await command(["run", "--filter", "api", "test:db"]);
    await command(["run", "--filter", "@metastorage/database", "test"], {
      ...environment,
      DATABASE_URL: databaseUrl(names[1]),
    });
    console.log("Local API/database and demo-seed regressions passed without cached results.");
  } finally {
    try {
      for (const name of created.reverse())
        await db.execute(sql`DROP DATABASE ${sql.identifier(name)} WITH (FORCE)`);
    } finally {
      await queryClient.end();
      try {
        if (ownsRedis && (await redis.get(lock)) === suffix) await redis.flushdb();
      } finally {
        redis.disconnect();
      }
    }
  }
}

if (import.meta.main) {
  try {
    await run();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
