import { createHmac } from "node:crypto";
import { BOOKING_ACCESS } from "@metastorage/shared/booking-access";
import {
  decryptMailPayload,
  encryptMailPayload,
  type MailJobData,
  BOOKING_EMAIL_MESSAGES as m,
  mailJobId,
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
    if (snapshot.kind === "TRACKING_LINK") return { status: "SUPPRESSED" as const };
    const referenceId = row.reservationId ?? row.bookingId;
    if (!referenceId) throw new Error("Missing reservation mail reference");
    const deliveryId = snapshot.deliveryId ?? referenceId;
    const jobId = mailJobId(referenceId);
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
      {
        deliveryId,
        kind: "BOOKING_CONFIRMATION",
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
    if (data.kind === "BOOKING_TRACKING_LINK") throw new UnrecoverableError(m.sendFailed);
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
