import { relations } from "drizzle-orm";
import { accounts } from "./accounts";
import { bookingAccessAudit } from "./booking-access-audit";
import { bookings } from "./bookings";
import { capacityAllocations } from "./capacity-allocations";
import { checkInSlots } from "./check-in-slots";
import { checkInVerifications } from "./checkin-verifications";
import { facilities } from "./facilities";
import { facilityAssignments } from "./facility-assignments";
import { facilityOperatingHours } from "./facility-operating-hours";
import { facilityUnitTypes } from "./facility-unit-types";
import { paymentProviderEvents } from "./payment-provider-events";
import { payments } from "./payments";
import {
  rentalChargeAdjustments,
  rentalChargeEvents,
  rentalChargeRefunds,
} from "./rental-charge-financials";
import { rentalCharges } from "./rental-charges";
import { rentalRenewals } from "./rental-renewals";
import { rentals } from "./rentals";
import { reservationDrafts } from "./reservation-drafts";
import { returnSettlements } from "./returns";
import { sessions } from "./sessions";
import { storageUnits } from "./storage-units";
import {
  supportAttachments,
  supportAudit,
  supportIdempotency,
  supportMessages,
  supportTickets,
} from "./support";
import { unitAssignments } from "./unit-assignments";
import { unitTypes } from "./unit-types";
import { users } from "./users";

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  facilityAssignments: many(facilityAssignments),
  bookings: many(bookings, { relationName: "bookingOwner" }),
  assignedBookings: many(bookings, { relationName: "bookingStaff" }),
  assignedUnits: many(unitAssignments),
  checkInVerifications: many(checkInVerifications),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  booking: one(bookings, { fields: [payments.bookingId], references: [bookings.id] }),
  rentalCharge: one(rentalCharges, {
    fields: [payments.rentalChargeId],
    references: [rentalCharges.id],
  }),
}));

export const rentalChargesRelations = relations(rentalCharges, ({ one, many }) => ({
  rental: one(rentals, { fields: [rentalCharges.rentalId], references: [rentals.id] }),
  creator: one(users, { fields: [rentalCharges.createdBy], references: [users.id] }),
  approver: one(users, { fields: [rentalCharges.approvedBy], references: [users.id] }),
  payments: many(payments),
  adjustments: many(rentalChargeAdjustments),
  events: many(rentalChargeEvents),
  refunds: many(rentalChargeRefunds),
}));

export const rentalChargeAdjustmentsRelations = relations(rentalChargeAdjustments, ({ one }) => ({
  charge: one(rentalCharges, {
    fields: [rentalChargeAdjustments.chargeId],
    references: [rentalCharges.id],
  }),
  settlement: one(returnSettlements, {
    fields: [rentalChargeAdjustments.settlementId],
    references: [returnSettlements.id],
  }),
  creator: one(users, { fields: [rentalChargeAdjustments.createdBy], references: [users.id] }),
}));

export const rentalChargeEventsRelations = relations(rentalChargeEvents, ({ one }) => ({
  charge: one(rentalCharges, {
    fields: [rentalChargeEvents.chargeId],
    references: [rentalCharges.id],
  }),
  actor: one(users, { fields: [rentalChargeEvents.actorId], references: [users.id] }),
}));

export const rentalChargeRefundsRelations = relations(rentalChargeRefunds, ({ one }) => ({
  charge: one(rentalCharges, {
    fields: [rentalChargeRefunds.chargeId],
    references: [rentalCharges.id],
  }),
  payment: one(payments, { fields: [rentalChargeRefunds.paymentId], references: [payments.id] }),
  settlement: one(returnSettlements, {
    fields: [rentalChargeRefunds.settlementId],
    references: [returnSettlements.id],
  }),
  confirmer: one(users, { fields: [rentalChargeRefunds.confirmedBy], references: [users.id] }),
}));

export const returnSettlementsRelations = relations(returnSettlements, ({ one }) => ({
  rentalCharge: one(rentalCharges, {
    fields: [returnSettlements.rentalChargeId],
    references: [rentalCharges.id],
  }),
}));

export const paymentProviderEventsRelations = relations(paymentProviderEvents, ({ one }) => ({
  payment: one(payments, {
    fields: [paymentProviderEvents.paymentId],
    references: [payments.id],
  }),
}));

export const facilitiesRelations = relations(facilities, ({ many }) => ({
  unitTypes: many(facilityUnitTypes),
  assignments: many(facilityAssignments),
  storageUnits: many(storageUnits),
  operatingHours: many(facilityOperatingHours),
  reservationDrafts: many(reservationDrafts),
  capacityAllocations: many(capacityAllocations),
  bookings: many(bookings),
  rentals: many(rentals),
  checkInVerifications: many(checkInVerifications),
}));

export const unitTypesRelations = relations(unitTypes, ({ many }) => ({
  facilities: many(facilityUnitTypes),
  storageUnits: many(storageUnits),
  bookings: many(bookings),
}));

export const facilityUnitTypesRelations = relations(facilityUnitTypes, ({ one }) => ({
  facility: one(facilities, {
    fields: [facilityUnitTypes.facilityId],
    references: [facilities.id],
  }),
  unitType: one(unitTypes, {
    fields: [facilityUnitTypes.unitTypeId],
    references: [unitTypes.id],
  }),
}));

export const facilityAssignmentsRelations = relations(facilityAssignments, ({ one }) => ({
  user: one(users, {
    fields: [facilityAssignments.userId],
    references: [users.id],
  }),
  facility: one(facilities, {
    fields: [facilityAssignments.facilityId],
    references: [facilities.id],
  }),
}));

export const storageUnitsRelations = relations(storageUnits, ({ one, many }) => ({
  facility: one(facilities, {
    fields: [storageUnits.facilityId],
    references: [facilities.id],
  }),
  unitType: one(unitTypes, {
    fields: [storageUnits.unitTypeId],
    references: [unitTypes.id],
  }),
  assignments: many(unitAssignments),
  rentals: many(rentals),
}));

export const facilityOperatingHoursRelations = relations(facilityOperatingHours, ({ one }) => ({
  facility: one(facilities, {
    fields: [facilityOperatingHours.facilityId],
    references: [facilities.id],
  }),
}));

export const reservationDraftsRelations = relations(reservationDrafts, ({ one }) => ({
  facility: one(facilities, {
    fields: [reservationDrafts.facilityId],
    references: [facilities.id],
  }),
  unitType: one(unitTypes, {
    fields: [reservationDrafts.unitTypeId],
    references: [unitTypes.id],
  }),
}));

export const capacityAllocationsRelations = relations(capacityAllocations, ({ one }) => ({
  facility: one(facilities, {
    fields: [capacityAllocations.facilityId],
    references: [facilities.id],
  }),
  unitType: one(unitTypes, {
    fields: [capacityAllocations.unitTypeId],
    references: [unitTypes.id],
  }),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  checkInSlot: one(checkInSlots, {
    fields: [bookings.checkInSlotId],
    references: [checkInSlots.id],
  }),
  owner: one(users, {
    fields: [bookings.userId],
    references: [users.id],
    relationName: "bookingOwner",
  }),
  facility: one(facilities, {
    fields: [bookings.facilityId],
    references: [facilities.id],
  }),
  unitType: one(unitTypes, {
    fields: [bookings.unitTypeId],
    references: [unitTypes.id],
  }),
  assignedStaff: one(users, {
    relationName: "bookingStaff",
    fields: [bookings.assignedStaffId],
    references: [users.id],
  }),
  unitAssignments: many(unitAssignments),
  rental: one(rentals),
  accessAudits: many(bookingAccessAudit),
  checkInVerifications: many(checkInVerifications),
}));

export const bookingAccessAuditRelations = relations(bookingAccessAudit, ({ one }) => ({
  booking: one(bookings, {
    fields: [bookingAccessAudit.bookingId],
    references: [bookings.id],
  }),
}));

export const unitAssignmentsRelations = relations(unitAssignments, ({ one }) => ({
  booking: one(bookings, {
    fields: [unitAssignments.bookingId],
    references: [bookings.id],
  }),
  physicalUnit: one(storageUnits, {
    fields: [unitAssignments.physicalUnitId],
    references: [storageUnits.id],
  }),
  assigner: one(users, {
    fields: [unitAssignments.assignedBy],
    references: [users.id],
  }),
}));

export const checkInVerificationsRelations = relations(checkInVerifications, ({ one }) => ({
  booking: one(bookings, {
    fields: [checkInVerifications.bookingId],
    references: [bookings.id],
  }),
  facility: one(facilities, {
    fields: [checkInVerifications.facilityId],
    references: [facilities.id],
  }),
  staff: one(users, {
    fields: [checkInVerifications.staffId],
    references: [users.id],
  }),
  unitAssignment: one(unitAssignments, {
    fields: [checkInVerifications.unitAssignmentId],
    references: [unitAssignments.id],
  }),
}));

export const rentalsRelations = relations(rentals, ({ one, many }) => ({
  booking: one(bookings, {
    fields: [rentals.bookingId],
    references: [bookings.id],
  }),
  facility: one(facilities, {
    fields: [rentals.facilityId],
    references: [facilities.id],
  }),
  physicalUnit: one(storageUnits, {
    fields: [rentals.physicalUnitId],
    references: [storageUnits.id],
  }),
  charges: many(rentalCharges),
  renewals: many(rentalRenewals),
}));

export const rentalRenewalsRelations = relations(rentalRenewals, ({ one }) => ({
  rental: one(rentals, { fields: [rentalRenewals.rentalId], references: [rentals.id] }),
  customer: one(users, { fields: [rentalRenewals.customerId], references: [users.id] }),
  charge: one(rentalCharges, { fields: [rentalRenewals.chargeId], references: [rentalCharges.id] }),
  payment: one(payments, { fields: [rentalRenewals.paymentId], references: [payments.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const checkInSlotsRelations = relations(checkInSlots, ({ many }) => ({
  bookings: many(bookings),
}));

export const supportTicketsRelations = relations(supportTickets, ({ one, many }) => ({
  booking: one(bookings, { fields: [supportTickets.bookingId], references: [bookings.id] }),
  owner: one(users, {
    fields: [supportTickets.ownerUserId],
    references: [users.id],
    relationName: "supportOwner",
  }),
  facility: one(facilities, { fields: [supportTickets.facilityId], references: [facilities.id] }),
  rental: one(rentals, { fields: [supportTickets.rentalId], references: [rentals.id] }),
  storageUnit: one(storageUnits, {
    fields: [supportTickets.storageUnitId],
    references: [storageUnits.id],
  }),
  payment: one(payments, { fields: [supportTickets.paymentId], references: [payments.id] }),
  assignee: one(users, {
    fields: [supportTickets.assignedStaffId],
    references: [users.id],
    relationName: "supportAssignee",
  }),
  assigner: one(users, {
    fields: [supportTickets.assignedBy],
    references: [users.id],
    relationName: "supportAssigner",
  }),
  closer: one(users, {
    fields: [supportTickets.closedBy],
    references: [users.id],
    relationName: "supportCloser",
  }),
  messages: many(supportMessages),
  attachments: many(supportAttachments),
  audit: many(supportAudit),
  idempotency: many(supportIdempotency),
}));
export const supportMessagesRelations = relations(supportMessages, ({ one, many }) => ({
  ticket: one(supportTickets, {
    fields: [supportMessages.ticketId],
    references: [supportTickets.id],
  }),
  author: one(users, { fields: [supportMessages.authorId], references: [users.id] }),
  attachments: many(supportAttachments),
}));
export const supportAttachmentsRelations = relations(supportAttachments, ({ one }) => ({
  ticket: one(supportTickets, {
    fields: [supportAttachments.ticketId],
    references: [supportTickets.id],
  }),
  message: one(supportMessages, {
    fields: [supportAttachments.ticketId, supportAttachments.messageId],
    references: [supportMessages.ticketId, supportMessages.id],
  }),
  uploader: one(users, { fields: [supportAttachments.uploadedBy], references: [users.id] }),
}));
export const supportAuditRelations = relations(supportAudit, ({ one }) => ({
  ticket: one(supportTickets, { fields: [supportAudit.ticketId], references: [supportTickets.id] }),
  actor: one(users, {
    fields: [supportAudit.actorId],
    references: [users.id],
    relationName: "supportAuditActor",
  }),
  previousStaff: one(users, {
    fields: [supportAudit.previousStaffId],
    references: [users.id],
    relationName: "supportAuditPreviousStaff",
  }),
  nextStaff: one(users, {
    fields: [supportAudit.nextStaffId],
    references: [users.id],
    relationName: "supportAuditNextStaff",
  }),
}));
export const supportIdempotencyRelations = relations(supportIdempotency, ({ one }) => ({
  ticket: one(supportTickets, {
    fields: [supportIdempotency.ticketId],
    references: [supportTickets.id],
  }),
  actor: one(users, { fields: [supportIdempotency.actorId], references: [users.id] }),
}));
