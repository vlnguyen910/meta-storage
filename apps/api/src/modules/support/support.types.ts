import type { Database } from "@metastorage/database";
import type { SupportRepository } from "./support.repository";

export type SupportTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type SupportCursor = { id: string; createdAt: Date };

export interface SupportRoutesOptions {
  repository?: SupportRepository;
}
