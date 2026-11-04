import { mobilePaymentReturnKey } from "@metastorage/shared";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { paymentResultMessages as M } from "./payment-result.messages";
import { PaymentResultScreen } from "./payment-result-screen";

const { state, replace } = vi.hoisted(() => ({
  state: { params: new URLSearchParams(), session: null as object | null },
  replace: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/bookings/payment-result",
  useSearchParams: () => state.params,
  useRouter: () => ({ replace }),
}));
vi.mock("@/features/auth/auth-store", () => ({
  useAuthStore: (select: (s: object) => unknown) =>
    select({ session: state.session, authReady: true }),
}));
vi.mock("@/components/layout/public-layout", () => ({
  PublicLayout: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("./booking-checkout.hooks", () => ({
  useCheckoutPaymentStatus: () => ({ isLoading: false, isError: false, isFetching: false }),
}));
vi.mock("./checkout-storage", () => ({ readCheckoutContext: () => null }));
vi.mock("./reservation-receipt", () => ({ ReservationReceipt: () => null }));

const paymentId = "00000000-0000-4000-8000-000000000001";
const returnUrl = `exp://192.168.20.25:8081/--/payment-result?paymentId=${paymentId}`;
beforeEach(() => {
  state.params = new URLSearchParams({ paymentId, status: "success" });
  state.session = null;
  replace.mockClear();
});

it("offers a return to mobile without requiring a web session or trusting status=success", async () => {
  sessionStorage.setItem(mobilePaymentReturnKey(paymentId), returnUrl);
  render(<PaymentResultScreen />);
  await waitFor(() =>
    expect(screen.getByRole("link", { name: M.returnToApp }).getAttribute("href")).toBe(returnUrl),
  );
  expect(replace).not.toHaveBeenCalled();
  expect(screen.queryByRole("link", { name: M.login })).toBeNull();
});

it("keeps mobile returns on the public result page even with a web session", async () => {
  state.session = { user: { id: "user" } };
  sessionStorage.setItem(mobilePaymentReturnKey(paymentId), returnUrl);
  render(<PaymentResultScreen />);
  await waitFor(() => expect(screen.getByRole("link", { name: M.returnToApp })).toBeTruthy());
  expect(replace).not.toHaveBeenCalled();
});

it("does not expose a saved URL for a different payment", async () => {
  sessionStorage.setItem(
    mobilePaymentReturnKey(paymentId),
    returnUrl.replace(paymentId, "00000000-0000-4000-8000-000000000099"),
  );
  render(<PaymentResultScreen />);
  await waitFor(() => expect(screen.getByText(M.accessRequired)).toBeTruthy());
  expect(screen.queryByRole("link", { name: M.returnToApp })).toBeNull();
});
