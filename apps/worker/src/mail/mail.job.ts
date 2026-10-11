import {
  BOOKING_EMAIL_MESSAGES,
  type BookingConfirmationEmailInput,
  decryptMailPayload,
  type MailJobData,
} from "@metastorage/shared/mail";
import { UnrecoverableError } from "bullmq";
import { sendBookingConfirmationEmail } from "./mail.service";
import type { MailAdapter } from "./mail.types";

export async function processMailJob(data: MailJobData, adapter: MailAdapter, secret: string) {
  if (data.kind !== "BOOKING_CONFIRMATION" || !(Date.parse(data.expiresAt) > Date.now()))
    throw new UnrecoverableError(BOOKING_EMAIL_MESSAGES.accessExpired);
  let input: BookingConfirmationEmailInput;
  try {
    input = JSON.parse(
      decryptMailPayload(data.payload, secret, data.deliveryId),
    ) as BookingConfirmationEmailInput;
    if (input.deliveryId !== data.deliveryId) throw new Error("Delivery mismatch");
  } catch {
    throw new UnrecoverableError(BOOKING_EMAIL_MESSAGES.sendFailed);
  }
  return sendBookingConfirmationEmail(adapter, input);
}
