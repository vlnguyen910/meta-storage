import type { MailAdapter } from "../mail/mail.types";
import type { BookingMailService } from "./booking-mail.service";
import type { OutboxRepository } from "./outbox.repository";

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char,
  );

export class OutboxService {
  constructor(
    private readonly repository: OutboxRepository,
    private readonly mail: MailAdapter,
    private readonly bookingMail?: BookingMailService,
  ) {}
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
        if (row.bookingEmail) {
          if (!this.bookingMail) throw new Error("Booking mail dispatcher is required");
          const result = await this.bookingMail.enqueue(row, attemptAt);
          await this.repository.finish(
            row,
            result.status,
            attemptAt,
            "providerMessageId" in result ? result.providerMessageId : undefined,
          );
          continue;
        }
        const sent = await this.mail.send({
          deliveryId: `notification-${row.id}`,
          recipientEmail: row.recipientEmail,
          subject: row.subject,
          text: row.body,
          html: `<p>${escapeHtml(row.body).replace(/\n/g, "<br>")}</p>`,
        });
        await this.repository.finish(row, "SENT", attemptAt, sent.providerMessageId);
      } catch {
        await this.repository.finish(row, "PENDING", attemptAt);
      }
    }
    return { processed };
  }
}
