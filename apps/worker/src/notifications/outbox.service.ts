import type { MailAdapter } from "../mail/mail.types";
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
