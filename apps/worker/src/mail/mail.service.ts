import {
  type BookingConfirmationEmailInput,
  type BookingTrackingLinkEmailInput,
  BOOKING_EMAIL_MESSAGES as m,
} from "@metastorage/shared/mail";
import type { MailAdapter } from "./mail.types";

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char,
  );

export async function sendBookingConfirmationEmail(
  adapter: MailAdapter,
  input: BookingConfirmationEmailInput,
) {
  return adapter.send({
    deliveryId: input.deliveryId,
    recipientEmail: input.recipientEmail,
    subject: m.subject(input.bookingCode),
    html: `<h1>${m.title}</h1><p>${m.booking}: ${escapeHtml(input.bookingCode ?? "")}</p><p>${m.facility}: ${escapeHtml(input.facilityName)}</p><p>${m.unitType}: ${escapeHtml(input.unitTypeName)}</p><p><a href="${escapeHtml(input.trackingUrl)}">${m.tracking}</a></p><p>${m.trackingHint}</p><p><a href="${escapeHtml(input.qrUrl)}">${m.checkIn}</a></p>`,
    text: `${m.title}\n${m.booking}: ${input.bookingCode ?? ""}\n${m.facility}: ${input.facilityName}\n${m.unitType}: ${input.unitTypeName}\n${m.tracking}: ${input.trackingUrl}\n${m.trackingHint}\n${m.checkIn}: ${input.qrUrl}`,
  });
}

export async function sendBookingTrackingLinkEmail(
  adapter: MailAdapter,
  input: BookingTrackingLinkEmailInput,
) {
  return adapter.send({
    deliveryId: input.deliveryId,
    recipientEmail: input.recipientEmail,
    subject: m.trackingLinkSubject(input.bookingCode),
    html: `<h1>${m.trackingLinkTitle}</h1><p>${m.booking}: ${escapeHtml(input.bookingCode)}</p><p><a href="${escapeHtml(input.trackingUrl)}">${m.tracking}</a></p><p>${escapeHtml(m.trackingLinkHint(input.expiresAt))}</p>`,
    text: `${m.trackingLinkTitle}\n${m.booking}: ${input.bookingCode}\n${m.tracking}: ${input.trackingUrl}\n${m.trackingLinkHint(input.expiresAt)}`,
  });
}
