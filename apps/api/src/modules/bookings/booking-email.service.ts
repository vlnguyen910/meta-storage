import { createHmac } from "node:crypto";
import { BOOKING_ACCESS } from "@metastorage/shared/booking-access";
import {
  BOOKING_EMAIL_MESSAGES,
  type BookingConfirmationEmailInput,
  encryptMailPayload,
} from "@metastorage/shared/mail";
import type Redis from "ioredis";
import type { BookingEmailRepository } from "./booking-email.repository";
import type { BookingEmailConfiguration } from "./booking-email.types";
import { createBookingTrackingLink } from "./booking-tracking-link";

export class BookingEmailService {
  constructor(
    private readonly repository: BookingEmailRepository,
    private readonly redis: Redis,
    private readonly config: BookingEmailConfiguration,
  ) {}

  async preparePendingConfirmations() {
    const candidates = await this.repository.findPendingPreparation();
    for (const row of candidates) {
      const expiresAt = new Date(row.email.createdAt.getTime() + BOOKING_ACCESS.magicTtl * 1000);
      if (expiresAt.getTime() <= Date.now()) {
        await this.repository.savePreparation(row.email.id, {
          status: "FAILED",
          lastError: BOOKING_EMAIL_MESSAGES.accessExpired,
          expiresAt,
        });
        continue;
      }
      try {
        const link = await createBookingTrackingLink(this.redis, {
          deliveryId: row.email.id,
          bookingId: row.email.bookingId,
          secret: this.config.magicLinkSecret,
          publicAppUrl: this.config.publicAppUrl,
          confirmedAt: row.email.createdAt,
        });
        const input: BookingConfirmationEmailInput = {
          deliveryId: row.email.id,
          recipientEmail: row.email.recipientEmail,
          bookingCode: row.bookingCode,
          facilityName: row.facilityName,
          unitTypeName: row.unitTypeName,
          trackingUrl: link.trackingUrl,
          qrUrl: `${new URL("/check-in", this.config.publicAppUrl)}?token=${createHmac("sha256", this.config.qrTokenSecret).update(row.email.bookingId).digest("hex")}`,
        };
        await this.repository.savePreparation(row.email.id, {
          payload: encryptMailPayload(
            JSON.stringify(input),
            this.config.magicLinkSecret,
            row.email.id,
          ),
          expiresAt: new Date(link.expiresAt),
          lastError: null,
        });
      } catch {
        // Pending requests survive Redis/configuration failures; no payment rollback.
        await this.repository.savePreparation(row.email.id, {
          lastError: BOOKING_EMAIL_MESSAGES.preparationFailed,
        });
      }
    }
  }
}
