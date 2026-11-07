import {
  BOOKING_EMAIL_MESSAGES,
  type BookingConfirmationEmailInput,
  type BookingTrackingLinkEmailInput,
  decryptMailPayload,
  type MailJobData,
} from "@metastorage/shared/mail";
import { UnrecoverableError } from "bullmq";
import { sendBookingConfirmationEmail, sendBookingTrackingLinkEmail } from "./mail.service";
import type { MailAdapter } from "./mail.types";

export async function processMailJob(data: MailJobData, adapter: MailAdapter, secret: string) {
  if (!(Date.parse(data.expiresAt) > Date.now()))
    throw new UnrecoverableError(BOOKING_EMAIL_MESSAGES.accessExpired);
  let input: BookingConfirmationEmailInput | BookingTrackingLinkEmailInput;
  try {
    input = JSON.parse(decryptMailPayload(data.payload, secret, data.deliveryId)) as
      | BookingConfirmationEmailInput
      | BookingTrackingLinkEmailInput;
    if (input.deliveryId !== data.deliveryId) throw new Error("Delivery mismatch");
  } catch {
    throw new UnrecoverableError(BOOKING_EMAIL_MESSAGES.sendFailed);
  }
  if (data.kind === "BOOKING_CONFIRMATION") {
    if (!("facilityName" in input)) throw new UnrecoverableError(BOOKING_EMAIL_MESSAGES.sendFailed);
    return sendBookingConfirmationEmail(adapter, input);
  }
  if (!("expiresAt" in input)) throw new UnrecoverableError(BOOKING_EMAIL_MESSAGES.sendFailed);
  return sendBookingTrackingLinkEmail(adapter, input);
}
