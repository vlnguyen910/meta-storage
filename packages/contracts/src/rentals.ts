import { z } from "zod";
import { RENTAL_CONTRACT_MESSAGES } from "./rentals.messages";

export type * from "./rentals.types";

export const RentalIdParamsSchema = z.object({ rentalId: z.string().uuid() });

export const FacilityRentalParamsSchema = z.object({ facilityId: z.uuid(), rentalId: z.uuid() });
export const FacilityRentalListParamsSchema = z.object({ facilityId: z.uuid() });
export const FacilityRentalHistoryQuerySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});
export const FacilityRentalListQuerySchema = FacilityRentalHistoryQuerySchema.extend({
  status: z.enum(["ACTIVE", "RETURN_PENDING", "OVERDUE", "CLOSED"]).optional(),
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

export const RentalStatusSchema = z.string().min(1);

export type RentalStatus = z.infer<typeof RentalStatusSchema>;

export const RentalActionStateSchema = z.object({
  canCancel: z.literal(false),
  canReschedule: z.literal(false),
  note: z.string(),
});

export type RentalActionState = z.infer<typeof RentalActionStateSchema>;

export const RentalListItemSchema = z.object({
  id: z.string().uuid(),
  bookingId: z.string().uuid(),
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
  physicalUnit: z.object({ id: z.string().uuid(), code: z.string() }).nullable(),
  startAt: z.string().datetime(),
  expectedEndAt: z.string().datetime(),
  status: RentalStatusSchema,
  bookingStatus: z.string(),
  actions: RentalActionStateSchema,
});

export type RentalListItem = z.infer<typeof RentalListItemSchema>;

export const RentalDetailSchema = RentalListItemSchema.extend({
  actualReturnAt: z.string().datetime().nullable(),
  closedAt: z.string().datetime().nullable(),
  depositAmount: z.string(),
  checkInSlotStart: z.string().datetime(),
  checkInSlotEnd: z.string().datetime().nullable(),
  timeline: z.array(
    z.object({
      label: z.string(),
      status: z.enum(["DONE", "CURRENT", "UPCOMING"]),
      at: z.string().datetime().nullable(),
    }),
  ),
});

export type RentalDetail = z.infer<typeof RentalDetailSchema>;
