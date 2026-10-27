import type { FacilitySupportQuery } from "@metastorage/contracts";
import {
  and,
  asc,
  bookings,
  count,
  type Database,
  desc,
  eq,
  exists,
  facilityAssignments,
  getTableColumns,
  gt,
  ilike,
  inArray,
  isNull,
  lt,
  or,
  sql,
  supportAttachments,
  supportAudit,
  supportMessages,
  supportTickets,
  users,
} from "@metastorage/database";
import type { SupportConnection, SupportTransaction } from "../support/support.types";
import type { OperationsActor } from "./support-operations.types";
import { workspaceMembership } from "./workspace-scope";
export class SupportOperationsRepository {
  constructor(readonly db: Database) {}
  transaction<T>(fn: (tx: SupportTransaction) => Promise<T>) {
    return this.db.transaction(fn);
  }
  async actor(id: string, db: SupportConnection = this.db, lock = false) {
    const query = db
      .select()
      .from(users)
      .where(and(eq(users.id, id), eq(users.status, "ACTIVE")));
    return (lock ? await query.for("share") : await query)[0];
  }
  scope(actor: OperationsActor, db: SupportConnection = this.db) {
    if (actor.role === "BUSINESS_OPERATION_MANAGER")
      return and(
        eq(supportTickets.category, "PAYMENT"),
        exists(
          db
            .select({ id: users.id })
            .from(users)
            .where(
              and(
                eq(users.id, actor.id),
                eq(users.role, "BUSINESS_OPERATION_MANAGER"),
                eq(users.status, "ACTIVE"),
              ),
            ),
        ),
      );
    if (actor.role === "FACILITY_MANAGER" || actor.role === "FACILITY_STAFF")
      return and(
        workspaceMembership(db, actor.id, actor.role, sql`${supportTickets.facilityId}`),
        actor.role === "FACILITY_STAFF" ? eq(supportTickets.assignedStaffId, actor.id) : undefined,
      );
    return sql`false`;
  }
  async allowed(actor: OperationsActor, facilityId: string) {
    if (actor.role === "BUSINESS_OPERATION_MANAGER") return true;
    if (actor.role !== "FACILITY_MANAGER" && actor.role !== "FACILITY_STAFF") return false;
    return Boolean(
      (
        await this.db
          .select({ id: users.id })
          .from(users)
          .where(
            and(
              eq(users.id, actor.id),
              workspaceMembership(this.db, actor.id, actor.role, facilityId),
            ),
          )
      )[0],
    );
  }
  async lockMembership(tx: SupportTransaction, actor: OperationsActor, facilityId: string) {
    if (actor.role === "BUSINESS_OPERATION_MANAGER") return true;
    return Boolean(
      (
        await tx
          .select()
          .from(facilityAssignments)
          .where(
            and(
              eq(facilityAssignments.userId, actor.id),
              eq(facilityAssignments.facilityId, facilityId),
              inArray(facilityAssignments.role, ["FACILITY_MANAGER", "FACILITY_STAFF"]),
              eq(facilityAssignments.role, actor.role as "FACILITY_MANAGER" | "FACILITY_STAFF"),
              eq(facilityAssignments.isActive, true),
              or(isNull(facilityAssignments.endedAt), gt(facilityAssignments.endedAt, new Date())),
            ),
          )
          .for("share")
      )[0],
    );
  }
  async list(actor: OperationsActor, query: FacilitySupportQuery) {
    const condition = and(
      this.scope(actor),
      eq(supportTickets.facilityId, query.facilityId),
      query.status ? eq(supportTickets.status, query.status) : undefined,
      query.category ? eq(supportTickets.category, query.category) : undefined,
      query.priority ? eq(supportTickets.priority, query.priority) : undefined,
      query.search
        ? or(
            ilike(supportTickets.subject, `%${query.search}%`),
            ilike(users.name, `%${query.search}%`),
            ilike(bookings.bookingCode, `%${query.search}%`),
          )
        : undefined,
      query.overdue
        ? and(
            inArray(supportTickets.status, ["OPEN", "IN_PROGRESS"]),
            lt(supportTickets.actionDueAt, new Date()),
            sql`case when ${supportTickets.category} = 'PAYMENT' then ${supportTickets.firstBomResponseAt} is null else ${supportTickets.firstOnsiteStartedAt} is null end`,
          )
        : undefined,
    );
    const items = await this.db
      .select({
        ...getTableColumns(supportTickets),
        customerName: users.name,
        bookingCode: bookings.bookingCode,
      })
      .from(supportTickets)
      .innerJoin(bookings, eq(bookings.id, supportTickets.bookingId))
      .innerJoin(users, eq(users.id, bookings.userId))
      .where(condition)
      .orderBy(
        desc(supportTickets.priority),
        asc(supportTickets.actionDueAt),
        asc(supportTickets.id),
      )
      .limit(query.limit)
      .offset(query.offset);
    const [total] = await this.db
      .select({ total: count() })
      .from(supportTickets)
      .innerJoin(bookings, eq(bookings.id, supportTickets.bookingId))
      .innerJoin(users, eq(users.id, bookings.userId))
      .where(condition);
    return { items, total: total?.total ?? 0 };
  }
  async ticket(actor: OperationsActor, id: string, db: SupportConnection = this.db, lock = false) {
    const query = db
      .select(getTableColumns(supportTickets))
      .from(supportTickets)
      .where(and(eq(supportTickets.id, id), this.scope(actor, db)));
    return (lock ? await query.for("update") : await query)[0];
  }
  async ownerTicket(tx: SupportTransaction, actorId: string, id: string) {
    return (
      await tx
        .select(getTableColumns(supportTickets))
        .from(supportTickets)
        .innerJoin(bookings, eq(bookings.id, supportTickets.bookingId))
        .innerJoin(users, eq(users.id, bookings.userId))
        .where(
          and(
            eq(supportTickets.id, id),
            eq(supportTickets.ownerUserId, actorId),
            eq(bookings.userId, actorId),
          ),
        )
        .for("update", { of: supportTickets })
    )[0];
  }
  async context(id: string) {
    const [row] = await this.db
      .select({ customerName: users.name, bookingCode: bookings.bookingCode })
      .from(supportTickets)
      .innerJoin(bookings, eq(bookings.id, supportTickets.bookingId))
      .innerJoin(users, eq(users.id, bookings.userId))
      .where(eq(supportTickets.id, id));
    return row;
  }
  async latestReport(ticketId: string, assignmentVersion: number, db: SupportConnection = this.db) {
    return (
      await db
        .select()
        .from(supportAudit)
        .where(
          and(
            eq(supportAudit.ticketId, ticketId),
            eq(supportAudit.action, "STAFF_REPORT"),
            eq(supportAudit.assignmentVersion, assignmentVersion),
          ),
        )
        .orderBy(desc(supportAudit.nextVersion))
        .limit(1)
    )[0];
  }
  async messages(actor: OperationsActor, id: string, limit: number, offset: number) {
    const condition = and(
      eq(supportMessages.ticketId, id),
      actor.role === "FACILITY_STAFF"
        ? inArray(supportMessages.kind, ["PUBLIC_REPLY", "STAFF_REPORT"])
        : undefined,
    );
    const rows = await this.db
      .select({ ...getTableColumns(supportMessages), authorName: users.name })
      .from(supportMessages)
      .innerJoin(users, eq(users.id, supportMessages.authorId))
      .where(condition)
      .orderBy(desc(supportMessages.createdAt), desc(supportMessages.id))
      .limit(limit)
      .offset(offset);
    const [total] = await this.db.select({ total: count() }).from(supportMessages).where(condition);
    const images = rows.length
      ? await this.db
          .select()
          .from(supportAttachments)
          .where(
            inArray(
              supportAttachments.messageId,
              rows.map((row) => row.id),
            ),
          )
      : [];
    return { rows, images, total: total?.total ?? 0 };
  }
  async staff(tx: SupportTransaction, id: string, facilityId: string) {
    const [row] = await tx
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.id, id),
          eq(users.role, "FACILITY_STAFF"),
          eq(users.status, "ACTIVE"),
          workspaceMembership(tx, id, "FACILITY_STAFF", facilityId),
        ),
      )
      .for("share");
    // Membership is locked as well so a concurrent revocation cannot validate stale assignment.
    const [assignment] = await tx
      .select()
      .from(facilityAssignments)
      .where(
        and(
          eq(facilityAssignments.userId, id),
          eq(facilityAssignments.facilityId, facilityId),
          eq(facilityAssignments.role, "FACILITY_STAFF"),
          eq(facilityAssignments.isActive, true),
          or(isNull(facilityAssignments.endedAt), gt(facilityAssignments.endedAt, new Date())),
        ),
      )
      .for("share");
    return row && assignment ? row : undefined;
  }
  async staffName(id: string | null) {
    if (!id) return null;
    return (
      (await this.db.select({ name: users.name }).from(users).where(eq(users.id, id)))[0]?.name ??
      null
    );
  }
  async image(actor: OperationsActor, id: string, imageId: string) {
    if (!(await this.ticket(actor, id))) return undefined;
    return (
      await this.db
        .select(getTableColumns(supportAttachments))
        .from(supportAttachments)
        .innerJoin(supportMessages, eq(supportMessages.id, supportAttachments.messageId))
        .where(
          and(
            eq(supportAttachments.ticketId, id),
            eq(supportAttachments.id, imageId),
            actor.role === "FACILITY_STAFF"
              ? inArray(supportMessages.kind, ["PUBLIC_REPLY", "STAFF_REPORT"])
              : undefined,
          ),
        )
    )[0];
  }
}
