import type { Database } from "@metastorage/database";

export type UserTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
