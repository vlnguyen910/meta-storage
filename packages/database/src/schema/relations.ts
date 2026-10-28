import { relations } from "drizzle-orm";
import { accounts } from "./accounts";
import { appointments } from "./appointments";
import { capacityAllocations } from "./capacity-allocations";
import { checkInSlots } from "./check-in-slots";
import { checkInVerifications } from "./checkin-verifications";
import { facilities } from "./facilities";
import { facilityAssignments } from "./facility-assignments";
import { facilityTasks } from "./facility-tasks";
import { inspections } from "./inspections";
import { mediaAssets } from "./media-assets";
import { paymentProviderEvents } from "./payment-provider-events";
import { payments } from "./payments";
import {
  rentalChargeAdjustments,
  rentalChargeEvents,
  rentalChargeRefunds,
} from "./rental-charge-financials";
import { rentalCharges } from "./rental-charges";
import { rentalPriceRanges } from "./rental-price-ranges";
import { rentalRenewals } from "./rental-renewals";
import { rentals } from "./rentals";
import { reservations } from "./reservations";
import { sessions } from "./sessions";
import { storageUnits } from "./storage-units";
import { supportTickets } from "./support";
import { unitAssignments } from "./unit-assignments";
import { unitTypes } from "./unit-types";
import { users } from "./users";

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  facilityAssignments: many(facilityAssignments),
  reservations: many(reservations),
  appointments: many(appointments, { relationName: "appointmentCustomer" }),
  assignedAppointments: many(appointments, { relationName: "appointmentStaff" }),
  assignedUnits: many(unitAssignments),
  checkInVerifications: many(checkInVerifications),
  inspections: many(inspections, { relationName: "inspectionInspector" }),
  approvedReturnSettlements: many(rentals, { relationName: "rentalReturnSettlementApprover" }),
  mediaAssets: many(mediaAssets),
}));

export const inspectionsRelations = relations(inspections, ({ one }) => ({
  storageUnit: one(storageUnits, {
    fields: [inspections.storageUnitId],
    references: [storageUnits.id],
  }),
  rental: one(rentals, { fields: [inspections.rentalId], references: [rentals.id] }),
  reservation: one(reservations, {
    fields: [inspections.reservationId],
    references: [reservations.id],
  }),
  inspector: one(users, {
    fields: [inspections.inspectedBy],
    references: [users.id],
    relationName: "inspectionInspector",
  }),
  task: one(facilityTasks, { fields: [inspections.taskId], references: [facilityTasks.id] }),
}));

export const mediaAssetsRelations = relations(mediaAssets, ({ one }) => ({
  uploader: one(users, { fields: [mediaAssets.uploadedBy], references: [users.id] }),
}));

export const paymentsRelations = relations(payments, ({ one, many }) => ({
  reservation: one(reservations, {
    fields: [payments.reservationId],
    references: [reservations.id],
  }),
  rentalCharge: one(rentalCharges, {
    fields: [payments.rentalChargeId],
    references: [rentalCharges.id],
  }),
  rental: one(rentals, { fields: [payments.rentalId], references: [rentals.id] }),
  sourcePayment: one(payments, {
    fields: [payments.sourcePaymentId],
    references: [payments.id],
    relationName: "paymentRefundSource",
  }),
  refunds: many(payments, { relationName: "paymentRefundSource" }),
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
  confirmer: one(users, { fields: [rentalChargeRefunds.confirmedBy], references: [users.id] }),
}));

export const facilityTasksRelations = relations(facilityTasks, ({ many }) => ({
  inspections: many(inspections),
}));

export const paymentProviderEventsRelations = relations(paymentProviderEvents, ({ one }) => ({
  payment: one(payments, {
    fields: [paymentProviderEvents.paymentId],
    references: [payments.id],
  }),
}));

export const facilitiesRelations = relations(facilities, ({ many }) => ({
  unitTypes: many(unitTypes),
  assignments: many(facilityAssignments),
  storageUnits: many(storageUnits),
  capacityAllocations: many(capacityAllocations),
  reservations: many(reservations),
  appointments: many(appointments),
  rentals: many(rentals),
  checkInVerifications: many(checkInVerifications),
}));

export const unitTypesRelations = relations(unitTypes, ({ many, one }) => ({
  facility: one(facilities, { fields: [unitTypes.facilityId], references: [facilities.id] }),
  priceRange: one(rentalPriceRanges, {
    fields: [unitTypes.priceRangeId],
    references: [rentalPriceRanges.id],
  }),
  storageUnits: many(storageUnits),
  reservations: many(reservations),
}));

export const rentalPriceRangesRelations = relations(rentalPriceRanges, ({ many }) => ({
  unitTypes: many(unitTypes),
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
  inspections: many(inspections),
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

export const reservationsRelations = relations(reservations, ({ one, many }) => ({
  owner: one(users, {
    fields: [reservations.customerId],
    references: [users.id],
  }),
  facility: one(facilities, {
    fields: [reservations.facilityId],
    references: [facilities.id],
  }),
  unitType: one(unitTypes, {
    fields: [reservations.unitTypeId],
    references: [unitTypes.id],
  }),
  unitAssignments: many(unitAssignments),
  rental: one(rentals),
  checkInVerifications: many(checkInVerifications),
  inspections: many(inspections),
  appointments: many(appointments),
}));

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  facility: one(facilities, { fields: [appointments.facilityId], references: [facilities.id] }),
  customer: one(users, {
    relationName: "appointmentCustomer",
    fields: [appointments.customerId],
    references: [users.id],
  }),
  slot: one(checkInSlots, { fields: [appointments.slotId], references: [checkInSlots.id] }),
  reservation: one(reservations, {
    fields: [appointments.reservationId],
    references: [reservations.id],
  }),
  rental: one(rentals, { fields: [appointments.rentalId], references: [rentals.id] }),
  supportTicket: one(supportTickets, {
    fields: [appointments.supportTicketId],
    references: [supportTickets.id],
  }),
  assignedStaff: one(users, {
    relationName: "appointmentStaff",
    fields: [appointments.assignedStaffId],
    references: [users.id],
  }),
  creator: one(users, { fields: [appointments.createdBy], references: [users.id] }),
}));

export const unitAssignmentsRelations = relations(unitAssignments, ({ one }) => ({
  reservation: one(reservations, {
    fields: [unitAssignments.reservationId],
    references: [reservations.id],
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
  reservation: one(reservations, {
    fields: [checkInVerifications.reservationId],
    references: [reservations.id],
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
  reservation: one(reservations, {
    fields: [rentals.reservationId],
    references: [reservations.id],
  }),
  facility: one(facilities, {
    fields: [rentals.facilityId],
    references: [facilities.id],
  }),
  physicalUnit: one(storageUnits, {
    fields: [rentals.physicalUnitId],
    references: [storageUnits.id],
  }),
  appointments: many(appointments),
  returnSettlementApprover: one(users, {
    fields: [rentals.returnSettlementApprovedBy],
    references: [users.id],
    relationName: "rentalReturnSettlementApprover",
  }),
  charges: many(rentalCharges),
  renewals: many(rentalRenewals),
  inspections: many(inspections),
  payments: many(payments),
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
  appointments: many(appointments),
}));

export const supportTicketsRelations = relations(supportTickets, ({ one }) => ({
  reservation: one(reservations, {
    fields: [supportTickets.reservationId],
    references: [reservations.id],
  }),
  owner: one(users, {
    fields: [supportTickets.ownerUserId],
    references: [users.id],
    relationName: "supportOwner",
  }),
  facility: one(facilities, { fields: [supportTickets.facilityId], references: [facilities.id] }),
  rental: one(rentals, { fields: [supportTickets.rentalId], references: [rentals.id] }),
  payment: one(payments, { fields: [supportTickets.paymentId], references: [payments.id] }),
}));
