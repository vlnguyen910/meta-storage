import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./flow5-test-results",
  testMatch: "flow5-integration.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3205",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    timezoneId: "Asia/Ho_Chi_Minh",
  },
  projects: [
    { name: "desktop", use: { browserName: "chromium", viewport: { width: 1440, height: 1000 } } },
    {
      name: "mobile",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: "bunx next dev --port 3205",
    url: "http://127.0.0.1:3205",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      METASTORAGE_NEXT_DIST_DIR: ".next-flow5",
      NEXT_PUBLIC_API_MODE: "api",
      NEXT_PUBLIC_API_BASE_URL: "/api",
      API_PROXY_TARGET: "",
    },
  },
});
