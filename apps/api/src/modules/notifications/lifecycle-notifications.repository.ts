import type { NotificationInboxQuery } from "@metastorage/contracts";
import {
  and,
  bookings,
  type Database,
  desc,
  eq,
  exists,
  facilities,
  facilityAssignments,
  getTableColumns,
  gt,
  isNull,
  notificationOutbox,
  or,
  reservations,
  sql,
  supportTickets,
  unitTypes,
  users,
} from "@metastorage/database";
import {
  LIFECYCLE_NOTIFICATION_SUBJECTS,
  lifecycleNotificationBody,
} from "./lifecycle-notifications.messages";
import type { LifecycleEventInput, NotificationTransaction } from "./lifecycle-notifications.types";

/** Insert only; no delivery calls or provider failures inside a business transaction. */
export async function recordLifecycleEvent(
  tx: NotificationTransaction,
  input: LifecycleEventInput,
) {
  const [booking] = input.reservationId
    ? await tx
        .select({
          id: reservations.id,
          userId: reservations.customerId,
          facilityId: reservations.facilityId,
          unitTypeId: reservations.unitTypeId,
          bookingCode: sql<string>`${reservations.id}::text`,
          contactEmail: users.email,
        })
        .from(reservations)
        .innerJoin(users, eq(users.id, reservations.customerId))
        .where(eq(reservations.id, input.reservationId))
    : input.bookingId
      ? await tx
          .select({ ...getTableColumns(bookings), contactEmail: users.email })
          .from(bookings)
          .innerJoin(users, eq(users.id, bookings.userId))
          .where(eq(bookings.id, input.bookingId))
      : [];
  if (!booking) return;
  const at = input.occurredAt ?? new Date();
  const [bookingInfo] =
    input.type === "BOOKING_CONFIRMED" && input.customer !== false
      ? await tx
          .select({ facilityName: facilities.name, unitTypeName: unitTypes.name })
          .from(facilities)
          .innerJoin(unitTypes, eq(unitTypes.id, booking.unitTypeId))
          .where(eq(facilities.id, booking.facilityId))
      : [];

  const subject = LIFECYCLE_NOTIFICATION_SUBJECTS[input.type];
  const body = lifecycleNotificationBody(
    subject,
    booking.bookingCode ?? booking.id,
    input.detail ?? "",
  );
  const recipients: { key: string; userId: string | null; email: string; role: string }[] = [];
  if (input.customer !== false && booking.contactEmail?.trim())
    recipients.push({
      key: "customer",
      userId: booking.userId,
      email: booking.contactEmail.trim(),
      role: "CUSTOMER",
    });
  if (input.managers) {
    const managers = await tx
      .select({ id: users.id, email: users.email })
      .from(facilityAssignments)
      .innerJoin(users, eq(users.id, facilityAssignments.userId))
      .where(
        and(
          eq(facilityAssignments.facilityId, booking.facilityId),
          eq(facilityAssignments.role, "FACILITY_MANAGER"),
          eq(facilityAssignments.isActive, true),
          or(isNull(facilityAssignments.endedAt), gt(facilityAssignments.endedAt, at)),
          eq(users.role, "FACILITY_MANAGER"),
          eq(users.status, "ACTIVE"),
        ),
      );
    for (const manager of managers)
      recipients.push({
        key: `manager:${manager.id}`,
        userId: manager.id,
        email: manager.email,
        role: "FACILITY_MANAGER",
      });
  }
  if (recipients.length)
    await tx
      .insert(notificationOutbox)
      .values(
        recipients.map((recipient) => ({
          eventKey: input.key,
          eventType: input.type,
          bookingId: input.bookingId ? booking.id : null,
          reservationId: input.reservationId ? booking.id : null,
          rentalTermVersion: input.rentalTermVersion,
          facilityId: booking.facilityId,
          recipientKey: recipient.key,
          recipientUserId: recipient.userId,
          recipientRole: recipient.role,
          recipientEmail: recipient.email,
          subject,
          body,
          bookingEmail:
            recipient.role === "CUSTOMER" && bookingInfo
              ? {
                  bookingCode: booking.bookingCode,
                  facilityName: bookingInfo.facilityName,
                  unitTypeName: bookingInfo.unitTypeName,
                  paidAt: at.toISOString(),
                }
              : null,
          occurredAt: at,
          nextAttemptAt: at,
        })),
      )
      .onConflictDoNothing({
        target: [notificationOutbox.eventKey, notificationOutbox.recipientKey],
      });
}

export class LifecycleNotificationsRepository {
  constructor(private readonly db: Database) {}
  inbox(userId: string, role: string, query: NotificationInboxQuery) {
    const facilityAccess = this.db
      .select({ id: facilityAssignments.id })
      .from(facilityAssignments)
      .where(
        and(
          eq(facilityAssignments.facilityId, notificationOutbox.facilityId),
          eq(facilityAssignments.userId, userId),
          eq(
            facilityAssignments.role,
            role === "FACILITY_STAFF" ? "FACILITY_STAFF" : "FACILITY_MANAGER",
          ),
          eq(facilityAssignments.isActive, true),
          or(isNull(facilityAssignments.endedAt), gt(facilityAssignments.endedAt, new Date())),
        ),
      );
    return this.db
      .select({
        id: notificationOutbox.id,
        type: notificationOutbox.eventType,
        bookingId: notificationOutbox.bookingId,
        reservationId: notificationOutbox.reservationId,
        subject: notificationOutbox.subject,
        body: notificationOutbox.body,
        occurredAt: notificationOutbox.occurredAt,
      })
      .from(notificationOutbox)
      .leftJoin(bookings, eq(bookings.id, notificationOutbox.bookingId))
      .leftJoin(reservations, eq(reservations.id, notificationOutbox.reservationId))
      .where(
        and(
          eq(notificationOutbox.recipientUserId, userId),
          eq(notificationOutbox.recipientRole, role),
          role === "CUSTOMER"
            ? or(eq(bookings.userId, userId), eq(reservations.customerId, userId))
            : role === "BUSINESS_OPERATION_MANAGER"
              ? exists(
                  this.db
                    .select({ id: supportTickets.id })
                    .from(supportTickets)
                    .where(
                      and(
                        eq(supportTickets.id, notificationOutbox.supportTicketId),
                        eq(supportTickets.category, "PAYMENT"),
                      ),
                    ),
                )
              : role === "FACILITY_STAFF"
                ? and(exists(facilityAccess), isNull(notificationOutbox.supportTicketId))
                : exists(facilityAccess),
        ),
      )
      .orderBy(desc(notificationOutbox.occurredAt), desc(notificationOutbox.id))
      .limit(query.limit)
      .offset(query.offset);
  }
}
