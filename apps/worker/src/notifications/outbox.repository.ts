import { randomUUID } from "node:crypto";
import {
  and,
  type Database,
  eq,
  facilityAssignments,
  gt,
  inArray,
  isNull,
  lte,
  notificationOutbox,
  or,
  rentals,
  sql,
  users,
} from "@metastorage/database";
import { BOOKING_ACCESS } from "@metastorage/shared/booking-access";

export class OutboxRepository {
  constructor(private readonly db: Database) {}
  async claim(now: Date, facilityId?: string) {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(notificationOutbox)
        .where(
          and(
            lte(notificationOutbox.nextAttemptAt, now),
            facilityId ? eq(notificationOutbox.facilityId, facilityId) : undefined,
            or(
              inArray(notificationOutbox.status, ["PENDING", "ENQUEUED"]),
              and(
                eq(notificationOutbox.status, "PROCESSING"),
                lte(notificationOutbox.leaseUntil, now),
              ),
            ),
          ),
        )
        .orderBy(notificationOutbox.nextAttemptAt, notificationOutbox.id)
        .limit(1)
        .for("update", { skipLocked: true });
      if (!row) return;
      // Resend retains keys for 24 hours. Stop one minute early so a timeout
      // cannot cross that boundary and create an unprotected second delivery.
      if (
        !row.bookingEmail &&
        row.firstAttemptAt &&
        now.getTime() - row.firstAttemptAt.getTime() >= 24 * 3600000 - 60000
      ) {
        await tx
          .update(notificationOutbox)
          .set({ status: "REVIEW_REQUIRED", leaseToken: null, leaseUntil: null })
          .where(eq(notificationOutbox.id, row.id));
        return { reviewRequired: true as const };
      }
      const [claimed] = await tx
        .update(notificationOutbox)
        .set({
          status: "PROCESSING",
          leaseToken: randomUUID(),
          leaseUntil: new Date(now.getTime() + 60000),
          firstAttemptAt: row.bookingEmail ? row.firstAttemptAt : (row.firstAttemptAt ?? now),
          attempts: row.attempts + 1,
        })
        .where(eq(notificationOutbox.id, row.id))
        .returning();
      return claimed;
    });
  }
  async bookingPayload(
    row: typeof notificationOutbox.$inferSelect,
    payload: string,
    expiresAt: Date,
  ) {
    const [updated] = await this.db
      .update(notificationOutbox)
      .set({ mailPayload: payload, mailExpiresAt: expiresAt })
      .where(
        and(
          eq(notificationOutbox.id, row.id),
          eq(notificationOutbox.status, "PROCESSING"),
          sql`${notificationOutbox.leaseToken} = ${row.leaseToken}::uuid`,
          isNull(notificationOutbox.mailPayload),
        ),
      )
      .returning();
    if (!updated) throw new Error("Booking payload lease lost");
    return updated;
  }

  async bookingDeliveryPayload(deliveryId: string) {
    const [byId] = await this.db
      .select({ payload: notificationOutbox.mailPayload })
      .from(notificationOutbox)
      .where(eq(notificationOutbox.id, deliveryId));
    if (byId) return byId.payload;
    const [legacy] = await this.db
      .select({ payload: notificationOutbox.mailPayload })
      .from(notificationOutbox)
      .where(
        and(
          eq(notificationOutbox.eventKey, `booking:${deliveryId}:confirmed`),
          eq(notificationOutbox.recipientKey, "customer"),
        ),
      );
    return legacy?.payload;
  }

  async beginBooking(deliveryId: string, payload: string, expiresAt: Date, now: Date) {
    return this.db.transaction(async (tx) => {
      const [byId] = await tx
        .select()
        .from(notificationOutbox)
        .where(eq(notificationOutbox.id, deliveryId))
        .for("update");
      const [row] = byId
        ? [byId]
        : await tx
            .select()
            .from(notificationOutbox)
            .where(
              and(
                eq(notificationOutbox.eventKey, `booking:${deliveryId}:confirmed`),
                eq(notificationOutbox.recipientKey, "customer"),
              ),
            )
            .for("update");
      if (!row?.bookingEmail) return { kind: "LEGACY" as const };
      if (row.status === "SENT")
        return { kind: "DONE" as const, providerMessageId: row.providerMessageId ?? "" };
      const linkCreatedAt = new Date(row.bookingEmail.linkCreatedAt ?? row.bookingEmail.paidAt);
      const expectedExpiry = Math.min(
        row.mailExpiresAt?.getTime() ?? Number.POSITIVE_INFINITY,
        row.bookingEmail.linkExpiresAt
          ? Date.parse(row.bookingEmail.linkExpiresAt)
          : linkCreatedAt.getTime() + BOOKING_ACCESS.magicTtl * 1000,
        linkCreatedAt.getTime() + BOOKING_ACCESS.magicTtl * 1000,
      );
      const expired = expectedExpiry <= now.getTime() || expiresAt.getTime() !== expectedExpiry;
      const pastWindow =
        row.firstAttemptAt && now.getTime() - row.firstAttemptAt.getTime() >= 24 * 3600000 - 60000;
      if (
        ["SUPPRESSED", "REVIEW_REQUIRED"].includes(row.status) ||
        expired ||
        pastWindow ||
        (row.mailPayload && row.mailPayload !== payload)
      ) {
        await tx
          .update(notificationOutbox)
          .set({
            status: expired && !row.firstAttemptAt ? "SUPPRESSED" : "REVIEW_REQUIRED",
            leaseToken: null,
            leaseUntil: null,
          })
          .where(eq(notificationOutbox.id, row.id));
        return { kind: "STOP" as const };
      }
      await tx
        .update(notificationOutbox)
        .set({
          status: "ENQUEUED",
          mailPayload: payload,
          mailExpiresAt: expiresAt,
          firstAttemptAt: row.firstAttemptAt ?? now,
          queuedAt: row.queuedAt ?? now,
          leaseToken: null,
          leaseUntil: null,
        })
        .where(eq(notificationOutbox.id, row.id));
      return { kind: "SEND" as const, id: row.id };
    });
  }

  async bookingSent(id: string, providerMessageId: string, now: Date) {
    await this.db
      .update(notificationOutbox)
      .set({ status: "SENT", providerMessageId, sentAt: now, leaseToken: null, leaseUntil: null })
      .where(eq(notificationOutbox.id, id));
  }

  async authorized(row: typeof notificationOutbox.$inferSelect, now: Date) {
    if (["UPCOMING_EXPIRY", "RENTAL_OVERDUE", "ABANDONED_REVIEW"].includes(row.eventType)) {
      const [rental] = await this.db
        .select({
          version: rentals.version,
          status: rentals.status,
          closedAt: rentals.closedAt,
          expectedEndAt: rentals.expectedEndAt,
        })
        .from(rentals)
        .where(eq(rentals.bookingId, row.bookingId));
      if (!rental || rental.closedAt || rental.version !== (row.rentalTermVersion ?? 0))
        return false;
      if (
        row.eventType === "UPCOMING_EXPIRY" &&
        (!["ACTIVE", "RETURN_PENDING"].includes(rental.status) || now >= rental.expectedEndAt)
      )
        return false;
    }
    if (row.recipientRole === "CUSTOMER") return true; // Booking contact may be a guest; never require an account for email.
    if (row.recipientRole !== "FACILITY_MANAGER" || !row.recipientUserId) return false;
    const [assignment] = await this.db
      .select({ id: facilityAssignments.id })
      .from(facilityAssignments)
      .innerJoin(users, eq(users.id, facilityAssignments.userId))
      .where(
        and(
          eq(facilityAssignments.facilityId, row.facilityId),
          eq(facilityAssignments.userId, row.recipientUserId),
          eq(facilityAssignments.role, "FACILITY_MANAGER"),
          eq(facilityAssignments.isActive, true),
          or(isNull(facilityAssignments.endedAt), gt(facilityAssignments.endedAt, now)),
          eq(users.role, "FACILITY_MANAGER"),
          eq(users.status, "ACTIVE"),
        ),
      );
    return Boolean(assignment);
  }
  finish(
    row: typeof notificationOutbox.$inferSelect,
    status: "SENT" | "PENDING" | "SUPPRESSED" | "ENQUEUED" | "REVIEW_REQUIRED",
    now: Date,
    providerMessageId?: string,
  ) {
    return this.db
      .update(notificationOutbox)
      .set({
        status,
        leaseToken: null,
        leaseUntil: null,
        nextAttemptAt: new Date(
          now.getTime() +
            (status === "ENQUEUED"
              ? 30000
              : Math.min(3600000, 5000 * 2 ** Math.min(row.attempts, 10))),
        ),
        ...(status === "SENT" ? { providerMessageId, sentAt: now } : {}),
        ...(status === "ENQUEUED" ? { queuedAt: row.queuedAt ?? now } : {}),
      })
      .where(
        and(
          eq(notificationOutbox.id, row.id),
          eq(notificationOutbox.status, "PROCESSING"),
          // A stale sender cannot overwrite a newer worker's lease/acknowledgement.
          sql`${notificationOutbox.leaseToken} = ${row.leaseToken}::uuid`,
        ),
      );
  }
}
