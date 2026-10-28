import { relations } from "drizzle-orm";
import { accounts } from "./accounts";
import { bookings } from "./bookings";
import { capacityAllocations } from "./capacity-allocations";
import { checkInSlots } from "./check-in-slots";
import { facilities } from "./facilities";
import { facilityAssignments } from "./facility-assignments";
import { facilityTasks } from "./facility-tasks";
import { inspections } from "./inspections";
import { mediaAssets } from "./media-assets";
import { paymentProviderEvents } from "./payment-provider-events";
import { payments } from "./payments";
import { rentals } from "./rentals";
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
  bookings: many(bookings, { relationName: "bookingOwner" }),
  assignedBookings: many(bookings, { relationName: "bookingStaff" }),
  assignedUnits: many(unitAssignments),
  inspections: many(inspections, { relationName: "inspectionInspector" }),
  rentals: many(rentals),
  mediaAssets: many(mediaAssets),
}));

export const inspectionsRelations = relations(inspections, ({ one }) => ({
  storageUnit: one(storageUnits, {
    fields: [inspections.storageUnitId],
    references: [storageUnits.id],
  }),
  rental: one(rentals, { fields: [inspections.rentalId], references: [rentals.id] }),
  booking: one(bookings, { fields: [inspections.bookingId], references: [bookings.id] }),
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

export const paymentsRelations = relations(payments, ({ one }) => ({
  booking: one(bookings, { fields: [payments.bookingId], references: [bookings.id] }),
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
  bookings: many(bookings),
}));

export const unitTypesRelations = relations(unitTypes, ({ many, one }) => ({
  facility: one(facilities, { fields: [unitTypes.facilityId], references: [facilities.id] }),
  storageUnits: many(storageUnits),
  bookings: many(bookings),
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
  inspections: many(inspections),
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

export const rentalsRelations = relations(rentals, ({ one, many }) => ({
  booking: one(bookings, { fields: [rentals.bookingId], references: [bookings.id] }),
  user: one(users, { fields: [rentals.userId], references: [users.id] }),
  storageUnit: one(storageUnits, {
    fields: [rentals.storageUnitId],
    references: [storageUnits.id],
  }),
  inspections: many(inspections),
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

export const supportTicketsRelations = relations(supportTickets, ({ one }) => ({
  booking: one(bookings, { fields: [supportTickets.bookingId], references: [bookings.id] }),
  owner: one(users, {
    fields: [supportTickets.ownerUserId],
    references: [users.id],
    relationName: "supportOwner",
  }),
  facility: one(facilities, { fields: [supportTickets.facilityId], references: [facilities.id] }),
  rental: one(rentals, { fields: [supportTickets.rentalId], references: [rentals.id] }),
  payment: one(payments, { fields: [supportTickets.paymentId], references: [payments.id] }),
}));
