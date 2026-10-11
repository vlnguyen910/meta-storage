import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

if (!process.env.BOOKING_TEST_DATABASE_URL || !process.env.REDIS_TEST_URL)
  throw new Error("Set isolated BOOKING_TEST_DATABASE_URL and REDIS_TEST_URL");
process.env.BOOKING_TRACKING_E2E = "1";
process.env.DATABASE_URL = process.env.BOOKING_TEST_DATABASE_URL;
const root = path.resolve(__dirname, "../..");
export default defineConfig({
  testDir: "./e2e",
  testMatch: "booking-tracking.spec.mts",
  workers: 1,
  retries: 0,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3000", screenshot: "only-on-failure", trace: "off" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command: "bun run --filter api dev",
      cwd: root,
      url: "http://127.0.0.1:4100/api/health",
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        NODE_ENV: "test",
        PORT: "4100",
        HOST: "127.0.0.1",
        LOG_LEVEL: "silent",
        DATABASE_URL: process.env.BOOKING_TEST_DATABASE_URL,
        REDIS_URL: process.env.REDIS_TEST_URL,
        CORS_ORIGIN: "http://127.0.0.1:3000",
        AUTH_TRUSTED_ORIGINS: "http://127.0.0.1:3000",
        WEB_URL: "http://127.0.0.1:3000",
        BETTER_AUTH_URL: "http://127.0.0.1:4100",
        BETTER_AUTH_SECRET: "test-only-secret-at-least-32-characters",
      },
    },
    {
      command: "bun run --filter web dev",
      cwd: root,
      url: "http://127.0.0.1:3000",
      reuseExistingServer: false,
      timeout: 120_000,
      env: { NEXT_PUBLIC_API_MODE: "real", NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:4100/api" },
    },
  ],
});
