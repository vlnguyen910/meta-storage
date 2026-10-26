import { createHash, randomUUID } from "node:crypto";
import {
  SUPPORT_IMAGE_MAX_BYTES,
  SUPPORT_IMAGE_MAX_COUNT,
  SUPPORT_RESPONSE_HOURS,
  type SupportAttachmentDto,
  type SupportCreateInput,
  type SupportDetail,
  type SupportImageInput,
  type SupportImageResult,
  type SupportMessageDto,
  type SupportMessagePage,
  type SupportPageQuery,
  type SupportReplyInput,
  type SupportReplyResult,
  type SupportTicketDto,
  type SupportTicketPage,
  type SupportTicketQuery,
} from "@metastorage/contracts";
import type { SupportAttachmentRow, SupportTicketRow } from "@metastorage/database";
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../common/errors/app-error";
import { SUPPORT_MESSAGES as m, supportReceiptBody } from "./support.messages";
import type { SupportRepository } from "./support.repository";
import type {
  SupportCursor,
  SupportImageFile,
  SupportImageStorage,
  SupportMessageRecord,
  SupportResultReference,
  SupportTransaction,
} from "./support.types";
import { SupportCloudinaryImageStorage } from "./support-image.storage";
import { isSupportImage } from "./support-image.validation";

export class SupportService {
  constructor(
    private readonly repository: SupportRepository,
    private readonly storage: SupportImageStorage = new SupportCloudinaryImageStorage(),
  ) {}

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
  private hash(value: unknown) {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
  }
  private mapTicket(r: SupportTicketRow): SupportTicketDto {
    return {
      id: r.id,
      bookingId: r.bookingId,
      facilityId: r.facilityId,
      rentalId: r.rentalId,
      storageUnitId: r.storageUnitId,
      paymentId: r.paymentId,
      category: r.category,
      subject: r.subject,
      status: r.status,
      priority: r.priority,
      version: r.version,
      actionDueAt: r.actionDueAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      closedAt: r.closedAt?.toISOString() ?? null,
      closureKind: r.closureKind,
      closeReason: r.closeReason,
    };
  }
  private mapAttachment(r: SupportAttachmentRow): SupportAttachmentDto {
    return {
      id: r.id,
      ticketId: r.ticketId,
      messageId: r.messageId,
      filename: r.originalFilename,
      mimeType: r.mimeType as SupportAttachmentDto["mimeType"],
      byteSize: r.byteSize,
      createdAt: r.createdAt.toISOString(),
    };
  }
  private mapMessage(r: SupportMessageRecord, images: SupportAttachmentRow[]): SupportMessageDto {
    return {
      id: r.id,
      ticketId: r.ticketId,
      content: r.content,
      authorName: r.authorName,
      authorRole: r.authorRole ?? "UNKNOWN",
      createdAt: r.createdAt.toISOString(),
      attachments: images.filter((i) => i.messageId === r.id).map((i) => this.mapAttachment(i)),
    };
  }
  private async requireCustomer(tx: SupportTransaction, actorId: string) {
    const actor = await this.repository.lockActor(tx, actorId);
    if (actor?.role !== "CUSTOMER" || actor.status !== "ACTIVE")
      throw new ForbiddenError(m.customerOnly);
    return actor;
  }
  private async requireTicket(actorId: string, id: string) {
    const row = await this.repository.ticket(actorId, id);
    if (!row) throw new NotFoundError(m.notFound);
    return row;
  }
  private async lockTicket(tx: SupportTransaction, actorId: string, id: string) {
    await this.requireCustomer(tx, actorId);
    const context = await this.repository.ticket(actorId, id, tx);
    if (!context || !(await this.repository.lockBooking(tx, context.bookingId, actorId)))
      throw new NotFoundError(m.notFound);
    const row = await this.repository.ticket(actorId, id, tx, true);
    if (!row) throw new NotFoundError(m.notFound);
    return row;
  }
  private writable(ticket: SupportTicketRow, version: number) {
    if (ticket.status === "CLOSED") throw new ConflictError(m.closed);
    if (ticket.version !== version) throw new ConflictError(m.versionConflict);
  }
  private async claim(
    tx: SupportTransaction,
    actor: string,
    operation: string,
    key: string,
    input: unknown,
  ) {
    const hash = this.hash(input);
    const result = await this.repository.claim(tx, actor, operation, key, hash);
    if (!result.row || result.row.requestHash !== hash)
      throw new ConflictError(m.idempotencyConflict);
    if (result.fresh) return null;
    if (!result.row.resultReference) throw new ConflictError(m.idempotencyConflict);
    return result.row.resultReference;
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
        .map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
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
      items: rows.slice(0, input.limit).map((r) => ({
        ...r,
        source: r.source ?? "BOOKING",
        createdAt: r.createdAt.toISOString(),
      })),
      nextCursor: this.next(rows, input.limit),
    };
  }

  async list(actorId: string, input: SupportTicketQuery): Promise<SupportTicketPage> {
    const rows = await this.repository.list(actorId, input, this.cursor(input.cursor));
    return {
      items: rows.slice(0, input.limit).map((r) => this.mapTicket(r)),
      nextCursor: this.next(rows, input.limit),
    };
  }
  async messages(
    actorId: string,
    id: string,
    input: SupportPageQuery,
  ): Promise<SupportMessagePage> {
    await this.requireTicket(actorId, id);
    const rows = await this.repository.messages(actorId, id, input, this.cursor(input.cursor));
    const page = rows.slice(0, input.limit);
    const images = await this.repository.attachments(
      actorId,
      id,
      page.map((r) => r.id),
    );
    return {
      items: page.map((r) => this.mapMessage(r, images)),
      nextCursor: this.next(rows, input.limit),
    };
  }
  async detail(actorId: string, id: string): Promise<SupportDetail> {
    const ticket = await this.requireTicket(actorId, id);
    return {
      ticket: this.mapTicket(ticket),
      messages: await this.messages(actorId, id, { limit: 20 }),
    };
  }
  async create(actorId: string, input: SupportCreateInput): Promise<SupportDetail> {
    const reference = await this.repository.transaction(async (tx) => {
      const actor = await this.requireCustomer(tx, actorId);
      const booking = await this.repository.lockBooking(tx, input.bookingId, actorId);
      if (!booking) throw new NotFoundError(m.notFound);
      const replay = await this.claim(tx, actorId, "CREATE_TICKET", input.idempotencyKey, input);
      if (replay) return replay;
      let rentalId: string | null = null,
        storageUnitId: string | null = null;
      if (input.category !== "PAYMENT") {
        if (input.paymentId) throw new ValidationError(m.invalidPayment);
        const rental = await this.repository.lockRental(tx, booking.id);
        if (
          !rental ||
          rental.closedAt ||
          rental.facilityId !== booking.facilityId ||
          booking.status !== "CHECKED_IN"
        )
          throw new ConflictError(m.handoverRequired);
        const unit = await this.repository.unit(tx, rental.physicalUnitId);
        if (!unit || unit.facilityId !== booking.facilityId)
          throw new ConflictError(m.invalidContext);
        rentalId = rental.id;
        storageUnitId = unit.id;
      } else if (input.paymentId) {
        const payment = await this.repository.payment(tx, input.paymentId);
        if (!payment || (payment.bookingId ?? payment.chargeBookingId) !== booking.id)
          throw new ValidationError(m.invalidPayment);
      }
      const now = new Date();
      const ticket = await this.repository.insertTicket(tx, {
        bookingId: booking.id,
        ownerUserId: actorId,
        facilityId: booking.facilityId,
        rentalId,
        storageUnitId,
        paymentId: input.paymentId ?? null,
        category: input.category,
        subject: input.subject,
        actionDueAt: new Date(now.getTime() + SUPPORT_RESPONSE_HOURS * 3600000),
        createdAt: now,
        updatedAt: now,
      });
      const message = await this.repository.insertMessage(tx, {
        ticketId: ticket.id,
        authorId: actorId,
        kind: "PUBLIC_REPLY",
        content: input.content,
      });
      await this.repository.audit(tx, {
        ticketId: ticket.id,
        actorId,
        action: "CREATED",
        nextVersion: 0,
        newStatus: "OPEN",
        details: { source: "CUSTOMER_API", messageId: message.id, category: input.category },
      });
      await this.repository.receipt(tx, {
        eventKey: `support:${ticket.id}:0:created:EMAIL`,
        recipientKey: `user:${actorId}`,
        eventType: "SUPPORT_CREATED",
        supportTicketId: ticket.id,
        bookingId: booking.id,
        facilityId: booking.facilityId,
        recipientUserId: actorId,
        recipientRole: "CUSTOMER",
        recipientEmail: actor.email,
        subject: m.receivedSubject,
        body: supportReceiptBody(ticket.id, input.category === "PAYMENT"),
      });
      const result = { ticketId: ticket.id, messageId: message.id };
      await this.repository.finish(tx, actorId, "CREATE_TICKET", input.idempotencyKey, result);
      return result;
    });
    return this.detail(actorId, reference.ticketId);
  }
  async reply(actorId: string, id: string, input: SupportReplyInput): Promise<SupportReplyResult> {
    const reference = await this.repository.transaction(async (tx) => {
      const ticket = await this.lockTicket(tx, actorId, id);
      const operation = `PUBLIC_REPLY:${id}`;
      const replay = await this.claim(tx, actorId, operation, input.idempotencyKey, input);
      if (replay) return replay;
      this.writable(ticket, input.version);
      const message = await this.repository.insertMessage(tx, {
        ticketId: id,
        authorId: actorId,
        kind: "PUBLIC_REPLY",
        content: input.content,
      });
      await this.repository.advance(tx, id, ticket.version + 1);
      await this.repository.audit(tx, {
        ticketId: id,
        actorId,
        action: "PUBLIC_REPLIED",
        previousVersion: ticket.version,
        nextVersion: ticket.version + 1,
        oldStatus: ticket.status,
        newStatus: ticket.status,
        details: { source: "CUSTOMER_API", messageId: message.id },
      });
      const result = { ticketId: id, messageId: message.id };
      await this.repository.finish(tx, actorId, operation, input.idempotencyKey, result);
      return result;
    });
    const message = await this.repository.message(actorId, id, reference.messageId ?? "");
    if (!message) throw new NotFoundError(m.notFound);
    const images = await this.repository.attachments(actorId, id, [message.id]);
    return {
      ticket: this.mapTicket(await this.requireTicket(actorId, id)),
      message: this.mapMessage(message, images),
    };
  }
  private decode(input: SupportImageInput): Buffer {
    const b = Buffer.from(input.dataBase64, "base64");
    if (
      !b.length ||
      b.length > SUPPORT_IMAGE_MAX_BYTES ||
      b.toString("base64") !== input.dataBase64 ||
      !isSupportImage(b, input.mimeType)
    )
      throw new ValidationError(m.invalidImage);
    return b;
  }
  async upload(
    actorId: string,
    id: string,
    messageId: string,
    input: SupportImageInput,
  ): Promise<SupportImageResult> {
    const bytes = this.decode(input);
    let asset: string | undefined;
    let uploaded = false;
    let commitMayHaveBeenAttempted = false;
    try {
      const reference = await this.repository.transaction(
        async (tx): Promise<SupportResultReference> => {
          const ticket = await this.lockTicket(tx, actorId, id);
          const operation = `UPLOAD_IMAGE:${id}:${messageId}`;
          const replay = await this.claim(tx, actorId, operation, input.idempotencyKey, input);
          if (replay) return replay;
          this.writable(ticket, input.version);
          const message = await this.repository.message(actorId, id, messageId, tx);
          if (!message || message.authorId !== actorId) throw new NotFoundError(m.notFound);
          if ((await this.repository.imageCount(tx, id)) >= SUPPORT_IMAGE_MAX_COUNT)
            throw new ConflictError(m.imageLimit);
          const imageId = randomUUID();
          asset = `metastorage/support/${id}/${imageId}`;
          await this.storage.put(asset, bytes);
          uploaded = true;
          const image = await this.repository.insertImage(tx, {
            id: imageId,
            ticketId: id,
            messageId,
            uploadedBy: actorId,
            objectKey: asset,
            originalFilename: input.filename,
            mimeType: input.mimeType,
            byteSize: bytes.length,
            checksum: createHash("sha256").update(bytes).digest("hex"),
          });
          await this.repository.advance(tx, id, ticket.version + 1);
          await this.repository.audit(tx, {
            ticketId: id,
            actorId,
            action: "IMAGE_ATTACHED",
            previousVersion: ticket.version,
            nextVersion: ticket.version + 1,
            oldStatus: ticket.status,
            newStatus: ticket.status,
            details: { source: "CUSTOMER_API", messageId, attachmentId: image.id },
          });
          const result = { ticketId: id, attachmentId: image.id };
          await this.repository.finish(tx, actorId, operation, input.idempotencyKey, result);
          // Once the callback returns, COMMIT may succeed even if its acknowledgement is lost.
          commitMayHaveBeenAttempted = true;
          return result;
        },
      );
      const image = await this.repository.attachment(actorId, id, reference.attachmentId ?? "");
      if (!image) throw new NotFoundError(m.notFound);
      return {
        ticket: this.mapTicket(await this.requireTicket(actorId, id)),
        attachment: this.mapAttachment(image),
      };
    } catch (error) {
      if (asset && uploaded && !commitMayHaveBeenAttempted) {
        try {
          if (!(await this.repository.imageReferenced(asset))) await this.storage.remove(asset);
        } catch {
          console.error("Support image requires orphan reconciliation.");
        }
      }
      throw error;
    }
  }
  async image(actorId: string, id: string, imageId: string): Promise<SupportImageFile> {
    const image = await this.repository.attachment(actorId, id, imageId);
    if (!image) throw new NotFoundError(m.notFound);
    const bytes = await this.storage.get(image.objectKey);
    // A storage call must not retain access after ownership/account revocation.
    if (!(await this.repository.attachment(actorId, id, imageId)))
      throw new NotFoundError(m.notFound);
    if (
      bytes.length !== image.byteSize ||
      createHash("sha256").update(bytes).digest("hex") !== image.checksum
    )
      throw new AppError(m.imageIntegrity, 503, "SUPPORT_IMAGE_UNAVAILABLE");
    return { attachment: image, bytes };
  }
}
