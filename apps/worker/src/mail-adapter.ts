import type { BookingConfirmationEmailInput, MailAdapter } from "./mail-adapter.types";

export type { BookingConfirmationEmailInput, MailAdapter } from "./mail-adapter.types";
export class MockMailAdapter implements MailAdapter {
  async sendBookingConfirmation(input: BookingConfirmationEmailInput) {
    console.log(`[mock-mail] booking confirmation delivery ${input.deliveryId}`);
    return { providerMessageId: `mock_${input.deliveryId}` };
  }
}
