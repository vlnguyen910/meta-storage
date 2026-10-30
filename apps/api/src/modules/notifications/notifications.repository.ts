import { appointments, type Database, eq } from "@metastorage/database";

export class NotificationsRepository {
  constructor(private readonly db: Database) {}

  async currentAppointment(appointmentId: string) {
    const [appointment] = await this.db
      .select({
        facilityId: appointments.facilityId,
        staffId: appointments.assignedStaffId,
        status: appointments.status,
      })
      .from(appointments)
      .where(eq(appointments.id, appointmentId));
    return appointment;
  }
}
