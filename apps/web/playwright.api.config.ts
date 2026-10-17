import { defineConfig, devices } from "@playwright/test";

if (
  !process.env.BOOKING_TEST_DATABASE_URL ||
  process.env.DATABASE_URL !== process.env.BOOKING_TEST_DATABASE_URL
)
  throw new Error(
    "API E2E requires the isolated DATABASE_URL and BOOKING_TEST_DATABASE_URL to match",
  );

export default defineConfig({
  testDir: "./e2e-api",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90000,
  expect: { timeout: 25000 },
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command: "bun apps/api/tests/fixtures/flow1-server.ts",
      cwd: "../..",
      url: "http://127.0.0.1:4000/api/health",
      reuseExistingServer: false,
      env: { ...process.env, PORT: "4000", NODE_ENV: "test" },
      timeout: 120000,
    },
    {
      command: "bun run dev",
      url: "http://127.0.0.1:3000",
      reuseExistingServer: !process.env.CI,
      env: {
        ...process.env,
        NEXT_PUBLIC_API_MODE: "api",
        NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:4000/api",
      },
      timeout: 180000,
    },
  ],
});
