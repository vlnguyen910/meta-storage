import type { AppointmentQuery, UpdateAppointmentInput } from "@metastorage/contracts";
import {
  and,
  appointments,
  asc,
  checkInSlots,
  type Database,
  eq,
  getTableColumns,
  inArray,
  type NewAppointmentRecord,
  reservations,
  users,
} from "@metastorage/database";
import { APPOINTMENT_STATUSES as Status } from "@metastorage/database/schema/appointments";
import { ConflictError } from "../../common/errors/app-error";
import { APPOINTMENT_MESSAGES as m } from "./appointments.messages";

export type AppointmentTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export class AppointmentsRepository {
  constructor(private readonly db: Database) {}

  closeForReservation(
    tx: AppointmentTransaction,
    reservationId: string,
    status: Status.CANCELLED | Status.NO_SHOW,
  ) {
    return tx
      .update(appointments)
      .set({ status, updatedAt: new Date() })
      .where(
        and(
          eq(appointments.reservationId, reservationId),
          inArray(appointments.status, [Status.SCHEDULED, Status.CONFIRMED]),
        ),
      )
      .returning();
  }

  async findActiveForContext(
    tx: AppointmentTransaction,
    context: { reservationId?: string; rentalId?: string; supportTicketId?: string },
  ) {
    const [appointment] = await tx
      .select()
      .from(appointments)
      .where(
        and(
          context.reservationId ? eq(appointments.reservationId, context.reservationId) : undefined,
          context.rentalId ? eq(appointments.rentalId, context.rentalId) : undefined,
          context.supportTicketId
            ? eq(appointments.supportTicketId, context.supportTicketId)
            : undefined,
          inArray(appointments.status, [Status.SCHEDULED, Status.CONFIRMED]),
        ),
      );
    return appointment;
  }

  transaction<T>(work: (tx: AppointmentTransaction) => Promise<T>): Promise<T> {
    return this.db.transaction(work);
  }

  async create(data: NewAppointmentRecord, tx: AppointmentTransaction) {
    const [appointment] = await tx.insert(appointments).values(data).returning();
    return appointment;
  }

  private readQuery() {
    return this.db
      .select({
        ...getTableColumns(appointments),
        customerName: users.name,
        slotName: checkInSlots.name,
        slotStart: checkInSlots.startTime,
        slotEnd: checkInSlots.endTime,
        reservation: {
          unitTypeId: reservations.unitTypeId,
          rentalStartAt: reservations.rentalStartAt,
          rentalEndAt: reservations.rentalEndAt,
        },
      })
      .from(appointments)
      .innerJoin(users, eq(users.id, appointments.customerId))
      .innerJoin(checkInSlots, eq(checkInSlots.id, appointments.slotId))
      .leftJoin(reservations, eq(reservations.id, appointments.reservationId));
  }

  async findById(id: string) {
    const [appointment] = await this.readQuery().where(eq(appointments.id, id));
    return appointment;
  }

  async findByIdForUpdate(id: string, tx: AppointmentTransaction) {
    const [appointment] = await tx
      .select()
      .from(appointments)
      .where(eq(appointments.id, id))
      .for("update");
    return appointment;
  }

  list(query: AppointmentQuery & { customerId?: string; assignedStaffId?: string }) {
    return this.readQuery()
      .where(
        and(
          query.customerId ? eq(appointments.customerId, query.customerId) : undefined,
          query.facilityId ? eq(appointments.facilityId, query.facilityId) : undefined,
          query.assignedStaffId
            ? eq(appointments.assignedStaffId, query.assignedStaffId)
            : undefined,
          query.appointmentType
            ? eq(appointments.appointmentType, query.appointmentType)
            : undefined,
          query.status ? eq(appointments.status, query.status) : undefined,
        ),
      )
      .orderBy(asc(appointments.scheduledDate), asc(appointments.id));
  }

  async update(id: string, data: UpdateAppointmentInput, tx: AppointmentTransaction) {
    try {
      const [appointment] = await tx
        .update(appointments)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(appointments.id, id))
        .returning();
      return appointment;
    } catch (error) {
      const cause = error instanceof Error && error.cause ? error.cause : error;
      if (
        cause &&
        typeof cause === "object" &&
        "code" in cause &&
        cause.code === "23505" &&
        "constraint_name" in cause &&
        cause.constraint_name === "appointments_check_out_slot_idx"
      )
        throw new ConflictError(m.slotUnavailable);
      throw error;
    }
  }
}
