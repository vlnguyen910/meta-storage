import { bookings, type Database, eq } from "@metastorage/database";

export class NotificationsRepository {
  constructor(private readonly db: Database) {}

  async currentBooking(bookingId: string) {
    const [booking] = await this.db
      .select({
        facilityId: bookings.facilityId,
        staffId: bookings.assignedStaffId,
        status: bookings.status,
      })
      .from(bookings)
      .where(eq(bookings.id, bookingId));
    return booking;
  }
}
