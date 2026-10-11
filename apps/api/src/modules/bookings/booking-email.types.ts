export interface BookingEmailConfiguration {
  publicAppUrl: string;
  magicLinkSecret: string;
  qrTokenSecret: string;
  onEnqueueFailure?: (bookingId: string) => void;
}
