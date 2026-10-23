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
export const UnitTypeManagementQuerySchema = UnitTypeListQuerySchema.extend({
  isActive: z.preprocess(
    (value) => (value === "true" ? true : value === "false" ? false : value),
    z.boolean().optional(),
  ),
}).strict();
export type UnitTypeManagementQuery = z.infer<typeof UnitTypeManagementQuerySchema>;
export type UnitTypeListQuery = z.infer<typeof UnitTypeListQuerySchema>;
export type UnitTypeListParams = Partial<UnitTypeListQuery>;

export const CreateUnitTypeSchema = z
  .object({
    code: z.string().trim().min(1).max(80),
    name: z.string().trim().min(1).max(100),
    sizeLabel: z.string().trim().min(1).max(50),
    lengthM: z.number().positive(),
    widthM: z.number().positive(),
    heightM: z.number().positive(),
    monthlyPrice: z.number().int().nonnegative(),
  })
  .strict();
export const UpdateUnitTypeSchema = CreateUnitTypeSchema.omit({ monthlyPrice: true })
  .partial()
  .extend({ isActive: z.boolean().optional() })
  .strict()
  .refine((v) => Object.keys(v).length > 0);
export const UnitTypeIdParamsSchema = z.object({ id: z.string().uuid() });
export type CreateUnitTypeInput = z.infer<typeof CreateUnitTypeSchema>;
export type UpdateUnitTypeInput = z.infer<typeof UpdateUnitTypeSchema>;
