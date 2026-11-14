import { appointments, type Database, eq, facilityTasks } from "@metastorage/database";

export class NotificationsRepository {
  constructor(private readonly db: Database) {}

  async currentAppointment(appointmentId: string) {
    const [appointment] = await this.db
      .select({
        facilityId: appointments.facilityId,
        customerId: appointments.customerId,
        staffId: appointments.assignedStaffId,
        status: appointments.status,
      })
      .from(appointments)
      .where(eq(appointments.id, appointmentId));
    return appointment;
  }

  async currentTask(taskId: string) {
    const [task] = await this.db.select().from(facilityTasks).where(eq(facilityTasks.id, taskId));
    return task;
  }

  appointmentsForReservation(reservationId: string) {
    return this.db
      .select({ id: appointments.id })
      .from(appointments)
      .where(eq(appointments.reservationId, reservationId));
  }
}
