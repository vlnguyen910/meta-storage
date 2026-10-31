import type { AppointmentQuery, UpdateAppointmentInput } from "@metastorage/contracts";
import {
  aliasedTable,
  and,
  appointments,
  asc,
  checkInSlots,
  type Database,
  eq,
  facilities,
  facilityTasks,
  getTableColumns,
  inArray,
  inspections,
  type NewAppointmentRecord,
  payments,
  reservations,
  sql,
  storageUnits,
  unitAssignments,
  unitTypes,
  users,
} from "@metastorage/database";
import { APPOINTMENT_STATUSES as Status } from "@metastorage/database/schema/appointments";
import { ConflictError } from "../../common/errors/app-error";
import { APPOINTMENT_MESSAGES as m } from "./appointments.messages";

export type AppointmentTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

const staff = aliasedTable(users, "appointment_staff");

export class AppointmentsRepository {
  constructor(private readonly db: Database) {}

  setReservationContact(tx: AppointmentTransaction, reservationId: string, phone: string) {
    return tx
      .update(appointments)
      .set({ contactPhone: phone, updatedAt: new Date() })
      .where(
        and(
          eq(appointments.reservationId, reservationId),
          inArray(appointments.status, [Status.SCHEDULED, Status.CONFIRMED]),
        ),
      );
  }
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
        contactPhone: sql<string | null>`coalesce(${appointments.contactPhone}, ${users.phone})`,
        customerEmail: users.email,
        assignedStaffName: staff.name,
        assignedUnit: {
          id: unitAssignments.id,
          physicalUnitId: unitAssignments.physicalUnitId,
          physicalUnitCode: storageUnits.code,
          assignedBy: unitAssignments.assignedBy,
          assignedAt: unitAssignments.assignedAt,
          endedAt: unitAssignments.endedAt,
          reason: unitAssignments.reason,
          status: unitAssignments.status,
        },
        slotName: checkInSlots.name,
        slotStart: checkInSlots.startTime,
        slotEnd: checkInSlots.endTime,
        reservation: { ...getTableColumns(reservations) },
        facility: { id: facilities.id, name: facilities.name, address: facilities.address },
        unitType: { id: unitTypes.id, name: unitTypes.name, sizeLabel: unitTypes.sizeLabel },
        handoverStage: sql<string>`case when ${appointments.status} = 'COMPLETED' then 'HANDED_OVER' when exists(select 1 from ${inspections} i join ${facilityTasks} t on t.id = i.task_id where t.reference_type = 'APPOINTMENT' and t.reference_id = ${appointments.id} and t.status <> 'CANCELLED' and i.status = 'PASSED') then 'READY_HANDOVER' when exists(select 1 from ${facilityTasks} t where t.reference_type = 'APPOINTMENT' and t.reference_id = ${appointments.id} and t.status = 'IN_PROGRESS') then 'INSPECTING' else 'WAITING_CUSTOMER' end`,
        paidAt: sql<Date | null>`(select ${payments.paidAt} from ${payments} where ${payments.reservationId} = ${appointments.reservationId} and ${payments.paidAt} is not null order by ${payments.paidAt} desc limit 1)`,
        paymentStatus: sql<
          string | null
        >`(select ${payments.status}::text from ${payments} where ${payments.reservationId} = ${appointments.reservationId} order by ${payments.createdAt} desc, ${payments.id} desc limit 1)`,
      })
      .from(appointments)
      .innerJoin(users, eq(users.id, appointments.customerId))
      .innerJoin(facilities, eq(facilities.id, appointments.facilityId))
      .innerJoin(checkInSlots, eq(checkInSlots.id, appointments.slotId))
      .leftJoin(reservations, eq(reservations.id, appointments.reservationId))
      .leftJoin(unitTypes, eq(unitTypes.id, reservations.unitTypeId))
      .leftJoin(staff, eq(staff.id, appointments.assignedStaffId))
      .leftJoin(
        unitAssignments,
        eq(
          unitAssignments.id,
          sql`(select ua.id from unit_assignments ua where ua.reservation_id = ${appointments.reservationId} order by ua.assigned_at desc,ua.id desc limit 1)`,
        ),
      )
      .leftJoin(storageUnits, eq(storageUnits.id, unitAssignments.physicalUnitId));
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
      const { physicalUnitId: _unit, assignmentReason: _reason, ...fields } = data;
      const [appointment] = await tx
        .update(appointments)
        .set({ ...fields, updatedAt: new Date() })
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
