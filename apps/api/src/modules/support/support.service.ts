import {
  SUPPORT_RESPONSE_HOURS,
  type SupportCreateInput,
  type SupportDetail,
  type SupportPageQuery,
  type SupportTicketDto,
  type SupportTicketPage,
  type SupportTicketQuery,
} from "@metastorage/contracts";
import type { SupportTicketRow } from "@metastorage/database";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../common/errors/app-error";
import { SUPPORT_MESSAGES as m, supportReceiptBody } from "./support.messages";
import type { SupportRepository } from "./support.repository";
import type { SupportCursor, SupportTransaction } from "./support.types";

export class SupportService {
  constructor(private readonly repository: SupportRepository) {}

  private cursor(input?: string): SupportCursor | undefined {
    if (!input) return;
    try {
      const parsed = JSON.parse(Buffer.from(input, "base64url").toString("utf8"));
      const date = new Date(parsed.createdAt);
      if (
        Object.keys(parsed).sort().join(",") !== "createdAt,id" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          parsed.id,
        ) ||
        date.toISOString() !== parsed.createdAt ||
        Buffer.from(JSON.stringify(parsed)).toString("base64url") !== input
      )
        throw new Error("cursor");
      return { id: parsed.id, createdAt: date };
    } catch {
      throw new ValidationError(m.invalidCursor);
    }
  }

  private next(rows: { id: string; createdAt: Date }[], limit: number) {
    const last = rows[limit - 1];
    return rows.length > limit && last
      ? Buffer.from(
          JSON.stringify({ id: last.id, createdAt: last.createdAt.toISOString() }),
        ).toString("base64url")
      : null;
  }

  private mapTicket(row: SupportTicketRow): SupportTicketDto {
    const createdAt = row.createdAt.toISOString();
    return {
      id: row.id,
      bookingId: row.bookingId,
      facilityId: row.facilityId,
      rentalId: row.rentalId,
      storageUnitId: null,
      paymentId: row.paymentId,
      category: row.category,
      subject: row.subject,
      description: row.description,
      status: "OPEN",
      priority: "NORMAL",
      version: 0,
      actionDueAt: row.actionDueAt.toISOString(),
      createdAt,
      updatedAt: createdAt,
      closedAt: null,
      closureKind: null,
      closeReason: null,
    };
  }

  private sameRequest(row: SupportTicketRow, input: SupportCreateInput) {
    return (
      row.bookingId === input.bookingId &&
      row.category === input.category &&
      row.paymentId === (input.paymentId ?? null) &&
      row.subject === input.subject &&
      row.description === input.content
    );
  }

  private async requireCustomer(tx: SupportTransaction, actorId: string) {
    const actor = await this.repository.lockActor(tx, actorId);
    if (actor?.role !== "CUSTOMER" || actor.status !== "ACTIVE")
      throw new ForbiddenError(m.customerOnly);
    return actor;
  }

  async contexts(
    actorId: string,
    input: import("@metastorage/contracts").SupportContextQuery,
  ): Promise<
    import("@metastorage/contracts").SupportContextPage<
      import("@metastorage/contracts").SupportBookingContext
    >
  > {
    const rows = await this.repository.contexts(actorId, input, this.cursor(input.cursor));
    return {
      items: rows
        .slice(0, input.limit)
        .map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
      nextCursor: this.next(rows, input.limit),
    };
  }

  async contextPayments(
    actorId: string,
    bookingId: string,
    input: SupportPageQuery,
  ): Promise<
    import("@metastorage/contracts").SupportContextPage<
      import("@metastorage/contracts").SupportPaymentContext
    >
  > {
    if (!(await this.repository.contextBooking(actorId, bookingId)))
      throw new NotFoundError(m.notFound);
    const rows = await this.repository.contextPayments(
      actorId,
      bookingId,
      input,
      this.cursor(input.cursor),
    );
    return {
      items: rows.slice(0, input.limit).map((row) => ({
        ...row,
        source: "BOOKING" as const,
        createdAt: row.createdAt.toISOString(),
      })),
      nextCursor: this.next(rows, input.limit),
    };
  }

  async list(actorId: string, input: SupportTicketQuery): Promise<SupportTicketPage> {
    if (input.status && input.status !== "OPEN") return { items: [], nextCursor: null };
    const rows = await this.repository.list(actorId, input, this.cursor(input.cursor));
    return {
      items: rows.slice(0, input.limit).map((row) => this.mapTicket(row)),
      nextCursor: this.next(rows, input.limit),
    };
  }

  async detail(actorId: string, id: string): Promise<SupportDetail> {
    const ticket = await this.repository.ticket(actorId, id);
    if (!ticket) throw new NotFoundError(m.notFound);
    return { ticket: this.mapTicket(ticket), messages: { items: [], nextCursor: null } };
  }

  async create(actorId: string, input: SupportCreateInput): Promise<SupportDetail> {
    const ticketId = await this.repository.transaction(async (tx) => {
      const actor = await this.requireCustomer(tx, actorId);
      const booking = await this.repository.lockBooking(tx, input.bookingId, actorId);
      if (!booking) throw new NotFoundError(m.notFound);
      let rentalId: string | null = null;
      if (input.category !== "PAYMENT") {
        if (input.paymentId) throw new ValidationError(m.invalidPayment);
        const rental = await this.repository.lockRental(tx, booking.id);
        if (!rental || rental.status === "CLOSED" || booking.status !== "CHECKED_IN")
          throw new ConflictError(m.handoverRequired);
        const unit = await this.repository.unit(tx, rental.storageUnitId);
        if (!unit || unit.facilityId !== booking.facilityId)
          throw new ConflictError(m.invalidContext);
        rentalId = rental.id;
      } else if (input.paymentId) {
        const payment = await this.repository.payment(tx, input.paymentId);
        if (!payment || payment.bookingId !== booking.id)
          throw new ValidationError(m.invalidPayment);
      }
      const now = new Date();
      const created = await this.repository.insertTicket(tx, {
        bookingId: booking.id,
        ownerUserId: actorId,
        facilityId: booking.facilityId,
        rentalId,
        paymentId: input.paymentId ?? null,
        category: input.category,
        subject: input.subject,
        description: input.content,
        actionDueAt: new Date(now.getTime() + SUPPORT_RESPONSE_HOURS * 3600000),
        idempotencyKey: input.idempotencyKey,
        createdAt: now,
      });
      if (!created) {
        const existing = await this.repository.ticketByIdempotency(
          tx,
          actorId,
          input.idempotencyKey,
        );
        if (!existing || !this.sameRequest(existing, input))
          throw new ConflictError(m.idempotencyConflict);
        return existing.id;
      }
      await this.repository.receipt(tx, {
        eventKey: `support:${created.id}:0:created:EMAIL`,
        recipientKey: `user:${actorId}`,
        eventType: "SUPPORT_CREATED",
        supportTicketId: created.id,
        bookingId: booking.id,
        facilityId: booking.facilityId,
        recipientUserId: actorId,
        recipientRole: "CUSTOMER",
        recipientEmail: actor.email,
        subject: m.receivedSubject,
        body: supportReceiptBody(created.id, input.category === "PAYMENT"),
      });
      return created.id;
    });
    return this.detail(actorId, ticketId);
  }
}
