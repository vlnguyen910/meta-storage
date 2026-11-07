import { expect, test } from "bun:test";
import type { PaymentStatusResponse } from "@metastorage/contracts";
import { appointment, id, unit } from "../e2e/customer-home.data";
import {
  gatewaySource,
  isBookingPayment,
  isGatewayReturn,
  isPaidReservation,
  paymentQrUrl,
  savedBookingSchema,
  unitAreaMatches,
} from "../src/common/booking.utils";

const saved = {
  facilityId: id(20),
  unitTypeId: id(30),
  checkInDate: "2026-11-07",
  checkInSlotId: id(50),
  durationMonths: 1,
  contactPhone: "0903000111",
  draftId: id(60),
  key: "a-stable-idempotency-key",
  paymentRequested: true,
  payment: {
    paymentId: id(90),
    reservationId: id(60),
    paymentCode: "MS1234",
    expiresAt: "2026-11-06T03:10:00.000Z",
  },
};

test("recovery accepts an uncertain request without a payment response but rejects mixed reservation IDs", () => {
  expect(savedBookingSchema.safeParse({ ...saved, payment: undefined }).success).toBe(true);
  expect(savedBookingSchema.safeParse(saved).success).toBe(true);
  expect(
    savedBookingSchema.safeParse({ ...saved, payment: { ...saved.payment, reservationId: id(99) } })
      .success,
  ).toBe(false);
});

test("a paid receipt needs canonical paid status and a confirmed reservation", () => {
  const record = appointment.reservation;
  if (!record) throw new Error("Missing reservation fixture");
  expect(isPaidReservation({ ...record, paymentStatus: "SUCCEEDED" })).toBe(true);
  expect(
    isPaidReservation({
      ...record,
      status: "DRAFT" as typeof record.status,
      paymentStatus: "SUCCEEDED",
    }),
  ).toBe(false);
  expect(isPaidReservation({ ...record, paymentStatus: "PENDING" })).toBe(false);
});

test("reconciliation rejects another payment, reservation or debt collection", () => {
  const response: PaymentStatusResponse = {
    type: "CHARGE",
    paymentId: id(90),
    reservationId: id(60),
    status: "SUCCEEDED",
    provider: "sepay",
    paymentCode: "MS1234",
  };
  expect(isBookingPayment(response, saved.payment)).toBe(true);
  expect(isBookingPayment({ ...response, paymentId: id(91) }, saved.payment)).toBe(false);
  expect(isBookingPayment({ ...response, reservationId: id(61) }, saved.payment)).toBe(false);
  expect(isBookingPayment({ ...response, type: "DEBT_COLLECTION" }, saved.payment)).toBe(false);
});

test("bank QR preserves exact amount and transfer content and never substitutes absent bank data", () => {
  const instructions = {
    paymentCode: "MS1234",
    bankName: "MB",
    accountNumber: "01234",
    accountName: "MetaStorage",
    amount: "2400000",
    currency: "VND",
    content: "MS1234 & ref",
    expiresAt: saved.payment.expiresAt,
  };
  const url = new URL(paymentQrUrl(instructions) ?? "");
  expect(url.origin).toBe("https://vietqr.app");
  expect(Object.fromEntries(url.searchParams)).toMatchObject({
    acc: "01234",
    bank: "MB",
    amount: "2400000",
    des: "MS1234 & ref",
  });
  for (const invalid of [
    { accountNumber: "" },
    { amount: "-1" },
    { amount: "2.5" },
    { currency: "USD" },
    { content: "" },
  ])
    expect(paymentQrUrl({ ...instructions, ...invalid })).toBeUndefined();
  expect(paymentQrUrl()).toBeUndefined();
});

test("checkout POST encodes signed fields literally and refuses insecure destinations", () => {
  const fields = {
    amount: 2400000,
    signature: "a+b/= &",
    success_url: `https://app.test/result?paymentId=${id(90)}`,
  };
  const source = gatewaySource("https://checkout.test/pay", fields);
  expect(source.method).toBe("POST");
  expect(new URLSearchParams(source.body).get("signature")).toBe(fields.signature);
  expect(() => gatewaySource("http://checkout.test/pay", fields)).toThrow();
});

test("a redirect match requires the configured origin, path and payment ID", () => {
  const fields = { success_url: `https://app.test/result?paymentId=${id(90)}` };
  expect(isGatewayReturn(`${fields.success_url}&status=success`, fields)).toBe(true);
  expect(isGatewayReturn(`https://other.test/result?paymentId=${id(90)}`, fields)).toBe(false);
  expect(isGatewayReturn(`https://app.test/elsewhere?paymentId=${id(90)}`, fields)).toBe(false);
  expect(isGatewayReturn(`https://app.test/result?paymentId=${id(91)}`, fields)).toBe(false);
  expect(
    isGatewayReturn("https://app.test/result", { success_url: "https://app.test/result" }),
  ).toBe(false);
});

test("area filters use real dimensions, including exact range boundaries", () => {
  expect(unitAreaMatches({ ...unit, lengthM: 3, widthM: 1 }, "medium")).toBe(true);
  expect(unitAreaMatches({ ...unit, lengthM: 3, widthM: 1 }, "small")).toBe(false);
  expect(unitAreaMatches({ ...unit, lengthM: 3, widthM: 2 }, "medium")).toBe(true);
  expect(unitAreaMatches({ ...unit, lengthM: 3, widthM: 2.1 }, "large")).toBe(true);
});
