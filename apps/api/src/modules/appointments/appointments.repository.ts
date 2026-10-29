import type {
  AppointmentQuery,
  CreateAppointmentInput,
  UpdateAppointmentInput,
} from "@metastorage/contracts";
import {
  and,
  appointments,
  checkInSlots,
  type Database,
  desc,
  eq,
  facilities,
  facilityAssignments,
  rentals,
  reservations,
  storageUnits,
  supportTickets,
} from "@metastorage/database";

export class AppointmentsRepository {
  constructor(private readonly db: Database) {}
  reservationContext(id: string) {
    return this.db
      .select({
        facilityId: reservations.facilityId,
        customerId: reservations.customerId,
        status: reservations.status,
      })
      .from(reservations)
      .where(eq(reservations.id, id))
      .then(([row]) => row);
  }
  rentalContext(id: string) {
    return this.db
      .select({
        facilityId: storageUnits.facilityId,
        customerId: rentals.userId,
        status: rentals.status,
      })
      .from(rentals)
      .innerJoin(storageUnits, eq(storageUnits.id, rentals.storageUnitId))
      .where(eq(rentals.id, id))
      .then(([row]) => row);
  }
  async supportContext(id: string) {
    const [row] = await this.db
      .select({ facilityId: supportTickets.facilityId, customerId: supportTickets.ownerUserId })
      .from(supportTickets)
      .where(eq(supportTickets.id, id));
    return row ?? null;
  }
  async isFacilityActive(id: string) {
    const [row] = await this.db
      .select({ id: facilities.id })
      .from(facilities)
      .where(and(eq(facilities.id, id), eq(facilities.isActive, true)));
    return !!row;
  }
  async slotExists(id: string) {
    const [row] = await this.db
      .select({ id: checkInSlots.id })
      .from(checkInSlots)
      .where(eq(checkInSlots.id, id));
    return !!row;
  }
  create(
    input: CreateAppointmentInput & { facilityId: string; customerId: string; createdBy: string },
  ) {
    return this.db
      .insert(appointments)
      .values(input)
      .returning()
      .then(([row]) => row);
  }
  list(query: AppointmentQuery, customerId?: string, facilityId?: string, staffId?: string) {
    return this.db
      .select()
      .from(appointments)
      .where(
        and(
          customerId ? eq(appointments.customerId, customerId) : undefined,
          facilityId ? eq(appointments.facilityId, facilityId) : undefined,
          staffId ? eq(appointments.assignedStaffId, staffId) : undefined,
          query.facilityId && !facilityId
            ? eq(appointments.facilityId, query.facilityId)
            : undefined,
          query.appointmentType
            ? eq(appointments.appointmentType, query.appointmentType)
            : undefined,
          query.status ? eq(appointments.status, query.status) : undefined,
        ),
      )
      .orderBy(desc(appointments.scheduledDate));
  }
  async findById(id: string) {
    const [row] = await this.db.select().from(appointments).where(eq(appointments.id, id));
    return row;
  }
  async staffAssigned(facilityId: string, userId: string) {
    const [row] = await this.db
      .select({ id: facilityAssignments.id })
      .from(facilityAssignments)
      .where(
        and(
          eq(facilityAssignments.facilityId, facilityId),
          eq(facilityAssignments.userId, userId),
          eq(facilityAssignments.role, "FACILITY_STAFF"),
          eq(facilityAssignments.isActive, true),
        ),
      );
    return !!row;
  }
  async update(id: string, values: UpdateAppointmentInput, previousStatus: string) {
    const [row] = await this.db
      .update(appointments)
      .set({
        ...values,
        status: values.status,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(appointments.id, id),
          eq(appointments.status, previousStatus as typeof appointments.$inferSelect.status),
        ),
      )
      .returning();
    return row;
  }
}
