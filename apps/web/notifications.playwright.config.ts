import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "notifications.spec.ts",
  workers: 1,
  timeout: 90000,
  expect: { timeout: 20000 },
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3105",
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "bunx next dev --port 3105",
    url: "http://127.0.0.1:3105",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      METASTORAGE_NEXT_DIST_DIR: ".next-playwright/notifications",
      NEXT_PUBLIC_API_MODE: "api",
      NEXT_PUBLIC_API_BASE_URL: "/api",
    },
  },
});
