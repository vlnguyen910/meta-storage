import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

// Load .env if present (resolve relative to current directory or apps/api)
const envCandidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "apps/api/.env"),
  path.resolve(import.meta.dirname, "../../.env"),
];
for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "develop", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.string().default("postgres://postgres:postgres@localhost:5432/metastorage"),
  REDIS_URL: z.url({ protocol: /^rediss?$/ }).default("redis://localhost:6379"),
  CORS_ORIGIN: z
    .string()
    .min(1)
    .refine(
      (origins) => origins.split(",").every((origin) => origin.trim() !== "*"),
      "CORS_ORIGIN must list explicit origins when credentials are enabled",
    ),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  AUTH_TRUSTED_ORIGINS: z.string().min(1),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),
  PAYMENT_PROVIDER: z.enum(["mock", "sepay"]).default("mock"),
  SEPAY_ENV: z.enum(["sandbox", "production"]).default("sandbox"),
  SEPAY_MERCHANT_ID: z.string().optional(),
  SEPAY_SECRET_KEY: z.string().optional(),
  SEPAY_TEST_MODE: z.coerce.boolean().default(true),
  SEPAY_WEBHOOK_API_KEY: z.string().optional(),
  SEPAY_PAYMENT_PREFIX: z
    .string()
    .regex(/^[A-Z]{2,5}$/)
    .default("SX"),
  SEPAY_BANK_NAME: z.string().optional(),
  SEPAY_BANK_ACCOUNT_NUMBER: z.string().optional(),
  SEPAY_BANK_ACCOUNT_NAME: z.string().optional(),
  PUBLIC_API_URL: z.url().optional(),
  WEB_URL: z.string().default("http://localhost:3000"),
});

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const rawNodeEnv = (process.env.NODE_ENV || "development").trim().toLowerCase();
  const isDevelop = rawNodeEnv === "develop" || rawNodeEnv === "development";

  if (isDevelop) {
    // Explicit Docker configuration opts into local Compose; otherwise preserve
    // DATABASE_URL, which may point to a cloud development database.
    process.env.DATABASE_URL =
      process.env.DOCKER_DATABASE_URL ||
      process.env.DATABASE_URL ||
      "postgres://postgres:postgres@localhost:5432/metastorage";
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("❌ Invalid environment variables:");
    console.error(JSON.stringify(result.error.format(), null, 2));
    process.exit(1);
  }

  return result.data;
}

export const env = parseEnv();
