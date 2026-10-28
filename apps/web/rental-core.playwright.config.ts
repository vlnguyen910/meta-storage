import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testMatch: "rental-core.spec.ts",
  outputDir: "./test-results/rental-core",
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3208",
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
    command: "bunx next dev --port 3208",
    url: "http://127.0.0.1:3208",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      METASTORAGE_NEXT_DIST_DIR: ".next-rental-core",
      NEXT_PUBLIC_API_MODE: "api",
      NEXT_PUBLIC_API_BASE_URL: "/api",
      API_PROXY_TARGET: "",
    },
  },
});
