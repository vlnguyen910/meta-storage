import { describe, expect, it, vi } from "vitest";
import { checkInError, checkoutFailure, normalizePhone, phoneError } from "./checkout-validation";
import { RESERVATION_MESSAGES as m } from "./reservation.messages";

describe("guest checkout validation", () => {
  it.each(["0901234567", "901234567", "+84 901 234 567"])("normalizes %s for the API", (value) => {
    expect(normalizePhone(value)).toBe("+84901234567");
  });
  it("accepts local numbers and rejects missing zero or an international prefix", () => {
    expect(phoneError("0901234567")).toBeUndefined();
    expect(phoneError("090 123 4567")).toBeUndefined();
    expect(phoneError("901234567")).toBe(m.invalidPhone);
    expect(phoneError("+84901234567")).toBe(m.phoneCharacters);
  });
  it("explains an empty, short or nonnumeric phone", () => {
    expect(phoneError("")).toBe(m.phoneRequired);
    expect(phoneError("98765432")).toBe(m.invalidPhone);
    expect(phoneError("090abc4567")).toBe(m.phoneCharacters);
  });
  it("rejects past times using Vietnam time, including earlier today", () => {
    const now = new Date("2026-10-02T09:00:00Z");
    expect(checkInError("2026-10-02T15:59", now)).toBe(m.pastCheckIn);
    expect(checkInError("2026-10-02T16:00", now)).toBe(m.pastCheckIn);
    expect(checkInError("2026-10-02T16:01", now)).toBeUndefined();
  });
  it("accepts dates beyond 30 days but rejects nonexistent dates and malformed times", () => {
    const now = new Date("2026-10-02T09:00:00Z");
    expect(checkInError("2027-10-02T09:00", now)).toBeUndefined();
    expect(checkInError("2027-02-30T09:00", now)).toBe(m.checkInRequired);
    expect(checkInError("2026-10-03T25:00", now)).toBe(m.checkInRequired);
  });
  it("reads nested API errors and logs status, stage and field details without request contact data", () => {
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    const failure = checkoutFailure(
      {
        isAxiosError: true,
        config: {
          method: "post",
          url: "/reservations/drafts?token=private-token",
          data: { email: "private@example.test" },
        },
        response: {
          status: 400,
          headers: { "x-request-id": "request-123" },
          data: {
            error: {
              code: 400,
              message: "Kiểm tra thông tin",
              details: [{ field: "contact.phone", message: "Số không hợp lệ" }],
            },
          },
        },
      },
      "draft",
    );
    expect(failure.message).toBe("Kiểm tra thông tin");
    expect(failure.code).toBe(400);
    expect(failure.details?.[0]?.field).toBe("contact.phone");
    const diagnostic = JSON.parse(
      String(log.mock.calls[0]?.[0]).replace("[metastorage checkout] Request failed ", ""),
    );
    expect(diagnostic).toMatchObject({
      status: 400,
      stage: "draft",
      requestId: "request-123",
      code: "VALIDATION_ERROR",
      method: "POST",
      endpoint: "/reservations/drafts",
    });
    expect(String(log.mock.calls[0]?.[0])).not.toContain("private-token");
    expect(String(log.mock.calls[0]?.[0])).not.toContain("private@example.test");
    log.mockRestore();
  });
  it("distinguishes a network error from a rejected API request", () => {
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(checkoutFailure({ isAxiosError: true }, "payment").message).toBe(m.networkError);
    log.mockRestore();
  });
});
