import { describe, expect, test } from "bun:test";
import path from "node:path";
import { envSchema } from "../../src/config/env.schema";

const valid = {
  NODE_ENV: "test",
  DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:5433/metastorage",
  REDIS_URL: "redis://127.0.0.1:6379/14",
  CORS_ORIGIN: "http://localhost:3000,http://127.0.0.1:3000",
  AUTH_TRUSTED_ORIGINS: "http://localhost:3000,metastorage://",
  BETTER_AUTH_URL: "http://localhost:4000/api/auth",
  BETTER_AUTH_SECRET: "test-auth-secret-at-least-32-characters",
  BOOKING_MAGIC_LINK_SECRET: "test-mail-secret-at-least-32-characters",
  QR_TOKEN_SECRET: "test-qr-secret-at-least-32-characters",
  WEB_URL: "http://localhost:3000",
  PUBLIC_APP_URL: "http://localhost:3000",
  RESEND_API_KEY: "re_test_only",
  RESEND_FROM_EMAIL: "Metastorage <verify@example.test>",
  CLOUDINARY_CLOUD_NAME: "test-cloud",
  CLOUDINARY_API_KEY: "test-key",
  CLOUDINARY_API_SECRET: "test-secret",
  PAYMENT_PROVIDER: "mock",
  GOOGLE_CLIENT_ID: "",
  GOOGLE_CLIENT_SECRET: "",
};

describe("API startup environment", () => {
  test("reports every missing required variable instead of defaulting to local services", () => {
    for (const key of Object.keys(valid).filter(
      (key) =>
        !["NODE_ENV", "PAYMENT_PROVIDER", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"].includes(key),
    )) {
      for (const value of [undefined, "", "   "]) {
        const result = envSchema.safeParse({ ...valid, [key]: value });
        expect(result.success).toBe(false);
        if (!result.success)
          expect(result.error.issues.some((issue) => issue.path[0] === key)).toBe(true);
      }
    }
  });

  test("accepts complete config with Google disabled", () => {
    const result = envSchema.parse(valid);
    expect(result.GOOGLE_CLIENT_ID).toBeUndefined();
    expect(result.PORT).toBe(4000);
  });

  test("rejects wrong URL protocols, malformed origins, sender, weak secrets and invalid ports", () => {
    for (const values of [
      { DATABASE_URL: "https://db.example.test" },
      { REDIS_URL: "https://redis.example.test" },
      { WEB_URL: "file:///tmp/web" },
      { PUBLIC_APP_URL: "invalid" },
      { BETTER_AUTH_URL: "ftp://auth.example.test" },
      { CORS_ORIGIN: "http://localhost:3000,*" },
      { CORS_ORIGIN: "http://localhost:3000," },
      { AUTH_TRUSTED_ORIGINS: "not-an-origin" },
      { RESEND_FROM_EMAIL: "not-an-email" },
      { BOOKING_MAGIC_LINK_SECRET: "short" },
      { QR_TOKEN_SECRET: "short" },
      { PORT: "0" },
      { PORT: "65536" },
      { PORT: "3.5" },
    ])
      expect(envSchema.safeParse({ ...valid, ...values }).success).toBe(false);
  });

  test("SePay requires PG credentials even when legacy bank configuration is present", () => {
    expect(envSchema.safeParse({ ...valid, PAYMENT_PROVIDER: "sepay" }).success).toBe(false);
    expect(
      envSchema.safeParse({ ...valid, PAYMENT_PROVIDER: "sepay", SEPAY_MERCHANT_ID: "merchant" })
        .success,
    ).toBe(false);
    expect(
      envSchema.safeParse({
        ...valid,
        PAYMENT_PROVIDER: "sepay",
        SEPAY_MERCHANT_ID: "merchant",
        SEPAY_SECRET_KEY: "secret",
      }).success,
    ).toBe(true);
    expect(
      envSchema.safeParse({
        ...valid,
        PAYMENT_PROVIDER: "sepay",
        SEPAY_WEBHOOK_API_KEY: "key",
        SEPAY_BANK_NAME: "Bank",
        SEPAY_BANK_ACCOUNT_NUMBER: "123",
        SEPAY_BANK_ACCOUNT_NAME: "Name",
        PUBLIC_API_URL: "https://api.example.test",
      }).success,
    ).toBe(false);
    expect(
      envSchema.safeParse({
        ...valid,
        PAYMENT_PROVIDER: "sepay",
        SEPAY_SECRET_KEY: "secret",
      }).success,
    ).toBe(false);
  });

  test("server exits before initializing dependencies and never prints supplied secrets", () => {
    const result = Bun.spawnSync([process.execPath, path.resolve("apps/api/src/index.ts")], {
      env: {
        ...process.env,
        ...valid,
        CLOUDINARY_API_SECRET: "",
        DATABASE_URL: "",
        BETTER_AUTH_SECRET: "sensitive-test-sentinel",
        DOCKER_DATABASE_URL: "",
      },
      stdout: "pipe",
      stderr: "pipe",
      timeout: 10000,
    });
    const output = new TextDecoder().decode(result.stderr);
    expect(result.exitCode).toBe(1);
    expect(output).toContain("CLOUDINARY_API_SECRET");
    expect(output).toContain("DATABASE_URL");
    expect(output).not.toContain("sensitive-test-sentinel");
    expect(output).not.toContain("Connecting to");
  });
});
