import { z } from "zod";

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
