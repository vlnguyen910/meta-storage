import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useReservationCheckout } from "./use-reservation-checkout";

const mocks = vi.hoisted(() => ({
  pay: vi.fn(),
  draft: vi.fn(),
  hold: vi.fn(),
  status: { data: undefined as unknown },
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("facilityId=facility&unitTypeId=unit"),
}));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("@/features/facilities/hooks", () => ({
  useFacilities: () => ({}),
  useAvailability: () => ({ data: [{ unitTypeId: "unit", availableCount: 2 }], refetch: vi.fn() }),
}));
vi.mock("qrcode", () => ({
  default: { toDataURL: () => Promise.resolve("data:image/png;base64,test") },
}));
vi.mock("./booking-checkout.hooks", () => ({
  useBookingDraft: () => ({ isPending: false, mutateAsync: mocks.draft }),
  useBookingSlots: () => ({ data: [{ id: "slot", startTime: "09:00:00", endTime: "11:00:00" }] }),
  useBookingPayment: () => ({ isPending: false, mutateAsync: mocks.pay }),
  useCheckoutPaymentStatus: () => mocks.status,
}));

const confirmation = { qrUrl: "https://example.test/qr", bookingCode: "BK-SERVER" };
const pending = { status: "PENDING", paymentId: "payment", paymentCode: "SX123" };

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  mocks.status.data = undefined;
  mocks.draft.mockImplementation(async (input) => ({
    ...input,
    id: "draft",
    draftAccessToken: "a".repeat(64),
    pricing: {
      monthlyRateSnapshot: "1",
      rentalFeeAmount: "1",
      depositAmount: "1",
      totalAmount: "2",
      currency: "VND",
    },
  }));
  mocks.hold.mockResolvedValue({
    expiresAt: new Date(Date.now() + 600000).toISOString(),
    holdToken: "hold",
  });
});

async function checkout() {
  const hook = renderHook(() => useReservationCheckout());
  await act(async () => {
    await hook.result.current.next();
  });
  await act(async () => {
    hook.result.current.form.setValue("fullName", "Khách Kiểm Thử");
    hook.result.current.form.setValue("phone", "0901234567");
    hook.result.current.form.setValue("email", "qa@example.com");
    hook.result.current.form.setValue("checkInDate", "2099-06-01");
    hook.result.current.form.setValue("checkInSlotId", "slot");
  });
  await act(async () => {
    await hook.result.current.next();
  });
  return hook;
}

describe("checkout payment reconciliation", () => {
  it("binds check-in errors from numeric API responses to the check-in field", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.draft.mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        status: 400,
        data: {
          success: false,
          error: {
            code: 400,
            message: "Outside operating hours",
            details: [{ field: "checkInDate", message: "Outside operating hours" }],
          },
        },
      },
    });
    const { result } = await checkout();
    expect(result.current.form.getFieldState("checkInDate").error?.message).toBe(
      "Outside operating hours",
    );
    expect(mocks.hold).not.toHaveBeenCalled();
    log.mockRestore();
  });
  it("keeps a pending SePay payment pending and prevents duplicate requests", async () => {
    mocks.pay.mockResolvedValue(pending);
    const { result } = await checkout();
    await act(async () => {
      await result.current.pay();
    });
    expect(result.current.pendingPayment).toEqual(pending);
    expect(result.current.confirmation).toBeNull();
    expect(result.current.step).toBe(2);
    await act(async () => {
      await result.current.pay();
    });
    expect(mocks.pay).toHaveBeenCalledTimes(1);
  });
  it("shows Booking ID and QR only after the server confirms success", async () => {
    mocks.pay.mockResolvedValue(pending);
    const { result, rerender } = await checkout();
    await act(async () => {
      await result.current.pay();
    });
    mocks.status.data = { status: "SUCCEEDED", confirmation };
    rerender();
    await waitFor(() => expect(result.current.step).toBe(4));
    expect(result.current.confirmation).toEqual(confirmation);
    expect(result.current.pendingPayment).toEqual(pending);
  });
  it("does not show success for a response missing booking confirmation", async () => {
    mocks.pay.mockResolvedValue(pending);
    const { result, rerender } = await checkout();
    await act(async () => {
      await result.current.pay();
    });
    mocks.status.data = { status: "SUCCEEDED" };
    rerender();
    expect(result.current.confirmation).toBeNull();
    expect(result.current.step).toBe(2);
  });
  it("keeps the idempotency key for a retry after a network error", async () => {
    mocks.pay.mockRejectedValueOnce(new Error("Network failure")).mockResolvedValue(pending);
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { result } = await checkout();
    await act(async () => {
      await result.current.pay();
    });
    await act(async () => {
      await result.current.pay();
    });
    expect(mocks.pay.mock.calls[0]?.[0].input.idempotencyKey).toBe(
      mocks.pay.mock.calls[1]?.[0].input.idempotencyKey,
    );
    log.mockRestore();
  });
});
