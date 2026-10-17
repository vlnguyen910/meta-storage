import { z } from "zod";

export const ApiUnitTypeSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
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
export type UnitTypeListQuery = z.infer<typeof UnitTypeListQuerySchema>;
export type UnitTypeListParams = Partial<UnitTypeListQuery>;
