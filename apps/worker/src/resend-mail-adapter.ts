import { BOOKING_EMAIL_MESSAGES as m } from "./booking-email.messages";
import type {
  BookingConfirmationEmailInput,
  MailAdapter,
  ResendMailAdapterOptions,
} from "./mail-adapter.types";

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char,
  );
export class ResendMailAdapter implements MailAdapter {
  constructor(private readonly options: ResendMailAdapterOptions) {}
  async sendBookingConfirmation(
    input: BookingConfirmationEmailInput,
  ): Promise<{ providerMessageId: string }> {
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
          subject: m.subject(input.bookingCode),
          html: `<h1>${m.title}</h1><p>${m.booking}: ${escapeHtml(input.bookingCode ?? "")}</p><p>${m.facility}: ${escapeHtml(input.facilityName)}</p><p>${m.unitType}: ${escapeHtml(input.unitTypeName)}</p><p><a href="${escapeHtml(input.trackingUrl)}">${m.tracking}</a></p><p>${m.trackingHint}</p><p><a href="${escapeHtml(input.qrUrl)}">${m.checkIn}</a></p>`,
          text: `${m.title}\n${m.booking}: ${input.bookingCode ?? ""}\n${m.facility}: ${input.facilityName}\n${m.unitType}: ${input.unitTypeName}\n${m.tracking}: ${input.trackingUrl}\n${m.trackingHint}\n${m.checkIn}: ${input.qrUrl}`,
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
