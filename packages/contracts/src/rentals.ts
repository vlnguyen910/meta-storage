import { z } from "zod";
import { RENTAL_CONTRACT_MESSAGES } from "./rentals.messages";

export type * from "./rentals.types";

export const RENTAL_STATUSES = ["ACTIVE", "CLOSED"] as const;
export const RentalStatusSchema = z.enum(RENTAL_STATUSES);
export type RentalStatus = z.infer<typeof RentalStatusSchema>;

export const RentalIdParamsSchema = z.object({ rentalId: z.string().uuid() });

export const FacilityRentalParamsSchema = z.object({ facilityId: z.uuid(), rentalId: z.uuid() });
export const FacilityRentalListParamsSchema = z.object({ facilityId: z.uuid() });
export const FacilityRentalHistoryQuerySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});
export const FacilityRentalListQuerySchema = FacilityRentalHistoryQuerySchema.extend({
  status: RentalStatusSchema.optional(),
  search: z.string().trim().max(200).optional(),
  unitTypeId: z.uuid().optional(),
});
export type FacilityRentalListQuery = z.infer<typeof FacilityRentalListQuerySchema>;
export type FacilityRentalHistoryQuery = z.infer<typeof FacilityRentalHistoryQuerySchema>;

export const RentalPageQuerySchema = z
  .object({
    view: z
      .enum(["current", "history"], { error: RENTAL_CONTRACT_MESSAGES.invalidView })
      .default("current"),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    afterEndAt: z.string().datetime({ offset: true }).optional(),
    afterId: z.string().uuid().optional(),
  })
  .refine((query) => Boolean(query.afterEndAt) === Boolean(query.afterId), {
    message: RENTAL_CONTRACT_MESSAGES.incompleteCursor,
    path: ["afterId"],
  });

export type RentalPageQuery = z.infer<typeof RentalPageQuerySchema>;

export const RentalActionStateSchema = z.object({
  canCancel: z.literal(false),
  canReschedule: z.literal(false),
  note: z.string(),
});

export type RentalActionState = z.infer<typeof RentalActionStateSchema>;

export const RentalListItemSchema = z.object({
  id: z.string().uuid(),
  bookingId: z.string().uuid().nullable(),
  reservationId: z.string().uuid().nullable().optional(),
  userId: z.string().uuid(),
  bookingCode: z.string(),
  facility: z.object({
    id: z.string().uuid(),
    name: z.string(),
    address: z.string(),
  }),
  unitType: z.object({
    id: z.string().uuid(),
    name: z.string(),
    sizeLabel: z.string(),
  }),
  storageUnit: z.object({ id: z.string().uuid(), code: z.string() }).nullable(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  closedAt: z.string().datetime().nullable(),
  status: RentalStatusSchema,
  bookingStatus: z.string(),
  actions: RentalActionStateSchema,
});

export type RentalListItem = z.infer<typeof RentalListItemSchema>;

export const RentalDetailSchema = RentalListItemSchema.extend({
  customer: z.object({
    userId: z.string().uuid(),
    name: z.string().nullable(),
    email: z.string(),
    phone: z.string().nullable(),
  }),
});
export type RentalDetail = z.infer<typeof RentalDetailSchema>;
