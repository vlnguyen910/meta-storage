import type { Role } from "@metastorage/database";

export interface UnitTransitionUser {
  id: string;
  role: Role | null | undefined;
}
