import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getDatabaseUrl } from "./env";
import * as schema from "./schema";

const connectionString = getDatabaseUrl();

// For queries and transactions with connection pooling
export const queryClient = postgres(connectionString, {
  max: Number(process.env.DB_MAX_CONNECTIONS) || 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(queryClient, { schema, casing: "snake_case" });

export type Database = typeof db;
