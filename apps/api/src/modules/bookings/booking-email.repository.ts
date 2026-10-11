import {
  and,
  bookingConfirmationEmails,
  bookings,
  type Database,
  eq,
  facilities,
  inArray,
  isNull,
  unitTypes,
} from "@metastorage/database";

export class BookingEmailRepository {
  constructor(private readonly db: Database) {}

  findPendingPreparation() {
    return this.db
      .select({
        email: bookingConfirmationEmails,
        bookingCode: bookings.bookingCode,
        facilityName: facilities.name,
        unitTypeName: unitTypes.name,
      })
      .from(bookingConfirmationEmails)
      .innerJoin(bookings, eq(bookings.id, bookingConfirmationEmails.bookingId))
      .innerJoin(facilities, eq(facilities.id, bookings.facilityId))
      .innerJoin(unitTypes, eq(unitTypes.id, bookings.unitTypeId))
      .where(
        and(
          eq(bookingConfirmationEmails.status, "PENDING"),
          isNull(bookingConfirmationEmails.payload),
          inArray(bookings.status, ["CONFIRMED", "CHECKED_IN", "CANCELLED", "NO_SHOW"]),
        ),
      )
      .orderBy(bookingConfirmationEmails.createdAt)
      .limit(20);
  }

  async savePreparation(
    id: string,
    values: { payload?: string; expiresAt?: Date; status?: "FAILED"; lastError?: string | null },
  ) {
    await this.db
      .update(bookingConfirmationEmails)
      .set({ ...values, updatedAt: new Date() })
      .where(
        and(
          eq(bookingConfirmationEmails.id, id),
          eq(bookingConfirmationEmails.status, "PENDING"),
          isNull(bookingConfirmationEmails.payload),
        ),
      );
  }
}
