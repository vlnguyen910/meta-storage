import type { SupportPageQuery, SupportTicketQuery } from "@metastorage/contracts";
import {
  and,
  bookings,
  count,
  type Database,
  desc,
  eq,
  exists,
  facilities,
  getTableColumns,
  inArray,
  isNull,
  lt,
  notificationOutbox,
  or,
  payments,
  rentalCharges,
  rentals,
  sql,
  storageUnits,
  supportAttachments,
  supportAudit,
  supportIdempotency,
  supportMessages,
  supportTickets,
  unitTypes,
  users,
} from "@metastorage/database";
import { recordSupportOperation } from "../facility-workspace/support-events";
import type {
  SupportConnection,
  SupportCursor,
  SupportResultReference,
  SupportTransaction,
} from "./support.types";

export class SupportRepository {
  constructor(readonly db: Database) {}
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
      .select({
        bookingId: payments.bookingId,
        chargeBookingId: rentals.bookingId,
      })
      .from(payments)
      .leftJoin(rentalCharges, eq(rentalCharges.id, payments.rentalChargeId))
      .leftJoin(rentals, eq(rentals.id, rentalCharges.rentalId))
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
  private ownerQuery(actorId: string, id: string, connection: SupportConnection = this.db) {
    return connection
      .select({ id: supportTickets.id })
      .from(supportTickets)
      .innerJoin(bookings, eq(bookings.id, supportTickets.bookingId))
      .innerJoin(users, eq(users.id, supportTickets.ownerUserId))
      .where(and(eq(supportTickets.id, id), this.ownerFilter(actorId)));
  }
  async ticket(actorId: string, id: string, connection: SupportConnection = this.db, lock = false) {
    const query = connection
      .select(getTableColumns(supportTickets))
      .from(supportTickets)
      .innerJoin(bookings, eq(bookings.id, supportTickets.bookingId))
      .innerJoin(users, eq(users.id, supportTickets.ownerUserId))
      .where(and(eq(supportTickets.id, id), this.ownerFilter(actorId)));
    const rows = lock ? await query.for("update", { of: supportTickets }) : await query;
    return rows[0];
  }
  async contexts(
    actorId: string,
    input: import("@metastorage/contracts").SupportContextQuery,
    cursor?: SupportCursor,
  ) {
    // Cursor dates use millisecond precision; order/filter on the same expression to avoid losing ties.
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
      .leftJoin(storageUnits, eq(storageUnits.id, rentals.physicalUnitId))
      .where(
        and(
          eq(bookings.userId, actorId),
          eq(users.role, "CUSTOMER"),
          eq(users.status, "ACTIVE"),
          input.category === "PAYMENT"
            ? undefined
            : and(
                eq(bookings.status, "CHECKED_IN"),
                isNull(rentals.closedAt),
                eq(rentals.facilityId, bookings.facilityId),
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
        chargeId: payments.rentalChargeId,
        source: rentalCharges.source,
        status: payments.status,
        amount: payments.totalAmount,
        currency: payments.currency,
        createdAt,
      })
      .from(payments)
      .leftJoin(rentalCharges, eq(rentalCharges.id, payments.rentalChargeId))
      .leftJoin(rentals, eq(rentals.id, rentalCharges.rentalId))
      .innerJoin(
        bookings,
        or(eq(bookings.id, payments.bookingId), eq(bookings.id, rentals.bookingId)),
      )
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
          input.status ? eq(supportTickets.status, input.status) : undefined,
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
  async messages(
    actorId: string,
    ticketId: string,
    input: SupportPageQuery,
    cursor?: SupportCursor,
  ) {
    return this.db
      .select({
        ...getTableColumns(supportMessages),
        authorName: users.name,
        authorRole: users.role,
      })
      .from(supportMessages)
      .innerJoin(users, eq(users.id, supportMessages.authorId))
      .where(
        and(
          eq(supportMessages.ticketId, ticketId),
          eq(supportMessages.kind, "PUBLIC_REPLY"),
          exists(this.ownerQuery(actorId, ticketId)),
          cursor
            ? or(
                lt(supportMessages.createdAt, cursor.createdAt),
                and(
                  eq(supportMessages.createdAt, cursor.createdAt),
                  lt(supportMessages.id, cursor.id),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(desc(supportMessages.createdAt), desc(supportMessages.id))
      .limit(input.limit + 1);
  }
  async message(
    actorId: string,
    ticketId: string,
    messageId: string,
    connection: SupportConnection = this.db,
  ) {
    const [row] = await connection
      .select({
        ...getTableColumns(supportMessages),
        authorName: users.name,
        authorRole: users.role,
      })
      .from(supportMessages)
      .innerJoin(users, eq(users.id, supportMessages.authorId))
      .where(
        and(
          eq(supportMessages.ticketId, ticketId),
          eq(supportMessages.id, messageId),
          eq(supportMessages.kind, "PUBLIC_REPLY"),
          exists(this.ownerQuery(actorId, ticketId, connection)),
        ),
      );
    return row;
  }
  async attachments(actorId: string, ticketId: string, messageIds: string[]) {
    if (!messageIds.length) return [];
    return this.db
      .select(getTableColumns(supportAttachments))
      .from(supportAttachments)
      .innerJoin(supportMessages, eq(supportMessages.id, supportAttachments.messageId))
      .where(
        and(
          eq(supportAttachments.ticketId, ticketId),
          eq(supportMessages.ticketId, ticketId),
          eq(supportMessages.kind, "PUBLIC_REPLY"),
          inArray(supportAttachments.messageId, messageIds),
          exists(this.ownerQuery(actorId, ticketId)),
        ),
      )
      .orderBy(supportAttachments.createdAt, supportAttachments.id);
  }
  async attachment(actorId: string, ticketId: string, attachmentId: string) {
    const [row] = await this.db
      .select(getTableColumns(supportAttachments))
      .from(supportAttachments)
      .innerJoin(supportMessages, eq(supportMessages.id, supportAttachments.messageId))
      .where(
        and(
          eq(supportAttachments.id, attachmentId),
          eq(supportAttachments.ticketId, ticketId),
          eq(supportMessages.ticketId, ticketId),
          eq(supportMessages.kind, "PUBLIC_REPLY"),
          exists(this.ownerQuery(actorId, ticketId)),
        ),
      );
    return row;
  }
  async imageCount(tx: SupportTransaction, ticketId: string) {
    const [row] = await tx
      .select({ count: count() })
      .from(supportAttachments)
      .where(eq(supportAttachments.ticketId, ticketId));
    return row?.count ?? 0;
  }
  async imageReferenced(objectKey: string) {
    const [row] = await this.db
      .select({ id: supportAttachments.id })
      .from(supportAttachments)
      .where(eq(supportAttachments.objectKey, objectKey));
    return Boolean(row);
  }
  async claim(
    tx: SupportTransaction,
    actorId: string,
    operation: string,
    key: string,
    hash: string,
  ) {
    const [claimed] = await tx
      .insert(supportIdempotency)
      .values({
        actorId,
        operation,
        idempotencyKey: key,
        requestHash: hash,
      })
      .onConflictDoNothing()
      .returning();
    if (claimed) return { fresh: true as const, row: claimed };
    const [row] = await tx
      .select()
      .from(supportIdempotency)
      .where(
        and(
          eq(supportIdempotency.actorId, actorId),
          eq(supportIdempotency.operation, operation),
          eq(supportIdempotency.idempotencyKey, key),
        ),
      );
    return { fresh: false as const, row };
  }
  async finish(
    tx: SupportTransaction,
    actorId: string,
    operation: string,
    key: string,
    reference: SupportResultReference,
  ) {
    await tx
      .update(supportIdempotency)
      .set({ ticketId: reference.ticketId, resultReference: reference })
      .where(
        and(
          eq(supportIdempotency.actorId, actorId),
          eq(supportIdempotency.operation, operation),
          eq(supportIdempotency.idempotencyKey, key),
        ),
      );
  }
  async insertTicket(tx: SupportTransaction, values: typeof supportTickets.$inferInsert) {
    const [row] = await tx.insert(supportTickets).values(values).returning();
    if (!row) throw new Error("Support ticket insert returned no row");
    return row;
  }
  async insertMessage(tx: SupportTransaction, values: typeof supportMessages.$inferInsert) {
    const [row] = await tx.insert(supportMessages).values(values).returning();
    if (!row) throw new Error("Support message insert returned no row");
    return row;
  }
  async insertImage(tx: SupportTransaction, values: typeof supportAttachments.$inferInsert) {
    const [row] = await tx.insert(supportAttachments).values(values).returning();
    if (!row) throw new Error("Support attachment insert returned no row");
    return row;
  }
  async advance(tx: SupportTransaction, id: string, nextVersion: number) {
    await tx
      .update(supportTickets)
      .set({ version: nextVersion, updatedAt: new Date() })
      .where(eq(supportTickets.id, id));
  }
  async audit(tx: SupportTransaction, values: typeof supportAudit.$inferInsert) {
    await tx.insert(supportAudit).values(values);
  }
  async receipt(tx: SupportTransaction, values: typeof notificationOutbox.$inferInsert) {
    if (values.eventType === "SUPPORT_CREATED" && values.supportTicketId) {
      const [ticket] = await tx
        .select()
        .from(supportTickets)
        .where(eq(supportTickets.id, values.supportTicketId));
      if (ticket) await recordSupportOperation(tx, ticket, ticket.ownerUserId, "CREATED");
    }
    await tx
      .insert(notificationOutbox)
      .values(values)
      .onConflictDoNothing({
        target: [notificationOutbox.eventKey, notificationOutbox.recipientKey],
      });
  }
}
