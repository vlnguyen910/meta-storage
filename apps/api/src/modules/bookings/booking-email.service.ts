import { createHmac } from "node:crypto";
import type { BookingConfirmation } from "@metastorage/contracts";
import { BOOKING_ACCESS } from "@metastorage/shared/booking-access";
import {
  type BookingConfirmationEmailInput,
  encryptMailPayload,
  type MailJobData,
  mailJobId,
} from "@metastorage/shared/mail";
import type { Queue } from "bullmq";
import type Redis from "ioredis";
import type { BookingEmailConfiguration } from "./booking-email.types";
import { createBookingTrackingLink } from "./booking-tracking-link";
import type { BookingReadRecord } from "./bookings.types";

export class BookingEmailService {
  constructor(
    private readonly redis: Redis,
    private readonly queue: Queue<MailJobData>,
    private readonly config: BookingEmailConfiguration,
  ) {}

  async getStatus(bookingId: string): Promise<BookingConfirmation["emailStatus"]> {
    try {
      const job = await this.queue.getJob(mailJobId(bookingId));
      if (!job) return "FAILED";
      const state = await job.getState();
      return state === "completed" ? "SENT" : state === "failed" ? "FAILED" : "QUEUED";
    } catch {
      return "PENDING";
    }
  }

  async enqueueConfirmation(
    booking: Pick<BookingReadRecord, "id" | "paidAt" | "contactEmail" | "bookingCode">,
    confirmation: Pick<BookingConfirmation, "facility" | "unitTypeName">,
  ): Promise<BookingConfirmation["emailStatus"]> {
    try {
      const jobId = mailJobId(booking.id);
      if (await this.queue.getJob(jobId)) return this.getStatus(booking.id);
      if (
        !booking.paidAt ||
        booking.paidAt.getTime() + BOOKING_ACCESS.magicTtl * 1000 <= Date.now()
      )
        return "FAILED";
      const link = await createBookingTrackingLink(this.redis, {
        deliveryId: booking.id,
        bookingId: booking.id,
        secret: this.config.magicLinkSecret,
        publicAppUrl: this.config.publicAppUrl,
        confirmedAt: booking.paidAt,
      });
      const input: BookingConfirmationEmailInput = {
        deliveryId: booking.id,
        recipientEmail: booking.contactEmail,
        bookingCode: booking.bookingCode,
        facilityName: confirmation.facility.name,
        unitTypeName: confirmation.unitTypeName,
        trackingUrl: link.trackingUrl,
        qrUrl: `${new URL("/check-in", this.config.publicAppUrl)}?token=${createHmac("sha256", this.config.qrTokenSecret).update(booking.id).digest("hex")}`,
      };
      await this.queue.add(
        "booking-confirmation",
        {
          deliveryId: booking.id,
          kind: "BOOKING_CONFIRMATION",
          payload: encryptMailPayload(
            JSON.stringify(input),
            this.config.magicLinkSecret,
            booking.id,
          ),
          expiresAt: link.expiresAt,
        },
        {
          jobId,
          attempts: 5,
          backoff: { type: "exponential", delay: 5000 },
          // Retain IDs through the link lifetime so payment replay cannot enqueue duplicates.
          removeOnComplete: { age: BOOKING_ACCESS.magicTtl },
          removeOnFail: { age: BOOKING_ACCESS.magicTtl },
        },
      );
      return "QUEUED";
    } catch {
      this.config.onEnqueueFailure?.(booking.id);
      return "FAILED";
    }
  }
}
