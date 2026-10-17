import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testMatch: "flow2-ui.spec.ts",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium", viewport: { width: 1440, height: 1000 } } },
  ],
  webServer: {
    command: "bunx next dev --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: true,
    timeout: 120000,
    env: {
      METASTORAGE_NEXT_DIST_DIR: ".next-playwright",
      NEXT_PUBLIC_API_MODE: "api",
      NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:4100/api",
    },
  },
});
