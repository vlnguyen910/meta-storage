import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "flow3-integration.spec.ts",
  workers: 1,
  retries: 0,
  timeout: 60000,
  expect: { timeout: 20000 },
  reporter: "list",
  use: {
    baseURL: process.env.FLOW3_WEB_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } },
    },
    { name: "responsive", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
    { name: "small", use: { ...devices["Pixel 7"], viewport: { width: 375, height: 812 } } },
    { name: "wide-mobile", use: { ...devices["Pixel 7"], viewport: { width: 430, height: 932 } } },
  ],
});
