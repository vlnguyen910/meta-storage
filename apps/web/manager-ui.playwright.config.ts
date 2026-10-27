import { defineConfig } from "@playwright/test";

const external = process.env.MANAGER_UI_BASE_URL;
export default defineConfig({
  testDir: "./e2e",
  testMatch: ["manager-tabs.spec.ts", "manager-redesign.spec.ts", "staff-workspace.spec.ts"],
  outputDir: "./test-results/manager-ui",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: "list",
  use: {
    baseURL: external ?? "http://127.0.0.1:3207",
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
  webServer: external
    ? undefined
    : {
        command: "bunx next dev --port 3207",
        url: "http://127.0.0.1:3207",
        reuseExistingServer: false,
        timeout: 120_000,
        env: {
          METASTORAGE_NEXT_DIST_DIR: ".next-manager-ui",
          NEXT_PUBLIC_API_MODE: "api",
          NEXT_PUBLIC_API_BASE_URL: "/api",
          API_PROXY_TARGET: "",
        },
      },
});
