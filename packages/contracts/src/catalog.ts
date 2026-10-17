import { z } from "zod";

export const CatalogFacilitySchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  address: z.string(),
  description: z.string().nullable(),
  availableUnits: z.number().int().nonnegative(),
  totalUnits: z.number().int().positive(),
  startingMonthlyPrice: z.number().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CatalogFacility = z.infer<typeof CatalogFacilitySchema>;

export const CatalogUnitTypeSchema = z.object({
  facilityId: z.string().uuid(),
  unitTypeId: z.string().uuid(),
  unitType: z.string(),
  sizeLabel: z.string(),
  sizeSqm: z.number().positive(),
  monthlyPrice: z.number().nonnegative(),
  availableCount: z.number().int().nonnegative(),
});

export type CatalogUnitType = z.infer<typeof CatalogUnitTypeSchema>;

export type { CatalogAvailabilityParams, CatalogFacilityListParams } from "./catalog.types";
