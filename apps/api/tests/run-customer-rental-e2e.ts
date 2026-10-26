import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SQL } from "bun";
import { localTestUrls } from "./run-local-database-tests";

const root = fileURLToPath(new URL("../../..", import.meta.url));

async function run() {
  const { postgres } = localTestUrls(process.env);
  const name = `metastorage_inspection_test_customer_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
  const target = new URL(postgres);
  target.pathname = `/${name}`;
  const apiPort = Number(process.env.CUSTOMER_E2E_API_PORT ?? 4100);
  const webPort = Number(process.env.PLAYWRIGHT_WEB_PORT ?? 3100);
  if (
    ![apiPort, webPort].every((p) => Number.isInteger(p) && p >= 1024 && p <= 65535) ||
    apiPort === webPort
  )
    throw new Error("Use two distinct local test ports");
  const webUrl = `http://127.0.0.1:${webPort}`;
  const files = await mkdtemp(join(tmpdir(), "customer-rental-e2e-"));
  const cleanup = resolve(files);
  if (!cleanup.startsWith(resolve(tmpdir(), "customer-rental-e2e-")))
    throw new Error("Unexpected customer E2E temporary directory");
  const fixture = join(files, "fixture.json");
  const environment = {
    ...process.env,
    NODE_ENV: "test",
    CI: "true",
    LOG_LEVEL: "silent",
    DATABASE_URL: target.href,
    DOCKER_DATABASE_URL: "",
    BOOKING_TEST_DATABASE_URL: target.href,
    MY_STORAGE_LOCAL_DATABASE_URL: target.href,
    REDIS_URL: "redis://127.0.0.1:6379/13",
    CUSTOMER_E2E_FIXTURE: fixture,
    CUSTOMER_E2E_API_PORT: String(apiPort),
    PLAYWRIGHT_WEB_PORT: String(webPort),
    CORS_ORIGIN: `${webUrl},http://localhost:3000,http://localhost:8082`,
    AUTH_TRUSTED_ORIGINS: `${webUrl},http://localhost:3000,http://localhost:8082`,
    BETTER_AUTH_URL: `http://127.0.0.1:${apiPort}/api/auth`,
    BETTER_AUTH_SECRET: "customer-live-test-secret-minimum-32-characters",
    BOOKING_MAGIC_LINK_SECRET: "customer-live-test-booking-secret-32-characters",
    QR_TOKEN_SECRET: "customer-live-test-qr-secret-32-characters",
    PUBLIC_APP_URL: webUrl,
    WEB_URL: webUrl,
    PAYMENT_PROVIDER: "sepay",
    SEPAY_ENV: "sandbox",
    SEPAY_MERCHANT_ID: "customer-live-test",
    SEPAY_SECRET_KEY: "customer-live-test-provider-secret",
    RESEND_API_KEY: "re_local_test_only",
    RESEND_FROM_EMAIL: "Local tests <test@example.test>",
    CLOUDINARY_CLOUD_NAME: "local-test-cloud",
    CLOUDINARY_API_KEY: "local-test-key",
    CLOUDINARY_API_SECRET: "local-test-secret",
    GOOGLE_CLIENT_ID: "local-test-google",
    GOOGLE_CLIENT_SECRET: "local-test-google-secret",
    NEXT_PUBLIC_API_MODE: "api",
    NEXT_PUBLIC_API_BASE_URL: "/api",
    API_PROXY_TARGET: `http://127.0.0.1:${apiPort}/api`,
    METASTORAGE_NEXT_DIST_DIR: ".next-playwright",
  };
  const admin = new SQL(postgres.href);
  const children: ReturnType<typeof Bun.spawn>[] = [];
  let created = false;
  const spawn = (args: string[], cwd = root) =>
    Bun.spawn([process.execPath, ...args], {
      cwd,
      env: environment,
      stdout: "inherit",
      stderr: "inherit",
    });
  try {
    // CREATE/DROP DATABASE are administrative operations on this generated test-only name.
    await admin.unsafe(`CREATE DATABASE "${name}"`);
    created = true;
    const migration = spawn(["run", "--filter", "@metastorage/database", "db:migrate"]);
    if (await migration.exited) throw new Error("Customer E2E migration failed");
    const api = spawn(["apps/api/tests/fixtures/customer-rental-live-server.ts"]);
    children.push(api);
    let ready = false;
    const apiDeadline = Date.now() + 120_000;
    while (Date.now() < apiDeadline) {
      if (api.exitCode !== null) throw new Error("Customer E2E API failed to start");
      try {
        await readFile(fixture);
        ready = true;
        break;
      } catch {
        await Bun.sleep(300);
      }
    }
    if (!ready) throw new Error("Customer E2E fixture startup timed out");
    const web = spawn(
      [
        "node_modules/next/dist/bin/next",
        "dev",
        "--port",
        String(webPort),
        "--hostname",
        "127.0.0.1",
      ],
      join(root, "apps/web"),
    );
    children.push(web);
    ready = false;
    const webDeadline = Date.now() + 180_000;
    while (Date.now() < webDeadline) {
      if (web.exitCode !== null) throw new Error("Customer E2E Web failed to start");
      try {
        const result = await fetch(`${webUrl}/api/auth/me`, { signal: AbortSignal.timeout(2000) });
        if (result.status === 401) {
          ready = true;
          break;
        }
      } catch {
        /* Wait for the owned Next server. */
      }
      await Bun.sleep(300);
    }
    if (!ready) throw new Error("Customer E2E Web startup timed out");
    const node = Bun.which("node");
    if (!node) throw new Error("Node.js is required by the existing Playwright CLI");
    const tests = Bun.spawn(
      [
        node,
        "node_modules/@playwright/test/cli.js",
        "test",
        "e2e/customer-rental-live.spec.ts",
        "--project=chromium",
        "--workers=1",
        "--reporter=line",
      ],
      { cwd: join(root, "apps/web"), env: environment, stdout: "inherit", stderr: "inherit" },
    );
    if (await tests.exited) throw new Error("Customer rental real-API E2E failed");
  } finally {
    for (const child of children.reverse()) {
      if (child.exitCode !== null) continue;
      if (process.platform === "win32")
        await Bun.spawn(["taskkill", "/pid", String(child.pid), "/T", "/F"], {
          stdout: "ignore",
          stderr: "ignore",
        }).exited;
      else child.kill();
      await child.exited;
    }
    if (created) await admin.unsafe(`DROP DATABASE "${name}" WITH (FORCE)`);
    await admin.close();
    await rm(cleanup, { recursive: true, force: true });
  }
}

if (import.meta.main)
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
