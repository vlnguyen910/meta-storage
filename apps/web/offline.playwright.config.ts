import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testMatch: "offline-ui.spec.ts",
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3101",
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "bunx next dev --port 3101",
    url: "http://127.0.0.1:3101",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      METASTORAGE_NEXT_DIST_DIR: ".next-mock-playwright",
      NEXT_PUBLIC_API_MODE: "mock",
      NEXT_PUBLIC_MOCK_DELAY_MS: "0",
    },
  },
});
