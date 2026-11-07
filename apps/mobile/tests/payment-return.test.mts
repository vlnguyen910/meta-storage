import { expect, test } from "bun:test";
import { parseMobilePaymentReturn } from "@metastorage/shared";

const paymentId = "00000000-0000-4000-8000-000000000001";
const reservationId = "00000000-0000-4000-8000-000000000002";

test("handles custom schemes on Android browsers with opaque-path URL parsing", () => {
  const OriginalURL = globalThis.URL;
  class LegacyURL extends OriginalURL {
    get hostname() {
      return ["exp:", "exps:", "metastorage:"].includes(this.protocol) ? "" : super.hostname;
    }
    get pathname() {
      return ["exp:", "exps:", "metastorage:"].includes(this.protocol)
        ? `//${super.host}${super.pathname}`
        : super.pathname;
    }
  }
  globalThis.URL = LegacyURL;
  try {
    for (const base of [
      "exp://192.168.20.25:8081/--/payment-result",
      "metastorage://payment-result",
    ]) {
      expect(parseMobilePaymentReturn(`${base}?paymentId=${paymentId}`)).toEqual({
        paymentId,
        reservationId: undefined,
      });
    }
  } finally {
    globalThis.URL = OriginalURL;
  }
});

test("routes native and Expo Go returns to the same payment", () => {
  for (const base of [
    "metastorage://payment-result",
    "exp://192.168.20.25:8081/--/payment-result",
    "exps://example.exp.direct/--/payment-result",
  ]) {
    expect(
      parseMobilePaymentReturn(
        `${base}?paymentId=${paymentId}&reservationId=${reservationId}&status=success`,
      ),
    ).toEqual({ paymentId, reservationId });
  }
});

test("ignores invalid destinations, missing IDs and malformed links", () => {
  for (const value of [
    null,
    "bad-url",
    "metastorage://payment-result",
    "metastorage://payment-result?paymentId=invalid",
    `https://example.test/--/payment-result?paymentId=${paymentId}`,
    `exp://192.168.20.25:8081/--/auth?paymentId=${paymentId}`,
    `metastorage://payment-result?paymentId=${paymentId}&reservationId=invalid`,
  ]) {
    expect(parseMobilePaymentReturn(value)).toBeNull();
  }
});
