import { type AppointmentQuery, UserRole, UserStatus } from "@metastorage/contracts";
import {
  type AppointmentStatus,
  and,
  appointments,
  checkInSlots,
  count,
  type Database,
  desc,
  eq,
  facilities,
  facilityAssignments,
  gt,
  isNull,
  or,
  rentals,
  reservations,
  supportTickets,
  users,
} from "@metastorage/database";
import { APPOINTMENT_MESSAGES } from "./appointments.messages";

export class AppointmentsRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string) {
    const [row] = await this.db.select().from(appointments).where(eq(appointments.id, id));
    return row;
  }

  async findReservationContext(id: string) {
    const [row] = await this.db
      .select({ customerId: reservations.customerId, facilityId: reservations.facilityId })
      .from(reservations)
      .where(eq(reservations.id, id));
    return row;
  }

  async findRentalContext(id: string) {
    const [row] = await this.db
      .select({ customerId: reservations.customerId, facilityId: rentals.facilityId })
      .from(rentals)
      .innerJoin(reservations, eq(rentals.reservationId, reservations.id))
      .where(eq(rentals.id, id));
    return row;
  }

  async findSupportTicketContext(id: string) {
    const [row] = await this.db
      .select({ customerId: supportTickets.ownerUserId, facilityId: supportTickets.facilityId })
      .from(supportTickets)
      .where(eq(supportTickets.id, id));
    return row;
  }

  async isFacilityActive(id: string) {
    const [row] = await this.db
      .select({ id: facilities.id })
      .from(facilities)
      .where(and(eq(facilities.id, id), eq(facilities.isActive, true)));
    return !!row;
  }

  async isCustomerActive(id: string) {
    const [row] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.id, id),
          eq(users.role, UserRole.STORAGE_CUSTOMER),
          eq(users.status, UserStatus.ACTIVE),
        ),
      );
    return !!row;
  }

  async slotExists(id: string) {
    const [row] = await this.db
      .select({ id: checkInSlots.id })
      .from(checkInSlots)
      .where(eq(checkInSlots.id, id));
    return !!row;
  }

  async listSlots() {
    return this.db.select().from(checkInSlots).orderBy(checkInSlots.startTime);
  }

  async isStaffAssignedToFacility(id: string, facilityId: string) {
    const [row] = await this.db
      .select({ id: users.id })
      .from(users)
      .innerJoin(facilityAssignments, eq(facilityAssignments.userId, users.id))
      .where(
        and(
          eq(users.id, id),
          eq(users.role, UserRole.FACILITY_STAFF),
          eq(users.status, UserStatus.ACTIVE),
          eq(facilityAssignments.role, UserRole.FACILITY_STAFF),
          eq(facilityAssignments.facilityId, facilityId),
          eq(facilityAssignments.isActive, true),
          or(isNull(facilityAssignments.endedAt), gt(facilityAssignments.endedAt, new Date())),
        ),
      );
    return !!row;
  }

  async list(query: AppointmentQuery, customerId?: string, facilityId?: string) {
    const where = and(
      customerId ? eq(appointments.customerId, customerId) : undefined,
      facilityId ? eq(appointments.facilityId, facilityId) : undefined,
      query.date ? eq(appointments.scheduledDate, query.date) : undefined,
      query.type ? eq(appointments.appointmentType, query.type) : undefined,
      query.status ? eq(appointments.status, query.status) : undefined,
    );
    const [items, [total]] = await Promise.all([
      this.db
        .select()
        .from(appointments)
        .where(where)
        .orderBy(desc(appointments.scheduledDate), desc(appointments.id))
        .limit(query.limit)
        .offset(query.offset),
      this.db.select({ value: count() }).from(appointments).where(where),
    ]);
    return { items, total: total?.value ?? 0, limit: query.limit, offset: query.offset };
  }

  async create(input: typeof appointments.$inferInsert) {
    const [row] = await this.db.insert(appointments).values(input).returning();
    if (!row) throw new Error(APPOINTMENT_MESSAGES.createFailed);
    return row;
  }

  async update(
    id: string,
    status: AppointmentStatus,
    values: Partial<typeof appointments.$inferInsert>,
  ) {
    const [row] = await this.db
      .update(appointments)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(appointments.id, id), eq(appointments.status, status)))
      .returning();
    return row;
  }
}
