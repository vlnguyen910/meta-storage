import { randomUUID } from "node:crypto";
import {
  and,
  type Database,
  eq,
  facilityAssignments,
  gt,
  isNull,
  lte,
  notificationOutbox,
  or,
  sql,
  users,
} from "@metastorage/database";

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
              eq(notificationOutbox.status, "PENDING"),
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
          firstAttemptAt: row.firstAttemptAt ?? now,
          attempts: row.attempts + 1,
        })
        .where(eq(notificationOutbox.id, row.id))
        .returning();
      return claimed;
    });
  }
  async authorized(row: typeof notificationOutbox.$inferSelect, now: Date) {
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
    status: "SENT" | "PENDING" | "SUPPRESSED",
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
          now.getTime() + Math.min(3600000, 5000 * 2 ** Math.min(row.attempts, 10)),
        ),
        ...(status === "SENT" ? { providerMessageId, sentAt: now } : {}),
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
