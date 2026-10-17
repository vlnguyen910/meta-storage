import { z } from "zod";

export enum StorageUnitStatus {
  AVAILABLE = "AVAILABLE",
  RESERVED = "RESERVED",
  OCCUPIED = "OCCUPIED",
  MAINTENANCE = "MAINTENANCE",
  INSPECTION = "INSPECTION",
  RETURN_PENDING = "RETURN_PENDING",
  LOCKED = "LOCKED",
  INACTIVE = "INACTIVE",
}

export const UnitAvailabilityOptionSchema = z.object({
  facilityId: z.string(),
  unitTypeId: z.string(),
  unitType: z.string(),
  sizeLabel: z.string(),
  sizeSqm: z.number().positive(),
  monthlyPrice: z.number().nonnegative(),
  availableCount: z.number().int().nonnegative(),
});

export type UnitAvailabilityOption = z.infer<typeof UnitAvailabilityOptionSchema>;

export const EligibleUnitSchema = z.object({
  id: z.string().uuid(),
  facilityId: z.string().uuid(),
  unitTypeId: z.string().uuid(),
  code: z.string(),
  floor: z.string().nullable().optional(),
  locationDescription: z.string().nullable().optional(),
  status: z.string(),
  isAvailableForPeriod: z.boolean(),
});

export type EligibleUnit = z.infer<typeof EligibleUnitSchema>;
