import { FACILITY_WORKSPACE_MESSAGES as M } from "@metastorage/contracts";
import {
  and,
  eq,
  facilityAssignments,
  gt,
  isNull,
  notificationOutbox,
  or,
  type SupportTicketRow,
  users,
} from "@metastorage/database";
import type { SupportTransaction } from "../support/support.types";
export async function recordSupportOperation(
  tx: SupportTransaction,
  ticket: SupportTicketRow,
  actorId: string,
  action: string,
  publicContent?: string,
) {
  const managers = await tx
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .innerJoin(facilityAssignments, eq(facilityAssignments.userId, users.id))
    .where(
      and(
        eq(facilityAssignments.facilityId, ticket.facilityId),
        eq(facilityAssignments.role, "FACILITY_MANAGER"),
        eq(users.role, "FACILITY_MANAGER"),
        eq(users.status, "ACTIVE"),
        eq(facilityAssignments.isActive, true),
        or(isNull(facilityAssignments.endedAt), gt(facilityAssignments.endedAt, new Date())),
      ),
    );
  const extras =
    ticket.category === "PAYMENT" || (ticket.assignedStaffId && action !== "NOTE")
      ? await tx
          .select({ id: users.id, email: users.email, role: users.role })
          .from(users)
          .where(
            and(
              eq(users.status, "ACTIVE"),
              or(
                ticket.category === "PAYMENT"
                  ? eq(users.role, "BUSINESS_OPERATION_MANAGER")
                  : undefined,
                ticket.assignedStaffId && action !== "NOTE"
                  ? and(eq(users.id, ticket.assignedStaffId), eq(users.role, "FACILITY_STAFF"))
                  : undefined,
              ),
            ),
          )
      : [];
  const recipients = [
    ...new Map(
      [...managers, ...extras]
        .filter((person) => person.id !== actorId)
        .map((person) => [person.id, person]),
    ).values(),
  ];
  if (recipients.length)
    await tx
      .insert(notificationOutbox)
      .values(
        recipients.map((person) => ({
          eventKey: `support:${ticket.id}:${ticket.version}:${action}:IN_APP`,
          recipientKey: `user:${person.id}`,
          eventType:
            action === "CREATED" ? ("SUPPORT_CREATED" as const) : ("SUPPORT_UPDATED" as const),
          supportTicketId: ticket.id,
          bookingId: ticket.bookingId,
          facilityId: ticket.facilityId,
          recipientUserId: person.id,
          recipientRole: person.role ?? "",
          recipientEmail: person.email,
          subject: M.notification,
          body: M.updated(ticket.id),
          status: "SENT" as const,
          sentAt: new Date(),
        })),
      )
      .onConflictDoNothing({
        target: [notificationOutbox.eventKey, notificationOutbox.recipientKey],
      });
  if (
    publicContent &&
    ["REPLY", "ACCEPT", "CLOSE", "REOPEN", "CUSTOMER_WITHDREW"].includes(action)
  ) {
    const [owner] = await tx
      .select()
      .from(users)
      .where(
        and(
          eq(users.id, ticket.ownerUserId),
          eq(users.role, "CUSTOMER"),
          eq(users.status, "ACTIVE"),
        ),
      );
    if (owner)
      await tx
        .insert(notificationOutbox)
        .values({
          eventKey: `support:${ticket.id}:${ticket.version}:${action}:EMAIL`,
          recipientKey: `user:${owner.id}`,
          eventType: "SUPPORT_UPDATED",
          supportTicketId: ticket.id,
          bookingId: ticket.bookingId,
          facilityId: ticket.facilityId,
          recipientUserId: owner.id,
          recipientRole: "CUSTOMER",
          recipientEmail: owner.email,
          subject: M.notification,
          body: `${M.updated(ticket.id)}\n${publicContent}`,
        })
        .onConflictDoNothing({
          target: [notificationOutbox.eventKey, notificationOutbox.recipientKey],
        });
  }
}
