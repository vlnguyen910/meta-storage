import { BOOKING_EMAIL_MESSAGES as m } from "@metastorage/shared/mail";
import type { MailAdapter, MailMessage, ResendMailAdapterOptions } from "./mail.types";
export class ResendMailAdapter implements MailAdapter {
  constructor(private readonly options: ResendMailAdapterOptions) {}
  async send(input: MailMessage): Promise<{ providerMessageId: string }> {
    try {
      const response = await (this.options.fetcher ?? fetch)("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `booking-confirmation/${input.deliveryId}`,
        },
        signal: AbortSignal.timeout(10_000),
        body: JSON.stringify({
          from: this.options.fromEmail,
          to: [input.recipientEmail],
          subject: input.subject,
          html: input.html,
          text: input.text,
        }),
      });
      if (!response.ok) throw new Error(m.sendFailed);
      const body = (await response.json()) as { id?: string };
      if (!body.id) throw new Error(m.sendFailed);
      return { providerMessageId: body.id };
    } catch {
      throw new Error(m.sendFailed);
    }
  }
}
