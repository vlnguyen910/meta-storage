import type { SupportPageQuery, SupportTicketQuery } from "@metastorage/contracts";
import {
  and,
  bookings,
  type Database,
  desc,
  eq,
  facilities,
  getTableColumns,
  lt,
  notificationOutbox,
  or,
  payments,
  RentalStatus,
  ReservationStatus,
  rentals,
  reservations,
  sql,
  storageUnits,
  supportTickets,
  unitTypes,
  users,
} from "@metastorage/database";
import type { SupportCursor, SupportTransaction } from "./support.types";

export class SupportRepository {
  constructor(readonly db: Database) {}

  async lockCustomerTicket(tx: SupportTransaction, id: string, customerId: string) {
    const [ticket] = await tx
      .select()
      .from(supportTickets)
      .where(and(eq(supportTickets.id, id), eq(supportTickets.ownerUserId, customerId)))
      .for("update");
    return ticket;
  }

  transaction<T>(fn: (tx: SupportTransaction) => Promise<T>): Promise<T> {
    return this.db.transaction(fn);
  }

  async lockActor(tx: SupportTransaction, id: string) {
    const [row] = await tx.select().from(users).where(eq(users.id, id)).for("share");
    return row;
  }

  async lockReservation(tx: SupportTransaction, id: string, ownerId: string) {
    const [row] = await tx
      .select()
      .from(reservations)
      .where(and(eq(reservations.id, id), eq(reservations.customerId, ownerId)))
      .for("update");
    return row;
  }

  async lockBooking(tx: SupportTransaction, id: string, ownerId: string) {
    const [row] = await tx
      .select()
      .from(bookings)
      .where(and(eq(bookings.id, id), eq(bookings.userId, ownerId)))
      .for("update");
    return row;
  }

  async lockRental(tx: SupportTransaction, bookingId: string, reservation = false) {
    const [row] = await tx
      .select()
      .from(rentals)
      .where(reservation ? eq(rentals.reservationId, bookingId) : eq(rentals.bookingId, bookingId))
      .for("update");
    return row;
  }

  async unit(tx: SupportTransaction, id: string) {
    const [row] = await tx.select().from(storageUnits).where(eq(storageUnits.id, id)).for("share");
    return row;
  }

  async payment(tx: SupportTransaction, id: string) {
    const [row] = await tx
      .select({ bookingId: payments.bookingId, reservationId: payments.reservationId })
      .from(payments)
      .where(eq(payments.id, id));
    return row;
  }

  private ownerFilter(actorId: string) {
    return and(
      eq(supportTickets.ownerUserId, actorId),
      or(eq(bookings.userId, actorId), eq(reservations.customerId, actorId)),
      eq(users.id, actorId),
      eq(users.role, "CUSTOMER"),
      eq(users.status, "ACTIVE"),
    );
  }

  async ticket(actorId: string, id: string) {
    const [row] = await this.db
      .select(getTableColumns(supportTickets))
      .from(supportTickets)
      .leftJoin(bookings, eq(bookings.id, supportTickets.bookingId))
      .leftJoin(reservations, eq(reservations.id, supportTickets.reservationId))
      .innerJoin(users, eq(users.id, supportTickets.ownerUserId))
      .where(and(eq(supportTickets.id, id), this.ownerFilter(actorId)));
    return row;
  }

  async contexts(
    actorId: string,
    input: import("@metastorage/contracts").SupportContextQuery,
    cursor?: SupportCursor,
  ) {
    const createdAt = sql<Date>`date_trunc('milliseconds', ${reservations.createdAt})`.mapWith(
      reservations.createdAt,
    );
    return this.db
      .select({
        id: reservations.id,
        bookingCode: sql<string>`upper(left(${reservations.id}::text,8))`,
        status: reservations.status,
        facility: { id: facilities.id, name: facilities.name },
        unitType: { id: unitTypes.id, name: unitTypes.name },
        checkInDate: sql<string>`(${reservations.rentalStartAt} at time zone 'Asia/Ho_Chi_Minh')::date::text`,
        createdAt,
      })
      .from(reservations)
      .innerJoin(users, eq(users.id, reservations.customerId))
      .innerJoin(facilities, eq(facilities.id, reservations.facilityId))
      .innerJoin(unitTypes, eq(unitTypes.id, reservations.unitTypeId))
      .leftJoin(rentals, eq(rentals.reservationId, reservations.id))
      .leftJoin(storageUnits, eq(storageUnits.id, rentals.storageUnitId))
      .where(
        and(
          eq(reservations.customerId, actorId),
          eq(users.role, "CUSTOMER"),
          eq(users.status, "ACTIVE"),
          input.category === "PAYMENT"
            ? undefined
            : and(
                eq(reservations.status, ReservationStatus.CHECKED_IN),
                eq(rentals.status, RentalStatus.ACTIVE),
                eq(rentals.userId, actorId),
                eq(storageUnits.facilityId, reservations.facilityId),
              ),
          cursor
            ? or(
                lt(createdAt, cursor.createdAt),
                and(eq(createdAt, cursor.createdAt), lt(reservations.id, cursor.id)),
              )
            : undefined,
        ),
      )
      .orderBy(desc(createdAt), desc(reservations.id))
      .limit(input.limit + 1);
  }

  async contextBooking(actorId: string, id: string) {
    const [row] = await this.db
      .select({ id: reservations.id })
      .from(reservations)
      .innerJoin(users, eq(users.id, reservations.customerId))
      .where(
        and(
          eq(reservations.id, id),
          eq(reservations.customerId, actorId),
          eq(users.role, "CUSTOMER"),
          eq(users.status, "ACTIVE"),
        ),
      );
    return row;
  }

  async contextPayments(
    actorId: string,
    bookingId: string,
    input: SupportPageQuery,
    cursor?: SupportCursor,
  ) {
    const createdAt = sql<Date>`date_trunc('milliseconds', ${payments.createdAt})`.mapWith(
      payments.createdAt,
    );
    return this.db
      .select({
        id: payments.id,
        paymentCode: payments.paymentCode,
        status: payments.status,
        amount: payments.totalAmount,
        currency: payments.currency,
        createdAt,
      })
      .from(payments)
      .leftJoin(reservations, eq(reservations.id, payments.reservationId))
      .leftJoin(bookings, eq(bookings.id, payments.bookingId))
      .where(
        and(
          or(
            and(eq(reservations.id, bookingId), eq(reservations.customerId, actorId)),
            and(eq(bookings.id, bookingId), eq(bookings.userId, actorId)),
          ),
          cursor
            ? or(
                lt(createdAt, cursor.createdAt),
                and(eq(createdAt, cursor.createdAt), lt(payments.id, cursor.id)),
              )
            : undefined,
        ),
      )
      .orderBy(desc(createdAt), desc(payments.id))
      .limit(input.limit + 1);
  }

  async list(actorId: string, input: SupportTicketQuery, cursor?: SupportCursor) {
    return this.db
      .select(getTableColumns(supportTickets))
      .from(supportTickets)
      .leftJoin(bookings, eq(bookings.id, supportTickets.bookingId))
      .leftJoin(reservations, eq(reservations.id, supportTickets.reservationId))
      .innerJoin(users, eq(users.id, supportTickets.ownerUserId))
      .where(
        and(
          this.ownerFilter(actorId),
          input.bookingId ? eq(supportTickets.bookingId, input.bookingId) : undefined,
          input.reservationId ? eq(supportTickets.reservationId, input.reservationId) : undefined,
          input.category ? eq(supportTickets.category, input.category) : undefined,
          cursor
            ? or(
                lt(supportTickets.createdAt, cursor.createdAt),
                and(
                  eq(supportTickets.createdAt, cursor.createdAt),
                  lt(supportTickets.id, cursor.id),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(desc(supportTickets.createdAt), desc(supportTickets.id))
      .limit(input.limit + 1);
  }

  async insertTicket(tx: SupportTransaction, values: typeof supportTickets.$inferInsert) {
    const [row] = await tx
      .insert(supportTickets)
      .values(values)
      .onConflictDoNothing({
        target: [supportTickets.ownerUserId, supportTickets.idempotencyKey],
      })
      .returning();
    return row;
  }

  async ticketByIdempotency(tx: SupportTransaction, actorId: string, key: string) {
    const [row] = await tx
      .select()
      .from(supportTickets)
      .where(and(eq(supportTickets.ownerUserId, actorId), eq(supportTickets.idempotencyKey, key)));
    return row;
  }

  async receipt(tx: SupportTransaction, values: typeof notificationOutbox.$inferInsert) {
    await tx
      .insert(notificationOutbox)
      .values(values)
      .onConflictDoNothing({
        target: [notificationOutbox.eventKey, notificationOutbox.recipientKey],
      });
  }
}
