import { z } from "zod";
import { CoverImageUrlSchema } from "./media-assets";

export const ApiUnitTypeSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  coverUrl: z.string().nullable(),
  priceRangeId: z.string().uuid().nullable().optional(),
  sizeLabel: z.string(),
  lengthM: z.number().positive(),
  widthM: z.number().positive(),
  heightM: z.number().positive(),
  sizeCbm: z.number().positive(),
  monthlyPrice: z.number().int().nonnegative(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ApiUnitType = z.infer<typeof ApiUnitTypeSchema>;

export const UnitTypeListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export const UnitTypeManagementQuerySchema = UnitTypeListQuerySchema.extend({
  facilityId: z.uuid().optional(),
  isActive: z.preprocess(
    (value) => (value === "true" ? true : value === "false" ? false : value),
    z.boolean().optional(),
  ),
}).strict();
export type UnitTypeManagementQuery = z.infer<typeof UnitTypeManagementQuerySchema>;
export type UnitTypeListQuery = z.infer<typeof UnitTypeListQuerySchema>;
export type UnitTypeListParams = Partial<UnitTypeListQuery>;

// Legacy management-form contract. HTTP catalog writes use CreateUnitTypeCatalogSchema.
export const CreateUnitTypeSchema = z
  .object({
    facilityId: z.uuid(),
    code: z.string().trim().min(1).max(80),
    name: z.string().trim().min(1).max(100),
    coverUrl: CoverImageUrlSchema,
    sizeLabel: z.string().trim().min(1).max(50),
    lengthM: z.number().positive(),
    widthM: z.number().positive(),
    heightM: z.number().positive(),
    monthlyPrice: z.number().int().positive().max(2147483647),
  })
  .strict();
export const UpdateUnitTypeSchema = CreateUnitTypeSchema.omit({ facilityId: true })
  .partial()
  .extend({
    coverUrl: CoverImageUrlSchema.optional(),
    isActive: z.boolean().optional(),
    expectedVersion: z.number().int().nonnegative().max(2147483646),
  })
  .strict()
  .refine((v) => Object.keys(v).some((key) => key !== "expectedVersion"));
export const UnitTypeIdParamsSchema = z.object({ id: z.string().uuid() });
export type CreateUnitTypeInput = z.infer<typeof CreateUnitTypeSchema>;
export type UpdateUnitTypeInput = z.infer<typeof UpdateUnitTypeSchema>;
export type { FacilityUnitTypeDto } from "./unit-types.types";

const catalogPrice = z.number().int().positive().max(2147483647);
export const CreateUnitTypeCatalogSchema = CreateUnitTypeSchema.omit({
  facilityId: true,
  monthlyPrice: true,
})
  .extend({ minMonthlyPrice: catalogPrice, maxMonthlyPrice: catalogPrice })
  .strict()
  .refine((v) => v.maxMonthlyPrice >= v.minMonthlyPrice);
export const UpdateUnitTypeCatalogSchema = CreateUnitTypeSchema.omit({
  facilityId: true,
  monthlyPrice: true,
})
  .partial()
  .extend({
    minMonthlyPrice: catalogPrice.optional(),
    maxMonthlyPrice: catalogPrice.optional(),
    isActive: z.boolean().optional(),
    expectedVersion: z.number().int().nonnegative().max(2147483646),
  })
  .strict()
  .refine((v) => Object.keys(v).some((k) => k !== "expectedVersion"));
export type CreateUnitTypeCatalog = z.infer<typeof CreateUnitTypeCatalogSchema>;
export type UpdateUnitTypeCatalog = z.infer<typeof UpdateUnitTypeCatalogSchema>;
export const CreateFacilityUnitTypeSchema = z.strictObject({
  unitTypeId: z.uuid(),
  monthlyPrice: catalogPrice,
});
export const UpdateFacilityUnitTypeSchema = z
  .strictObject({
    monthlyPrice: catalogPrice.optional(),
    isActive: z.boolean().optional(),
    expectedVersion: z.number().int().nonnegative().max(2147483646),
  })
  .refine((v) => Object.keys(v).some((k) => k !== "expectedVersion"));
export type CreateFacilityUnitType = z.infer<typeof CreateFacilityUnitTypeSchema>;
export type UpdateFacilityUnitType = z.infer<typeof UpdateFacilityUnitTypeSchema>;

export const UnitTypeCatalogQuerySchema = UnitTypeManagementQuerySchema.omit({ facilityId: true });
export const ApiUnitTypeCatalogSchema = ApiUnitTypeSchema.omit({
  monthlyPrice: true,
  priceRangeId: true,
}).extend({
  minMonthlyPrice: catalogPrice,
  maxMonthlyPrice: catalogPrice,
  version: z.number().int().nonnegative(),
  updatedBy: z.uuid().nullable(),
});
export type UnitTypeCatalogDto = z.infer<typeof ApiUnitTypeCatalogSchema>;
