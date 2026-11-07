import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  use: { baseURL: "http://127.0.0.1:8088", browserName: "chromium", hasTouch: true },
  webServer: {
    command: "bunx expo start --web --port 8088",
    url: "http://127.0.0.1:8088",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
