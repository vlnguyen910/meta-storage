import { defineConfig, devices } from "@playwright/test";

const webPort = Number(process.env.PLAYWRIGHT_WEB_PORT ?? 3000);
const baseURL = `http://127.0.0.1:${webPort}`;
const isolatedServer = process.env.PLAYWRIGHT_WEB_PORT !== undefined;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 1,
  reporter: "html",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: isolatedServer
    ? undefined
    : {
        command: "npx --yes bun@1.3.14 run dev",
        cwd: "apps/web",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 180_000,
        env: {
          NEXT_PUBLIC_API_MODE: "mock",
          NEXT_PUBLIC_MOCK_DELAY_MS: "0",
        },
      },
});
