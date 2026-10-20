import { createHmac } from "node:crypto";
import { BOOKING_ACCESS, createBookingTrackingLink } from "@metastorage/shared/booking-access";
import {
  decryptMailPayload,
  encryptMailPayload,
  type MailJobData,
  BOOKING_EMAIL_MESSAGES as m,
  mailJobId,
  trackingLinkMailJobId,
} from "@metastorage/shared/mail";
import { UnrecoverableError } from "bullmq";
import { processMailJob } from "../mail/mail.job";
import type { MailAdapter } from "../mail/mail.types";
import type { BookingMailOptions, BookingMailRow } from "./booking-mail.types";
import type { OutboxRepository } from "./outbox.repository";

export class BookingMailService {
  constructor(
    private readonly repository: OutboxRepository,
    private readonly options: BookingMailOptions,
  ) {}

  async enqueue(row: BookingMailRow, now: Date) {
    const snapshot = row.bookingEmail;
    if (!snapshot) throw new Error("Missing booking mail snapshot");
    const trackingLink = snapshot.kind === "TRACKING_LINK";
    const deliveryId = snapshot.deliveryId ?? row.bookingId;
    const jobId = trackingLink ? trackingLinkMailJobId(deliveryId) : mailJobId(row.bookingId);
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
    if (row.firstAttemptAt && now.getTime() - row.firstAttemptAt.getTime() >= 24 * 3600000 - 60000)
      return { status: "REVIEW_REQUIRED" as const };
    const expiresAt = new Date(
      Math.min(
        Date.parse(snapshot.linkExpiresAt ?? "9999-12-31T23:59:59.999Z"),
        new Date(snapshot.linkCreatedAt ?? snapshot.paidAt).getTime() +
          BOOKING_ACCESS.magicTtl * 1000,
        row.mailExpiresAt?.getTime() ?? Number.POSITIVE_INFINITY,
      ),
    );
    if (expiresAt <= now)
      return {
        status: row.firstAttemptAt ? ("REVIEW_REQUIRED" as const) : ("SUPPRESSED" as const),
      };
    if (job) return { status: "ENQUEUED" as const };
    if (!row.mailPayload) {
      const link = await createBookingTrackingLink(this.options.redis, {
        deliveryId,
        bookingId: row.bookingId,
        confirmedAt: new Date(snapshot.linkCreatedAt ?? snapshot.paidAt),
        secret: this.options.secret,
        publicAppUrl: this.options.publicAppUrl,
        replaceExisting: trackingLink,
      });
      if (
        trackingLink &&
        (!snapshot.bookingCode ||
          !snapshot.deliveryId ||
          !snapshot.linkCreatedAt ||
          !snapshot.linkExpiresAt)
      )
        throw new UnrecoverableError(m.sendFailed);
      const payload = encryptMailPayload(
        JSON.stringify(
          trackingLink
            ? {
                deliveryId,
                recipientEmail: row.recipientEmail,
                bookingCode: snapshot.bookingCode,
                trackingUrl: link.trackingUrl,
                expiresAt: snapshot.linkExpiresAt,
              }
            : {
                deliveryId,
                recipientEmail: row.recipientEmail,
                bookingCode: snapshot.bookingCode,
                facilityName: snapshot.facilityName,
                unitTypeName: snapshot.unitTypeName,
                trackingUrl: link.trackingUrl,
                qrUrl: `${new URL("/check-in", this.options.publicAppUrl)}?token=${createHmac("sha256", this.options.qrTokenSecret).update(row.bookingId).digest("hex")}`,
              },
        ),
        this.options.secret,
        deliveryId,
      );
      row = await this.repository.bookingPayload(row, payload, expiresAt);
    }
    await this.options.queue.add(
      trackingLink ? "booking-tracking-link" : "booking-confirmation",
      {
        deliveryId,
        kind: trackingLink ? "BOOKING_TRACKING_LINK" : "BOOKING_CONFIRMATION",
        payload: row.mailPayload as string,
        expiresAt: expiresAt.toISOString(),
      },
      {
        jobId,
        attempts: 5,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { age: BOOKING_ACCESS.magicTtl },
        removeOnFail: { age: BOOKING_ACCESS.magicTtl },
      },
    );
    return { status: "ENQUEUED" as const };
  }

  async deliver(data: MailJobData, adapter: MailAdapter) {
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
    const sent = await processMailJob(data, adapter, this.options.secret);
    if (result.kind === "SEND")
      await this.repository.bookingSent(result.id, sent.providerMessageId, new Date());
    return sent;
  }
}
