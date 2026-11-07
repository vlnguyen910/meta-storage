import { createMobilePaymentReturn, mobilePaymentReturnKey } from "@metastorage/shared";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { paymentResultMessages as M } from "./payment-result.messages";
import { PaymentResultScreen } from "./payment-result-screen";

const { state, replace } = vi.hoisted(() => ({
  state: {
    params: new URLSearchParams(),
    session: null as object | null,
    pathname: "/bookings/payment-result",
    authReady: true,
    data: undefined as { status: string; reservationId?: string } | undefined,
  },
  replace: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => state.pathname,
  useSearchParams: () => state.params,
  useRouter: () => ({ replace }),
}));
vi.mock("@/features/auth/auth-store", () => ({
  useAuthStore: (select: (s: object) => unknown) =>
    select({ session: state.session, authReady: state.authReady }),
}));
vi.mock("@/components/layout/public-layout", () => ({
  PublicLayout: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("./booking-checkout.hooks", () => ({
  useCheckoutPaymentStatus: () => ({
    isLoading: false,
    isError: false,
    isFetching: false,
    data: state.data,
  }),
}));
vi.mock("./checkout-storage", () => ({ readCheckoutContext: () => null }));
vi.mock("./reservation-receipt", () => ({ ReservationReceipt: () => <div>Verified receipt</div> }));

const paymentId = "00000000-0000-4000-8000-000000000001";
const returnUrl = `exp://192.168.20.25:8081/--/payment-result?paymentId=${paymentId}`;
beforeEach(() => {
  state.params = new URLSearchParams({ paymentId, status: "success" });
  state.session = null;
  state.authReady = true;
  state.pathname = "/bookings/payment-result";
  state.data = undefined;
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

it("preserves the payment and reservation through web sign-in", async () => {
  const reservationId = "00000000-0000-4000-8000-000000000002";
  state.params.set("reservationId", reservationId);
  render(<PaymentResultScreen />);
  const link = await screen.findByRole("link", { name: M.login });
  const login = new URL(link.getAttribute("href") ?? "", "http://localhost");
  expect(login.pathname).toBe("/login");
  expect(login.searchParams.get("returnTo")).toBe(
    `/customer/payments/result?paymentId=${paymentId}&reservationId=${reservationId}`,
  );
  expect(screen.getByRole("link", { name: M.openInApp }).getAttribute("href")).toBe(
    createMobilePaymentReturn(paymentId, reservationId),
  );
});
it("waits for authentication recovery before offering sign-in", async () => {
  state.authReady = false;
  render(<PaymentResultScreen />);
  await screen.findByText(M.loading);
  expect(screen.queryByRole("link", { name: M.login })).toBeNull();
});
it("reads verified web results without checkout context in this tab", async () => {
  state.session = { user: { id: "user" } };
  state.data = { status: "SUCCEEDED", reservationId: "reservation-from-api" };
  render(<PaymentResultScreen />);
  await screen.findByText("Verified receipt");
  expect(replace).toHaveBeenCalledWith(`/customer/payments/result?paymentId=${paymentId}`);
});
it("does not treat status=success in the URL as a verified payment", async () => {
  state.session = { user: { id: "user" } };
  state.data = { status: "PENDING" };
  render(<PaymentResultScreen />);
  await screen.findByText(M.pending);
  expect(screen.queryByText("Verified receipt")).toBeNull();
});
it("does not turn invalid identifiers into an app link", async () => {
  state.params.set("paymentId", "invalid");
  render(<PaymentResultScreen />);
  await screen.findByText(M.missing);
  expect(screen.queryByRole("link", { name: M.openInApp })).toBeNull();
});

it("keeps an explicitly opened web result independent from saved mobile navigation", async () => {
  state.pathname = "/customer/payments/result";
  state.session = { user: { id: "user" } };
  state.data = { status: "SUCCEEDED", reservationId: "reservation-from-api" };
  sessionStorage.setItem(mobilePaymentReturnKey(paymentId), returnUrl);
  render(<PaymentResultScreen />);
  await screen.findByText("Verified receipt");
  expect(screen.queryByRole("link", { name: M.returnToApp })).toBeNull();
  expect(replace).not.toHaveBeenCalled();
});
