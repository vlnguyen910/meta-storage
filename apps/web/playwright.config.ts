import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 1,
  reporter: "html",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npx --yes bun@1.3.14 run dev",
    cwd: "apps/web",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
    timeout: 180_000,
    env: {
      NEXT_PUBLIC_API_MODE: "mock",
      NEXT_PUBLIC_MOCK_DELAY_MS: "0",
    },
  },
});
