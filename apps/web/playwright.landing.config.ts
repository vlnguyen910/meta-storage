import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["landing.spec.ts", "public-header-guest-actions.spec.ts"],
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3120", browserName: "chromium", reducedMotion: "reduce" },
  webServer: {
    command: "bun run dev --port 3120",
    url: "http://127.0.0.1:3120",
    timeout: 180000,
    env: {
      NEXT_PUBLIC_API_MODE: "better-auth",
      NEXT_PUBLIC_API_BASE_URL: "/api",
      METASTORAGE_NEXT_DIST_DIR: ".next-playwright",
    },
  },
});
