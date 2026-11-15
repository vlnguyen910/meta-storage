import type { BookingConfirmationEmailInput } from "@metastorage/contracts/mail";
import { BOOKING_MAIL_MESSAGES as m } from "./booking-mail.messages";
import { escapeMailHtml as escapeHtml } from "./lifecycle-mail.template";

export function renderBookingConfirmationMail(input: BookingConfirmationEmailInput) {
  return {
    deliveryId: input.deliveryId,
    recipientEmail: input.recipientEmail,
    subject: m.subject(input.bookingCode),
    html: `<h1>${m.title}</h1><p>${m.booking}: ${escapeHtml(input.bookingCode ?? "")}</p><p>${m.facility}: ${escapeHtml(input.facilityName)}</p><p>${m.unitType}: ${escapeHtml(input.unitTypeName)}</p><p><a href="${escapeHtml(input.trackingUrl)}">${m.tracking}</a></p><p>${m.trackingHint}</p><p><a href="${escapeHtml(input.qrUrl)}">${m.checkIn}</a></p>`,
    text: `${m.title}\n${m.booking}: ${input.bookingCode ?? ""}\n${m.facility}: ${input.facilityName}\n${m.unitType}: ${input.unitTypeName}\n${m.tracking}: ${input.trackingUrl}\n${m.trackingHint}\n${m.checkIn}: ${input.qrUrl}`,
  };
}
