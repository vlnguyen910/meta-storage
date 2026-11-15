import { describe, expect, test } from "vitest";
import {
  AuthMailInputSchema,
  AuthMailPayloadSchema,
  BookingConfirmationEmailInputSchema,
  MailJobDataSchema,
  MailJobKind,
} from "../src/mail";

const envelope = {
  deliveryId: "delivery-1",
  payload: "encrypted-payload",
  expiresAt: "2026-12-01T00:00:00.000Z",
};
const authInput = {
  kind: MailJobKind.VERIFY_EMAIL,
  recipientEmail: "customer@example.test",
  name: "Customer",
  url: "https://example.test/verify?token=private",
};

describe("mail contracts", () => {
  test.each([
    MailJobKind.BOOKING_CONFIRMATION,
    MailJobKind.BOOKING_TRACKING_LINK,
    MailJobKind.VERIFY_EMAIL,
    MailJobKind.RESET_PASSWORD,
  ])("accepts the existing encrypted wire format for %s", (kind) => {
    const job = { ...envelope, kind };
    expect(MailJobDataSchema.parse(job)).toEqual(job);
  });
  test("notification jobs carry a durable UUID reference", () => {
    const job = {
      kind: MailJobKind.NOTIFICATION,
      outboxId: "11111111-1111-4111-8111-111111111111",
    };
    expect(MailJobDataSchema.parse(job)).toEqual(job);
    expect(
      MailJobDataSchema.safeParse({ ...job, outboxId: "------------------------------------" })
        .success,
    ).toBe(false);
  });
  test.each([
    null,
    { ...envelope, kind: "UNKNOWN" },
    { ...envelope, kind: MailJobKind.VERIFY_EMAIL, expiresAt: "invalid" },
    { ...envelope, kind: MailJobKind.RESET_PASSWORD, payload: "" },
    { kind: MailJobKind.NOTIFICATION, ...envelope },
    { kind: MailJobKind.BOOKING_CONFIRMATION, outboxId: "11111111-1111-4111-8111-111111111111" },
  ])("rejects an invalid job envelope %#", (job) => {
    expect(MailJobDataSchema.safeParse(job).success).toBe(false);
  });
  test.each(["javascript:alert(1)", "file:///tmp/token", "not-a-url"])(
    "rejects unsafe account link %s",
    (url) => {
      expect(AuthMailInputSchema.safeParse({ ...authInput, url }).success).toBe(false);
    },
  );
  test("validates decrypted payload fields and notification-specific data", () => {
    expect(
      AuthMailPayloadSchema.safeParse({
        ...authInput,
        deliveryId: envelope.deliveryId,
        expiresAt: envelope.expiresAt,
      }).success,
    ).toBe(true);
    expect(AuthMailInputSchema.safeParse({ ...authInput, recipientEmail: "invalid" }).success).toBe(
      false,
    );
    expect(
      AuthMailInputSchema.safeParse({ ...authInput, kind: MailJobKind.NOTIFICATION }).success,
    ).toBe(false);
    expect(
      BookingConfirmationEmailInputSchema.safeParse({
        deliveryId: "booking",
        recipientEmail: "customer@example.test",
        bookingCode: null,
        facilityName: "Facility",
        unitTypeName: "Unit",
        trackingUrl: "https://example.test/reservation",
        qrUrl: "https://example.test/check-in",
      }).success,
    ).toBe(true);
    expect(
      BookingConfirmationEmailInputSchema.safeParse({ ...authInput, deliveryId: "booking" })
        .success,
    ).toBe(false);
  });
});
