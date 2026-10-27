import type { NewUnitType, Role } from "@metastorage/database";

export type UpdateUnitTypeData = Partial<Omit<NewUnitType, "id" | "createdAt" | "updatedAt">>;
export type UnitTypeActor = { id: string; role?: Role | null };
