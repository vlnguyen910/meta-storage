import { type AppointmentQuery, UserRole, UserStatus } from "@metastorage/contracts";
import {
  type Appointment,
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
import type { PageDto } from "../../common/types/page.dto";
import { APPOINTMENT_MESSAGES } from "./appointments.messages";

export class AppointmentsRepository {
  constructor(private readonly database: Database) {}

  async findAppointmentById(appointmentId: string) {
    const [appointment] = await this.database
      .select()
      .from(appointments)
      .where(eq(appointments.id, appointmentId));
    return appointment;
  }

  async findReservationContext(reservationId: string) {
    const [reservationContext] = await this.database
      .select({ customerId: reservations.customerId, facilityId: reservations.facilityId })
      .from(reservations)
      .where(eq(reservations.id, reservationId));
    return reservationContext;
  }

  async findRentalContext(rentalId: string) {
    const [rentalContext] = await this.database
      .select({ customerId: reservations.customerId, facilityId: rentals.facilityId })
      .from(rentals)
      .innerJoin(reservations, eq(rentals.reservationId, reservations.id))
      .where(eq(rentals.id, rentalId));
    return rentalContext;
  }

  async findSupportTicketContext(supportTicketId: string) {
    const [supportTicketContext] = await this.database
      .select({ customerId: supportTickets.ownerUserId, facilityId: supportTickets.facilityId })
      .from(supportTickets)
      .where(eq(supportTickets.id, supportTicketId));
    return supportTicketContext;
  }

  async isFacilityActive(facilityId: string) {
    const [facility] = await this.database
      .select({ id: facilities.id })
      .from(facilities)
      .where(and(eq(facilities.id, facilityId), eq(facilities.isActive, true)));
    return !!facility;
  }

  async isCustomerActive(customerId: string) {
    const [customer] = await this.database
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.id, customerId),
          eq(users.role, UserRole.STORAGE_CUSTOMER),
          eq(users.status, UserStatus.ACTIVE),
        ),
      );
    return !!customer;
  }

  async slotExists(slotId: string) {
    const [slot] = await this.database
      .select({ id: checkInSlots.id })
      .from(checkInSlots)
      .where(eq(checkInSlots.id, slotId));
    return !!slot;
  }

  async listSlots() {
    return this.database.select().from(checkInSlots).orderBy(checkInSlots.startTime);
  }

  async isStaffAssignedToFacility(staffId: string, facilityId: string) {
    const [staff] = await this.database
      .select({ id: users.id })
      .from(users)
      .innerJoin(facilityAssignments, eq(facilityAssignments.userId, users.id))
      .where(
        and(
          eq(users.id, staffId),
          eq(users.role, UserRole.FACILITY_STAFF),
          eq(users.status, UserStatus.ACTIVE),
          eq(facilityAssignments.role, UserRole.FACILITY_STAFF),
          eq(facilityAssignments.facilityId, facilityId),
          eq(facilityAssignments.isActive, true),
          or(isNull(facilityAssignments.endedAt), gt(facilityAssignments.endedAt, new Date())),
        ),
      );
    return !!staff;
  }

  async listAppointments(
    query: AppointmentQuery,
    customerId?: string,
    facilityId?: string,
  ): Promise<PageDto<Appointment>> {
    const filterConditions = and(
      customerId ? eq(appointments.customerId, customerId) : undefined,
      customerId ? eq(appointments.createdBy, customerId) : undefined,
      facilityId ? eq(appointments.facilityId, facilityId) : undefined,
      query.date ? eq(appointments.scheduledDate, query.date) : undefined,
      query.type ? eq(appointments.appointmentType, query.type) : undefined,
      query.status ? eq(appointments.status, query.status) : undefined,
    );
    const [appointmentItems, [totalCount]] = await Promise.all([
      this.database
        .select()
        .from(appointments)
        .where(filterConditions)
        .orderBy(desc(appointments.scheduledDate), desc(appointments.id))
        .limit(query.limit)
        .offset(query.offset),
      this.database.select({ value: count() }).from(appointments).where(filterConditions),
    ]);
    return {
      items: appointmentItems,
      total: totalCount?.value ?? 0,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async createAppointment(input: typeof appointments.$inferInsert) {
    const [appointment] = await this.database.insert(appointments).values(input).returning();
    if (!appointment) throw new Error(APPOINTMENT_MESSAGES.createFailed);
    return appointment;
  }

  async updateAppointment(
    appointmentId: string,
    updates: Partial<typeof appointments.$inferInsert>,
  ) {
    const [appointment] = await this.database
      .update(appointments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(appointments.id, appointmentId))
      .returning();
    return appointment;
  }
}
