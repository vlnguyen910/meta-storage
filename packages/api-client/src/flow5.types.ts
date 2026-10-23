import type { User } from "@metastorage/contracts";

export type Flow5AssignableAccount = Pick<User, "id" | "name" | "email" | "role" | "status">;
