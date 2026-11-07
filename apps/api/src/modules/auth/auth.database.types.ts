import type { Database } from "@metastorage/database";

export type AuthDatabaseConnection =
  | Database
  | Parameters<Parameters<Database["transaction"]>[0]>[0];
