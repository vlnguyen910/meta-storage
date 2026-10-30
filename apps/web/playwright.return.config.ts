import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testMatch: "return-debt-ui.spec.ts",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3117", browserName: "chromium" },
  webServer: {
    command: "bun run dev --port 3117",
    url: "http://127.0.0.1:3117",
    timeout: 120000,
    env: {
      NEXT_PUBLIC_API_MODE: "better-auth",
      NEXT_PUBLIC_API_BASE_URL: "/api",
      METASTORAGE_NEXT_DIST_DIR: ".next-playwright",
    },
  },
});
