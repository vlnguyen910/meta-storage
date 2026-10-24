import { z } from "zod";
import { BOOKING_CONTRACT_MESSAGES } from "./bookings.messages";
import { FacilityStaffMemberSchema } from "./facilities";
import { ReservationDraftContactSchema } from "./reservation-contact";

export type {
  BookingClosure,
  BookingDraft,
  BookingDraftPricing,
  BookingTracking,
  BookingTrackingSession,
  CheckInSlotOption,
  CustomerBooking,
  CustomerBookingPage,
  CustomerBookingPageCursor,
} from "./bookings.types";

export const RequestGuestAccessLinkSchema = z.strictObject({
  bookingCode: z.string().trim().min(1).max(50),
  email: z.email().max(320),
  idempotencyKey: z.uuid(),
});
export type RequestGuestAccessLink = z.infer<typeof RequestGuestAccessLinkSchema>;

export const GuestContractParamsSchema = z.object({
  bookingCode: z.string().trim().min(1).max(50),
  contractId: z.uuid(),
});
export const GuestContractDownloadQuerySchema = z.object({
  download: z.enum(["true", "false"]).default("false"),
});

export const BookingMagicLinkInputSchema = z.object({
  token: z
    .string({ error: BOOKING_CONTRACT_MESSAGES.invalidMagicToken })
    .regex(/^[a-f0-9]{64}$/, BOOKING_CONTRACT_MESSAGES.invalidMagicToken),
});
export type BookingMagicLinkInput = z.infer<typeof BookingMagicLinkInputSchema>;

export const BookingTrackingParamsSchema = z.object({
  bookingCode: z
    .string({ error: BOOKING_CONTRACT_MESSAGES.invalidBookingCode })
    .min(1, BOOKING_CONTRACT_MESSAGES.invalidBookingCode)
    .max(50, BOOKING_CONTRACT_MESSAGES.invalidBookingCode),
});

export const BookingDraftInputSchema = z.object({
  facilityId: z.string().uuid(),
  unitTypeId: z.string().uuid(),
  checkInSlotId: z.string().uuid(),
  checkInDate: z.iso.date(),
  durationMonths: z.number().int().min(1).max(12),
});

export type BookingDraftInput = z.infer<typeof BookingDraftInputSchema>;

export const PaidBookingSchema = z.object({
  id: z.string().uuid(),
  bookingCode: z.string(),
  facilityId: z.string().uuid(),
  unitTypeId: z.string().uuid(),
  checkInAt: z.string().datetime(),
  rentalEndAt: z.string().datetime(),
  durationMonths: z.number().int().min(1).max(12),
  status: z.literal("CONFIRMED"),
  paidAt: z.string().datetime(),
  contact: ReservationDraftContactSchema,
  pricing: z.object({
    rentalFeeAmount: z.string(),
    depositAmount: z.string(),
    totalAmount: z.string(),
    currency: z.string().length(3),
  }),
});

export type PaidBooking = z.infer<typeof PaidBookingSchema>;

export const BookingConfirmationSchema = z.object({
  bookingId: z.string().uuid(),
  bookingCode: z.string(),
  qrToken: z.string().min(32),
  qrUrl: z.string().url(),
  facility: z.object({ name: z.string(), address: z.string() }),
  checkInSlotStart: z.string().datetime(),
  checkInSlotEnd: z.string().datetime().nullable(),
  rentalEndAt: z.string().datetime(),
  unitTypeName: z.string(),
  sizeLabel: z.string(),
  durationMonths: z.number().int().min(1).max(12),
  emailStatus: z.enum(["QUEUED", "PENDING", "SENT", "FAILED"]),
});

export type BookingConfirmation = z.infer<typeof BookingConfirmationSchema>;

export const PhysicalUnitAssignmentSchema = z.object({
  id: z.string().uuid(),
  bookingId: z.string().uuid(),
  physicalUnitId: z.string().uuid(),
  physicalUnitCode: z.string(),
  assignedBy: z.string().uuid(),
  assignerName: z.string().optional(),
  status: z.enum(["ACTIVE", "REASSIGNED", "CANCELLED"]),
  assignedAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable(),
  reason: z.string().nullable().optional(),
});

export type PhysicalUnitAssignment = z.infer<typeof PhysicalUnitAssignmentSchema>;

export const AssignBookingStaffInputSchema = z.object({
  staffId: z.string().uuid(),
  notes: z.string().max(500).optional(),
});

export type AssignBookingStaffInput = z.infer<typeof AssignBookingStaffInputSchema>;

export const BookingListItemSchema = z.object({
  id: z.string().uuid(),
  bookingCode: z.string(),
  facilityId: z.string().uuid(),
  facilityName: z.string(),
  unitTypeId: z.string().uuid(),
  unitTypeName: z.string(),
  unitTypeSizeLabel: z.string(),
  contactName: z.string(),
  contactEmail: z.string(),
  contactPhone: z.string(),
  checkInSlotStart: z.string().datetime(),
  checkInSlotEnd: z.string().datetime().nullable(),
  rentalEndAt: z.string().datetime(),
  requestedMonths: z.number().int(),
  totalAmount: z.number().nonnegative(),
  status: z.enum(["CONFIRMED", "CANCELLED", "NO_SHOW", "CHECKED_IN"]),
  paidAt: z.string().datetime().nullable(),
  assignedUnit: PhysicalUnitAssignmentSchema.nullable().optional(),
  assignedStaff: FacilityStaffMemberSchema.nullable().optional(),
  handoverStage: z
    .enum(["WAITING_CUSTOMER", "INSPECTING", "READY_HANDOVER", "HANDED_OVER"])
    .optional(),
  earlyCheckInAllowed: z.boolean().optional(),
  createdAt: z.string().datetime(),
});

export type BookingListItem = z.infer<typeof BookingListItemSchema>;

export const AssignPhysicalUnitInputSchema = z.object({
  physicalUnitId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

export type AssignPhysicalUnitInput = z.infer<typeof AssignPhysicalUnitInputSchema>;

export const FacilityBookingsParamsSchema = z.object({
  facilityId: z.string().uuid(),
});
export type FacilityBookingsParams = z.infer<typeof FacilityBookingsParamsSchema>;

export const BookingIdParamsSchema = z.object({
  id: z.string().uuid(),
});
export type BookingIdParams = z.infer<typeof BookingIdParamsSchema>;

export const AssignPhysicalUnitBodySchema = AssignPhysicalUnitInputSchema;
export type AssignPhysicalUnitBody = z.infer<typeof AssignPhysicalUnitBodySchema>;

export const BookingListQuerySchema = z.object({
  status: z.enum(["CONFIRMED", "CANCELLED", "NO_SHOW", "CHECKED_IN"]).optional(),
});
export type BookingListQuery = z.infer<typeof BookingListQuerySchema>;

export const CustomerBookingPageQuerySchema = z
  .object({
    status: z.enum(["CONFIRMED", "CANCELLED", "NO_SHOW", "CHECKED_IN"]).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    afterCreatedAt: z.string().datetime({ offset: true }).optional(),
    afterId: z.string().uuid().optional(),
  })
  .refine((query) => Boolean(query.afterCreatedAt) === Boolean(query.afterId), {
    message: BOOKING_CONTRACT_MESSAGES.incompleteCustomerBookingCursor,
    path: ["afterId"],
  });
export type CustomerBookingPageQuery = z.infer<typeof CustomerBookingPageQuerySchema>;

export const AssignStaffBodySchema = AssignBookingStaffInputSchema;
export type AssignStaffBody = z.infer<typeof AssignStaffBodySchema>;

export const StaffTasksQuerySchema = z
  .object({
    facilityId: z.string().uuid().optional(),
    fromDate: z.iso.date().optional(),
    toDate: z.iso.date().optional(),
  })
  .refine((query) => !query.fromDate || !query.toDate || query.fromDate <= query.toDate, {
    message: BOOKING_CONTRACT_MESSAGES.invalidDateRange,
    path: ["toDate"],
  });
export type StaffTasksQuery = z.infer<typeof StaffTasksQuerySchema>;
