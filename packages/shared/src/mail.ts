import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export { BOOKING_EMAIL_MESSAGES } from "./mail.messages";
export type { BookingConfirmationEmailInput, MailJobData } from "./mail.types";

export const MAIL_QUEUE_NAME = "mail";
export const mailJobId = (bookingId: string) => `booking-confirmation-${bookingId}`;

// Transport encryption shared by API producer and worker consumer, bound to delivery ID.
export function encryptMailPayload(payload: string, secret: string, deliveryId: string): string {
  const key = createHash("sha256").update(`mail-payload:${secret}`).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(deliveryId));
  const ciphertext = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((value) => value.toString("base64")).join(".");
}

export function decryptMailPayload(payload: string, secret: string, deliveryId: string): string {
  const [iv = "", tag = "", ciphertext = ""] = payload.split(".");
  const key = createHash("sha256").update(`mail-payload:${secret}`).digest();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  decipher.setAAD(Buffer.from(deliveryId));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
