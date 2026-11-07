import { mobilePaymentReturnKey } from "@metastorage/shared";
import { expect, it, vi } from "vitest";
import { readMobilePaymentReturn, saveMobilePaymentReturn } from "./mobile-payment-return-storage";

const id = "00000000-0000-4000-8000-000000000001";
const reservation = "00000000-0000-4000-8000-000000000002";
const url = `exp://192.168.20.25:8081/--/payment-result?paymentId=${id}&reservationId=${reservation}`;
it("recovers the Expo return in a new tab on the same origin", () => {
  expect(saveMobilePaymentReturn(url)).toBe(true);
  sessionStorage.clear();
  expect(readMobilePaymentReturn(id, reservation)).toBe(url);
});
it("rejects mismatched reservations and invalid destinations", () => {
  saveMobilePaymentReturn(url);
  expect(readMobilePaymentReturn(id, id)).toBeUndefined();
  expect(saveMobilePaymentReturn(`https://attacker.test/?paymentId=${id}`)).toBe(false);
  expect(saveMobilePaymentReturn("metastorage://payment-result?paymentId=invalid")).toBe(false);
});
it("ignores corrupt cached data and can read the other store", () => {
  saveMobilePaymentReturn(url);
  sessionStorage.setItem(mobilePaymentReturnKey(id), "javascript:alert(1)");
  expect(readMobilePaymentReturn(id, reservation)).toBe(url);
});
it("tolerates browser storage being disabled", () => {
  const session = vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => {
    throw new Error("blocked");
  });
  const local = vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
    throw new Error("blocked");
  });
  try {
    expect(saveMobilePaymentReturn(url)).toBe(true);
    expect(readMobilePaymentReturn(id)).toBeUndefined();
  } finally {
    session.mockRestore();
    local.mockRestore();
  }
});
