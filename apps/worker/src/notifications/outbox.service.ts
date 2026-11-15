import {
  LIFECYCLE_MAIL_MESSAGES,
  LIFECYCLE_MAIL_TEMPLATES,
} from "../../mail/lifecycle-mail.messages";
import type { MailService } from "../mail/mail.service";
import type { OutboxRepository } from "./outbox.repository";

export class OutboxService {
  constructor(
    private readonly repository: OutboxRepository,
    private readonly mail: MailService,
  ) {}
  async remindExpiringRentals(now = new Date()) {
    const candidates = await this.repository.findExpiringRentals(now);
    if (!candidates.length) return;
    await this.repository.insertExpiryReminders(
      candidates.map(({ rental, email, facilityId }) => ({
        eventKey: `rental:${rental.id}:expiry:${rental.endAt.toISOString()}`,
        recipientKey: `user:${rental.userId}`,
        eventType: "UPCOMING_EXPIRY" as const,
        bookingId: rental.bookingId,
        reservationId: rental.reservationId,
        facilityId,
        recipientUserId: rental.userId,
        recipientRole: "CUSTOMER",
        recipientEmail: email,
        subject: LIFECYCLE_MAIL_TEMPLATES.UPCOMING_EXPIRY.title,
        body: LIFECYCLE_MAIL_MESSAGES.expiryBody(rental.id, rental.endAt),
        occurredAt: now,
        nextAttemptAt: now,
      })),
    );
  }
  async dispatch(now?: Date, facilityId?: string, limit = 10) {
    let processed = 0;
    for (; processed < limit; processed++) {
      const attemptAt = now ?? new Date();
      const row = await this.repository.claim(attemptAt, facilityId);
      if (!row) break;
      if ("reviewRequired" in row) continue;
      if (!(await this.repository.authorized(row, attemptAt))) {
        await this.repository.finish(row, "SUPPRESSED", attemptAt);
        continue;
      }
      try {
        const result = await this.mail.enqueue(row, attemptAt);
        await this.repository.finish(
          row,
          result.status,
          attemptAt,
          "providerMessageId" in result ? result.providerMessageId : undefined,
        );
      } catch {
        await this.repository.finish(row, "PENDING", attemptAt);
      }
    }
    return { processed };
  }
}
