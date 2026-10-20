import type { bookingContracts, Database } from "@metastorage/database";
export interface ContractActor {
  id: string;
  role: string | null | undefined;
}
export type ContractTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type ContractRow = typeof bookingContracts.$inferSelect;
export interface ContractStorage {
  put(key: string, bytes: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  remove(key: string): Promise<void>;
}
export interface ContractsRoutesOptions {
  storage?: ContractStorage;
}
