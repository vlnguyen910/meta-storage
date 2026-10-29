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
  rentals,
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

  async lockBooking(tx: SupportTransaction, id: string, ownerId: string) {
    const [row] = await tx
      .select()
      .from(bookings)
      .where(and(eq(bookings.id, id), eq(bookings.userId, ownerId)))
      .for("update");
    return row;
  }

  async lockRental(tx: SupportTransaction, bookingId: string) {
    const [row] = await tx
      .select()
      .from(rentals)
      .where(eq(rentals.bookingId, bookingId))
      .for("update");
    return row;
  }

  async unit(tx: SupportTransaction, id: string) {
    const [row] = await tx.select().from(storageUnits).where(eq(storageUnits.id, id)).for("share");
    return row;
  }

  async payment(tx: SupportTransaction, id: string) {
    const [row] = await tx
      .select({ bookingId: payments.bookingId })
      .from(payments)
      .where(eq(payments.id, id));
    return row;
  }

  private ownerFilter(actorId: string) {
    return and(
      eq(supportTickets.ownerUserId, actorId),
      eq(bookings.userId, actorId),
      eq(users.id, actorId),
      eq(users.role, "CUSTOMER"),
      eq(users.status, "ACTIVE"),
    );
  }

  async ticket(actorId: string, id: string) {
    const [row] = await this.db
      .select(getTableColumns(supportTickets))
      .from(supportTickets)
      .innerJoin(bookings, eq(bookings.id, supportTickets.bookingId))
      .innerJoin(users, eq(users.id, supportTickets.ownerUserId))
      .where(and(eq(supportTickets.id, id), this.ownerFilter(actorId)));
    return row;
  }

  async contexts(
    actorId: string,
    input: import("@metastorage/contracts").SupportContextQuery,
    cursor?: SupportCursor,
  ) {
    const createdAt = sql<Date>`date_trunc('milliseconds', ${bookings.createdAt})`.mapWith(
      bookings.createdAt,
    );
    return this.db
      .select({
        id: bookings.id,
        bookingCode: bookings.bookingCode,
        status: bookings.status,
        facility: { id: facilities.id, name: facilities.name },
        unitType: { id: unitTypes.id, name: unitTypes.name },
        checkInDate: bookings.checkInDate,
        createdAt,
      })
      .from(bookings)
      .innerJoin(users, eq(users.id, bookings.userId))
      .innerJoin(facilities, eq(facilities.id, bookings.facilityId))
      .innerJoin(unitTypes, eq(unitTypes.id, bookings.unitTypeId))
      .leftJoin(rentals, eq(rentals.bookingId, bookings.id))
      .leftJoin(storageUnits, eq(storageUnits.id, rentals.storageUnitId))
      .where(
        and(
          eq(bookings.userId, actorId),
          eq(users.role, "CUSTOMER"),
          eq(users.status, "ACTIVE"),
          input.category === "PAYMENT"
            ? undefined
            : and(
                eq(bookings.status, "CHECKED_IN"),
                eq(rentals.status, RentalStatus.ACTIVE),
                eq(rentals.userId, actorId),
                eq(storageUnits.facilityId, bookings.facilityId),
              ),
          cursor
            ? or(
                lt(createdAt, cursor.createdAt),
                and(eq(createdAt, cursor.createdAt), lt(bookings.id, cursor.id)),
              )
            : undefined,
        ),
      )
      .orderBy(desc(createdAt), desc(bookings.id))
      .limit(input.limit + 1);
  }

  async contextBooking(actorId: string, id: string) {
    const [row] = await this.db
      .select({ id: bookings.id })
      .from(bookings)
      .innerJoin(users, eq(users.id, bookings.userId))
      .where(
        and(
          eq(bookings.id, id),
          eq(bookings.userId, actorId),
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
      .innerJoin(bookings, eq(bookings.id, payments.bookingId))
      .where(
        and(
          eq(bookings.id, bookingId),
          eq(bookings.userId, actorId),
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
      .innerJoin(bookings, eq(bookings.id, supportTickets.bookingId))
      .innerJoin(users, eq(users.id, supportTickets.ownerUserId))
      .where(
        and(
          this.ownerFilter(actorId),
          input.bookingId ? eq(supportTickets.bookingId, input.bookingId) : undefined,
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
