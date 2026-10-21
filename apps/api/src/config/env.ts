import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import type { z } from "zod";
import { ENV_MESSAGES } from "./env.messages";
import { envSchema } from "./env.schema";

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

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const rawNodeEnv = (process.env.NODE_ENV || "development").trim().toLowerCase();
  const isDevelop = rawNodeEnv === "develop" || rawNodeEnv === "development";

  if (isDevelop && process.env.DOCKER_DATABASE_URL) {
    // Explicit Docker configuration opts into local Compose; otherwise preserve
    // DATABASE_URL, which may point to a cloud development database.
    process.env.DATABASE_URL = process.env.DOCKER_DATABASE_URL;
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error(ENV_MESSAGES.invalidEnvironment);
    for (const issue of result.error.issues) {
      console.error(`- ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }

  return result.data;
}

export const env = parseEnv();
