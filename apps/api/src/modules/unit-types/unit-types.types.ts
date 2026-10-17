import type { NewUnitType } from "@metastorage/database";

export type UpdateUnitTypeData = Partial<Omit<NewUnitType, "id" | "createdAt" | "updatedAt">>;
