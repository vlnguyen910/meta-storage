import { createHash } from "node:crypto";
import {
  type FacilitySupportQuery,
  FACILITY_WORKSPACE_MESSAGES as M,
  SUPPORT_MESSAGES,
  type SupportOperation,
  type SupportOperationsTicket,
} from "@metastorage/contracts";
import {
  eq,
  type SupportTicketRow,
  supportAudit,
  supportMessages,
  supportTickets,
} from "@metastorage/database";
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../common/errors/app-error";
import type { SupportImageStorage } from "../support/support.types";
import { SupportCloudinaryImageStorage } from "../support/support-image.storage";
import { recordSupportOperation } from "./support-events";
import type { SupportOperationsRepository } from "./support-operations.repository";
export class SupportOperationsService {
  constructor(
    private readonly repository: SupportOperationsRepository,
    private readonly storage: SupportImageStorage = new SupportCloudinaryImageStorage(),
  ) {}
  private async actor(id: string) {
    const actor = await this.repository.actor(id);
    if (
      !actor ||
      !["FACILITY_MANAGER", "FACILITY_STAFF", "BUSINESS_OPERATION_MANAGER"].includes(
        actor.role ?? "",
      )
    )
      throw new ForbiddenError(M.denied);
    return actor;
  }
  private async dto(row: SupportTicketRow): Promise<SupportOperationsTicket> {
    const context = await this.repository.context(row.id);
    const report = await this.repository.latestReport(row.id, row.assignmentVersion);
    return {
      id: row.id,
      bookingId: row.bookingId,
      facilityId: row.facilityId,
      rentalId: row.rentalId,
      storageUnitId: row.storageUnitId,
      paymentId: row.paymentId,
      category: row.category,
      subject: row.subject,
      status: row.status,
      priority: row.priority,
      version: row.version,
      actionDueAt: row.actionDueAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      closedAt: row.closedAt?.toISOString() ?? null,
      closureKind: row.closureKind,
      closeReason: row.closeReason,
      assignedStaffId: row.assignedStaffId,
      assignedStaffName: await this.repository.staffName(row.assignedStaffId),
      assignmentVersion: row.assignmentVersion,
      customerName: context?.customerName ?? "",
      bookingCode: context?.bookingCode ?? null,
      firstOnsiteStartedAt: row.firstOnsiteStartedAt?.toISOString() ?? null,
      firstBomResponseAt: row.firstBomResponseAt?.toISOString() ?? null,
      latestReportId:
        typeof report?.details.messageId === "string" ? report.details.messageId : null,
    };
  }
  async list(id: string, query: FacilitySupportQuery) {
    const actor = await this.actor(id);
    if (!(await this.repository.allowed(actor, query.facilityId)))
      throw new ForbiddenError(M.denied);
    const page = await this.repository.list(actor, query);
    return {
      items: await Promise.all(page.items.map((row) => this.dto(row))),
      total: page.total,
      limit: query.limit,
      offset: query.offset,
    };
  }
  async detail(id: string, ticketId: string, limit = 20, offset = 0) {
    const actor = await this.actor(id),
      ticket = await this.repository.ticket(actor, ticketId);
    if (!ticket) throw new NotFoundError(M.missing);
    const history = await this.repository.messages(actor, ticketId, limit, offset);
    // Recheck scope after loading private history, including reassignment during the read.
    if (!(await this.repository.ticket(actor, ticketId))) throw new NotFoundError(M.missing);
    return {
      ticket: await this.dto(ticket),
      totalMessages: history.total,
      limit,
      offset,
      messages: history.rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        content: row.content,
        authorName: row.authorName,
        createdAt: row.createdAt.toISOString(),
        attachments: history.images
          .filter((image) => image.messageId === row.id)
          .map((image) => ({
            id: image.id,
            ticketId: image.ticketId,
            messageId: image.messageId,
            filename: image.originalFilename,
            mimeType: image.mimeType,
            byteSize: image.byteSize,
            createdAt: image.createdAt.toISOString(),
          })),
      })),
    };
  }
  async image(id: string, ticketId: string, imageId: string) {
    const actor = await this.actor(id);
    const image = await this.repository.image(actor, ticketId, imageId);
    if (!image) throw new NotFoundError(M.missing);
    const bytes = await this.storage.get(image.objectKey);
    if (
      bytes.byteLength !== image.byteSize ||
      createHash("sha256").update(bytes).digest("hex") !== image.checksum
    )
      throw new AppError(SUPPORT_MESSAGES.storageUnavailable, 503, "SUPPORT_STORAGE_UNAVAILABLE");
    if (!(await this.repository.image(actor, ticketId, imageId)))
      throw new NotFoundError(M.missing);
    return { bytes, mimeType: image.mimeType };
  }
  async withdraw(id: string, ticketId: string, input: { version: number; reason: string }) {
    return this.repository.transaction(async (tx) => {
      const actor = await this.repository.actor(id, tx, true);
      if (actor?.role !== "CUSTOMER") throw new ForbiddenError(M.denied);
      const ticket = await this.repository.ownerTicket(tx, id, ticketId);
      if (!ticket) throw new NotFoundError(M.missing);
      if (ticket.version !== input.version) throw new ConflictError(M.stale);
      if (ticket.status === "CLOSED") throw new ConflictError(M.state);
      const [updated] = await tx
        .update(supportTickets)
        .set({
          version: ticket.version + 1,
          status: "CLOSED",
          closedBy: id,
          closedAt: new Date(),
          closureKind: "CUSTOMER_WITHDREW",
          closeReason: input.reason,
          updatedAt: new Date(),
        })
        .where(eq(supportTickets.id, ticketId))
        .returning();
      if (!updated) throw new NotFoundError(M.missing);
      await tx.insert(supportAudit).values({
        ticketId,
        actorId: id,
        action: "CUSTOMER_WITHDREW",
        previousVersion: ticket.version,
        nextVersion: updated.version,
        oldStatus: ticket.status,
        newStatus: "CLOSED",
        assignmentVersion: ticket.assignmentVersion,
        reason: input.reason,
      });
      await recordSupportOperation(tx, updated, id, "CUSTOMER_WITHDREW", input.reason);
      return {
        id: updated.id,
        status: updated.status,
        version: updated.version,
        closedAt: updated.closedAt?.toISOString(),
        closureKind: updated.closureKind,
        closeReason: updated.closeReason,
      };
    });
  }
  async mutate(id: string, ticketId: string, input: SupportOperation) {
    await this.repository.transaction(async (tx) => {
      const actor = await this.repository.actor(id, tx, true);
      if (!actor) throw new ForbiddenError(M.denied);
      const ticket = await this.repository.ticket(actor, ticketId, tx, true);
      if (!ticket) throw new NotFoundError(M.missing);
      if (!(await this.repository.lockMembership(tx, actor, ticket.facilityId)))
        throw new ForbiddenError(M.denied);
      if (ticket.version !== input.version) throw new ConflictError(M.stale);
      if ((ticket.status === "CLOSED") !== (input.action === "REOPEN"))
        throw new ConflictError(M.state);
      const manager = actor.role === "FACILITY_MANAGER",
        staff = actor.role === "FACILITY_STAFF",
        bom = actor.role === "BUSINESS_OPERATION_MANAGER";
      const controls =
        (manager && ticket.category !== "PAYMENT") || (bom && ticket.category === "PAYMENT");
      const now = new Date();
      const patch: Partial<typeof supportTickets.$inferInsert> = {
        version: ticket.version + 1,
        updatedAt: now,
      };
      let messageId: string | undefined;
      let content: string | undefined;
      let kind: "PUBLIC_REPLY" | "INTERNAL_NOTE" | "STAFF_REPORT" = "PUBLIC_REPLY";
      switch (input.action) {
        case "ASSIGN":
          if (!manager) throw new ForbiddenError(M.denied);
          if (!(await this.repository.staff(tx, input.staffId, ticket.facilityId)))
            throw new ValidationError(M.staff);
          if (ticket.assignedStaffId === input.staffId) return;
          Object.assign(patch, {
            status: "IN_PROGRESS",
            assignedStaffId: input.staffId,
            assignedBy: id,
            assignedAt: now,
            firstAssignedAt: ticket.firstAssignedAt ?? now,
            assignmentVersion: ticket.assignmentVersion + 1,
          });
          break;
        case "REPLY":
          content = input.content;
          if (bom)
            Object.assign(patch, {
              status: "IN_PROGRESS",
              firstBomResponseAt: ticket.firstBomResponseAt ?? now,
            });
          break;
        case "NOTE":
          if (!manager && !bom) throw new ForbiddenError(M.denied);
          kind = "INTERNAL_NOTE";
          content = input.content;
          break;
        case "REPORT":
          if (!staff || ticket.status !== "IN_PROGRESS") throw new ForbiddenError(M.denied);
          kind = "STAFF_REPORT";
          content = input.content;
          break;
        case "START":
          if (staff && ticket.status === "IN_PROGRESS") {
            if (ticket.firstOnsiteStartedAt) return;
            patch.firstOnsiteStartedAt = now;
          } else if (bom) {
            if (ticket.firstBomResponseAt) return;
            Object.assign(patch, { status: "IN_PROGRESS", firstBomResponseAt: now });
          } else throw new ForbiddenError(M.denied);
          break;
        case "ACCEPT": {
          if (!manager || !controls || ticket.status !== "IN_PROGRESS")
            throw new ForbiddenError(M.denied);
          const report = await this.repository.latestReport(ticketId, ticket.assignmentVersion, tx);
          if (!report || report.details.messageId !== input.reportId)
            throw new ConflictError(M.report);
          content = input.reason;
          Object.assign(patch, {
            status: "CLOSED",
            closedBy: id,
            closedAt: now,
            closureKind: "RESOLVED",
            closeReason: input.reason,
          });
          break;
        }
        case "CLOSE":
          if (!bom || ticket.status !== "IN_PROGRESS") throw new ForbiddenError(M.denied);
          content = input.reason;
          Object.assign(patch, {
            status: "CLOSED",
            closedBy: id,
            closedAt: now,
            closureKind: "RESOLVED",
            closeReason: input.reason,
          });
          break;
        case "REOPEN":
          if (!controls) throw new ForbiddenError(M.denied);
          Object.assign(patch, {
            status: "OPEN",
            assignedStaffId: null,
            assignedBy: null,
            assignedAt: null,
            assignmentVersion: ticket.assignmentVersion + 1,
            closedBy: null,
            closedAt: null,
            closureKind: null,
            closeReason: null,
          });
          content = input.reason;
          break;
        case "PRIORITY":
          if (!controls) throw new ForbiddenError(M.denied);
          patch.priority = input.priority;
          break;
      }
      if (content) {
        const [message] = await tx
          .insert(supportMessages)
          .values({ ticketId, authorId: id, kind, content })
          .returning();
        messageId = message?.id;
      }
      const [updated] = await tx
        .update(supportTickets)
        .set(patch)
        .where(eq(supportTickets.id, ticketId))
        .returning();
      if (updated)
        await recordSupportOperation(
          tx,
          updated,
          id,
          input.action,
          kind === "PUBLIC_REPLY" ? content : undefined,
        );
      await tx.insert(supportAudit).values({
        ticketId,
        actorId: id,
        action: input.action === "REPORT" ? "STAFF_REPORT" : input.action,
        previousVersion: ticket.version,
        nextVersion: ticket.version + 1,
        oldStatus: ticket.status,
        newStatus: patch.status ?? ticket.status,
        previousStaffId: ticket.assignedStaffId,
        nextStaffId:
          patch.assignedStaffId === undefined ? ticket.assignedStaffId : patch.assignedStaffId,
        assignmentVersion: patch.assignmentVersion ?? ticket.assignmentVersion,
        reason: "reason" in input ? input.reason : null,
        details: {
          messageId: messageId ?? null,
          reportId: input.action === "ACCEPT" ? input.reportId : null,
        },
      });
    });
    return this.detail(id, ticketId);
  }
}
