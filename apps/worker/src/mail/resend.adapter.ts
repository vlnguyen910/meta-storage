import type { MailAdapter, MailMessage, ResendMailAdapterOptions } from "./mail.types";

function safeErrorMessage(value: unknown) {
  if (typeof value !== "string") return undefined;
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/https?:\/\/\S+/gi, "[url]")
    .slice(0, 300);
}

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
      const body = (await response.json().catch(() => null)) as {
        id?: string;
        name?: string;
        message?: string;
        error?: string;
      } | null;
      if (!response.ok) {
        const providerError = safeErrorMessage(body?.message ?? body?.error ?? body?.name);
        throw new Error(
          `Resend API rejected email (HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""})${providerError ? `: ${providerError}` : ""}`,
        );
      }
      if (!body?.id) throw new Error("Resend API response did not include a message ID");
      return { providerMessageId: body.id };
    } catch (error) {
      const message = error instanceof Error ? safeErrorMessage(error.message) : undefined;
      throw new Error(message ?? "Resend request failed without a readable error");
    }
  }
}
