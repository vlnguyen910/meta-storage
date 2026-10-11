export interface BookingConfirmationEmailInput {
  deliveryId: string;
  trackingUrl: string;
  recipientEmail: string;
  bookingCode: string | null;
  facilityName: string;
  unitTypeName: string;
  qrUrl: string;
}

export interface ResendMailAdapterOptions {
  apiKey: string;
  fromEmail: string;
  fetcher?: (url: string, options: RequestInit) => Promise<Response>;
}

export interface MailAdapter {
  sendBookingConfirmation(input: BookingConfirmationEmailInput): Promise<{
    providerMessageId: string;
  }>;
}
