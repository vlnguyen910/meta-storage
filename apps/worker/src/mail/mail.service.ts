import { createHmac } from "node:crypto";
import {
  type AuthMailJobData,
  type AuthMailPayload,
  AuthMailPayloadSchema,
  type BookingConfirmationEmailInput,
  BookingConfirmationEmailInputSchema,
  type BookingMailJobData,
  BookingMailJobDataSchema,
  type MailJobData,
  MailJobDataSchema,
  MailJobKind,
  NotificationMailJobDataSchema,
} from "@metastorage/contracts/mail";
import type { notificationOutbox } from "@metastorage/database";
import {
  decryptMailPayload,
  encryptMailPayload,
  MAIL_DELIVERY_TTL_SECONDS,
  BOOKING_EMAIL_MESSAGES as m,
  mailJobId,
} from "@metastorage/shared/mail";
import type { Queue } from "bullmq";
import { UnrecoverableError } from "bullmq";
import { AUTH_MAIL_MESSAGES } from "../../mail/auth-mail.messages";
import { renderBookingConfirmationMail } from "../../mail/booking-mail.template";
import { escapeMailHtml, renderLifecycleMail } from "../../mail/lifecycle-mail.template";
import type { OutboxRepository } from "../notifications/outbox.repository";
import type { MailAdapter } from "./mail.types";

type MailRow = typeof notificationOutbox.$inferSelect;
interface MailOptions {
  queue: Queue<MailJobData>;
  secret: string;
  qrTokenSecret: string;
  publicAppUrl: string;
}

export class MailService {
  constructor(
    private readonly repository: OutboxRepository,
    private readonly options: MailOptions,
  ) {}

  async enqueue(row: MailRow, now: Date) {
    const referenceId = row.reservationId ?? row.bookingId;
    if (row.bookingEmail?.kind === "TRACKING_LINK") return { status: "SUPPRESSED" as const };
    if (row.bookingEmail && !referenceId) throw new Error("Missing reservation mail reference");
    const jobId =
      row.bookingEmail && referenceId ? mailJobId(referenceId) : `notification-${row.id}`;
    const job = await this.options.queue.getJob(jobId);
    if (job) {
      const state = await job.getState();
      if (state === "completed")
        return {
          status: "SENT" as const,
          providerMessageId: job.returnvalue?.providerMessageId as string | undefined,
        };
      if (state === "failed") return { status: "REVIEW_REQUIRED" as const };
    }
    if (row.bookingEmail) return this.enqueueBooking(row, now, Boolean(job));
    if (!job) {
      await this.options.queue.add(
        "notification",
        NotificationMailJobDataSchema.parse({ kind: MailJobKind.NOTIFICATION, outboxId: row.id }),
        {
          jobId,
          attempts: 5,
          backoff: { type: "exponential", delay: 5000 },
          removeOnComplete: { age: MAIL_DELIVERY_TTL_SECONDS },
          removeOnFail: { age: MAIL_DELIVERY_TTL_SECONDS },
        },
      );
    }
    return { status: "ENQUEUED" as const };
  }

  private async enqueueBooking(row: MailRow, now: Date, jobExists: boolean) {
    const snapshot = row.bookingEmail;
    if (!snapshot) throw new Error("Missing booking mail snapshot");
    if (snapshot.kind === "TRACKING_LINK") return { status: "SUPPRESSED" as const };
    const referenceId = row.reservationId ?? row.bookingId;
    if (!referenceId) throw new Error("Missing reservation mail reference");
    const deliveryId = snapshot.deliveryId ?? referenceId;
    const jobId = mailJobId(referenceId);
    if (row.firstAttemptAt && now.getTime() - row.firstAttemptAt.getTime() >= 24 * 3600000 - 60000)
      return { status: "REVIEW_REQUIRED" as const };
    const expiresAt = new Date(
      Math.min(
        Date.parse(snapshot.linkExpiresAt ?? "9999-12-31T23:59:59.999Z"),
        new Date(snapshot.linkCreatedAt ?? snapshot.paidAt).getTime() +
          MAIL_DELIVERY_TTL_SECONDS * 1000,
        row.mailExpiresAt?.getTime() ?? Number.POSITIVE_INFINITY,
      ),
    );
    if (expiresAt <= now)
      return {
        status: row.firstAttemptAt ? ("REVIEW_REQUIRED" as const) : ("SUPPRESSED" as const),
      };
    if (jobExists) return { status: "ENQUEUED" as const };
    if (!row.mailPayload) {
      const trackingUrl = new URL(
        `/customer/reservations/${referenceId}`,
        this.options.publicAppUrl,
      ).href;
      const payload = encryptMailPayload(
        JSON.stringify({
          deliveryId,
          recipientEmail: row.recipientEmail,
          bookingCode: snapshot.bookingCode,
          facilityName: snapshot.facilityName,
          unitTypeName: snapshot.unitTypeName,
          trackingUrl,
          qrUrl: row.reservationId
            ? trackingUrl
            : `${new URL("/check-in", this.options.publicAppUrl)}?token=${createHmac("sha256", this.options.qrTokenSecret).update(referenceId).digest("hex")}`,
        }),
        this.options.secret,
        deliveryId,
      );
      row = await this.repository.bookingPayload(row, payload, expiresAt);
    }
    await this.options.queue.add(
      "booking-confirmation",
      BookingMailJobDataSchema.parse({
        deliveryId,
        kind: MailJobKind.BOOKING_CONFIRMATION,
        payload: row.mailPayload as string,
        expiresAt: expiresAt.toISOString(),
      }),
      {
        jobId,
        attempts: 5,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { age: MAIL_DELIVERY_TTL_SECONDS },
        removeOnFail: { age: MAIL_DELIVERY_TTL_SECONDS },
      },
    );
    return { status: "ENQUEUED" as const };
  }

  async deliver(input: unknown, adapter: MailAdapter) {
    const parsed = MailJobDataSchema.safeParse(input);
    if (!parsed.success) throw new UnrecoverableError(m.sendFailed);
    const data = parsed.data;
    switch (data.kind) {
      case MailJobKind.VERIFY_EMAIL:
      case MailJobKind.RESET_PASSWORD:
        return this.deliverAuth(data, adapter);
      case MailJobKind.NOTIFICATION: {
        const result = await this.repository.beginNotification(data.outboxId, new Date());
        if (result.kind === "DONE") return { providerMessageId: result.providerMessageId };
        if (result.kind === "STOP") return;
        const row = result.row;
        if (!(await this.repository.authorized(row, new Date()))) {
          await this.repository.finish(row, "SUPPRESSED", new Date());
          return;
        }
        // Keep the lease while BullMQ retries. A failed job is reviewed by dispatch.
        const sent = await adapter.send({
          deliveryId: `notification-${row.id}`,
          recipientEmail: row.recipientEmail,
          subject: row.subject,
          text: row.body,
          html: renderLifecycleMail(row.eventType, row.subject, row.body),
        });
        await this.repository.finish(row, "SENT", new Date(), sent.providerMessageId);
        return sent;
      }
      case MailJobKind.BOOKING_CONFIRMATION:
        return this.deliverBooking(data, adapter);
      default:
        throw new UnrecoverableError(m.sendFailed);
    }
  }

  private async deliverAuth(data: AuthMailJobData, adapter: MailAdapter) {
    if (!(Date.parse(data.expiresAt) > Date.now()))
      throw new UnrecoverableError("Auth mail expired before worker delivery");
    let input: AuthMailPayload;
    try {
      input = AuthMailPayloadSchema.parse(
        JSON.parse(decryptMailPayload(data.payload, this.options.secret, data.deliveryId)),
      );
      if (
        input.kind !== data.kind ||
        input.deliveryId !== data.deliveryId ||
        input.expiresAt !== data.expiresAt
      )
        throw new Error("Auth mail envelope mismatch");
    } catch {
      throw new UnrecoverableError(
        "Auth mail payload could not be decrypted or validated; check API and worker BOOKING_MAGIC_LINK_SECRET consistency",
      );
    }
    const messages = AUTH_MAIL_MESSAGES[input.kind];
    return adapter.send({
      deliveryId: data.deliveryId,
      recipientEmail: input.recipientEmail,
      subject: messages.subject,
      html: messages.html(escapeMailHtml(input.name), escapeMailHtml(input.url)),
      text: messages.text(input.name, input.url),
    });
  }

  private async deliverBooking(data: BookingMailJobData, adapter: MailAdapter) {
    let input: BookingConfirmationEmailInput;
    try {
      input = BookingConfirmationEmailInputSchema.parse(
        JSON.parse(decryptMailPayload(data.payload, this.options.secret, data.deliveryId)),
      );
      if (input.deliveryId !== data.deliveryId) throw new Error("Mail delivery mismatch");
    } catch {
      throw new UnrecoverableError(m.sendFailed);
    }

    const frozen = await this.repository.bookingDeliveryPayload(data.deliveryId);
    let payload = data.payload;
    // A legacy API replica may have enqueued the same content with another IV.
    // Accept equivalent authenticated plaintext; never replace the frozen payload
    // or accept a different recipient/link under the same provider delivery ID.
    if (
      frozen &&
      frozen !== payload &&
      decryptMailPayload(frozen, this.options.secret, data.deliveryId) ===
        decryptMailPayload(payload, this.options.secret, data.deliveryId)
    )
      payload = frozen;
    const result = await this.repository.beginBooking(
      data.deliveryId,
      payload,
      new Date(data.expiresAt),
      new Date(),
    );
    if (result.kind === "STOP") throw new UnrecoverableError(m.sendFailed);
    if (result.kind === "DONE") return { providerMessageId: result.providerMessageId };
    if (!(Date.parse(data.expiresAt) > Date.now())) throw new UnrecoverableError(m.accessExpired);
    const sent = await adapter.send(renderBookingConfirmationMail(input));
    if (result.kind === "SEND")
      await this.repository.bookingSent(result.id, sent.providerMessageId, new Date());
    return sent;
  }
}
