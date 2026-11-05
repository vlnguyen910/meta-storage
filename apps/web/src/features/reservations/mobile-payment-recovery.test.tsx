import { focusManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useCustomerPaymentRecovery } from "../../../../mobile/src/features/customer-api/use-customer-payment-recovery";

const calls = vi.hoisted(() => ({
  read: vi.fn(),
  save: vi.fn(),
  initial: vi.fn(),
  link: undefined as ((event: { url: string }) => void) | undefined,
  state: undefined as ((state: string) => void) | undefined,
  removeLink: vi.fn(),
  removeState: vi.fn(),
}));
vi.mock("../../../../mobile/src/features/customer-api/customer-native", () => ({
  readCustomerCommand: calls.read,
  saveCustomerCommand: calls.save,
}));
vi.mock("../../../../mobile/node_modules/expo-linking/build/Linking.js", () => ({
  getInitialURL: calls.initial,
  addEventListener: (_: string, callback: typeof calls.link) => {
    calls.link = callback;
    return { remove: calls.removeLink };
  },
}));
vi.mock("../../../../mobile/node_modules/react-native/index.js", () => ({
  AppState: {
    currentState: "active",
    addEventListener: (_: string, callback: typeof calls.state) => {
      calls.state = callback;
      return { remove: calls.removeState };
    },
  },
}));
const paymentId = "00000000-0000-4000-8000-000000000001";
const otherPaymentId = "00000000-0000-4000-8000-000000000002";
const payment = { screen: "payment", id: paymentId };
function harness() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const refresh = vi.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { wrapper, refresh };
}
beforeEach(() => {
  vi.resetAllMocks();
  calls.initial.mockResolvedValue(null);
  calls.read.mockResolvedValue(null);
  calls.save.mockResolvedValue(undefined);
});
afterEach(() => focusManager.setFocused(undefined));
it("restores the owner's pending payment after a cold start without a deep link", async () => {
  calls.read.mockResolvedValue(payment);
  const restore = vi.fn();
  const { wrapper } = harness();
  renderHook(() => useCustomerPaymentRecovery("owner", restore), { wrapper });
  await waitFor(() => expect(restore).toHaveBeenCalledWith(payment));
  expect(calls.read).toHaveBeenCalledWith("owner", "payment");
});
it("recovers and refreshes when returning manually from the checkout browser", async () => {
  const restore = vi.fn();
  const { wrapper, refresh } = harness();
  renderHook(() => useCustomerPaymentRecovery("owner", restore), { wrapper });
  await waitFor(() => expect(calls.read).toHaveBeenCalledOnce());
  calls.read.mockResolvedValue(payment);
  act(() => {
    calls.state?.("background");
    calls.state?.("active");
  });
  await waitFor(() => expect(restore).toHaveBeenCalledWith(payment));
  expect(refresh).toHaveBeenCalledOnce();
});
it("does not navigate when there is no pending payment or when identifiers are invalid", async () => {
  calls.read.mockResolvedValue({ screen: "payment", id: "invalid" });
  const restore = vi.fn();
  renderHook(() => useCustomerPaymentRecovery("owner", restore), { wrapper: harness().wrapper });
  await waitFor(() => expect(calls.read).toHaveBeenCalledOnce());
  expect(restore).not.toHaveBeenCalled();
});
it("does not let a stale storage read replace a newer deep link", async () => {
  let complete: ((value: typeof payment) => void) | undefined;
  calls.read.mockReturnValue(
    new Promise((resolve) => {
      complete = resolve;
    }),
  );
  const restore = vi.fn();
  renderHook(() => useCustomerPaymentRecovery("owner", restore), { wrapper: harness().wrapper });
  await waitFor(() => expect(calls.read).toHaveBeenCalledOnce());
  await act(async () => {
    calls.link?.({ url: `metastorage://payment-result?paymentId=${otherPaymentId}` });
    complete?.(payment);
  });
  expect(restore).toHaveBeenCalledOnce();
  expect(restore).toHaveBeenCalledWith({
    screen: "payment",
    id: otherPaymentId,
    reservationId: undefined,
  });
});
it("discards a previous owner's delayed recovery after switching accounts", async () => {
  let complete: ((value: typeof payment) => void) | undefined;
  calls.read.mockImplementation((owner: string) =>
    owner === "old"
      ? new Promise((resolve) => {
          complete = resolve;
        })
      : Promise.resolve({ ...payment, id: otherPaymentId }),
  );
  const restore = vi.fn();
  const { result, rerender } = renderHook(
    ({ owner }) => useCustomerPaymentRecovery(owner, restore),
    { wrapper: harness().wrapper, initialProps: { owner: "old" } },
  );
  await waitFor(() => expect(calls.read).toHaveBeenCalledWith("old", "payment"));
  rerender({ owner: "new" });
  await waitFor(() =>
    expect(restore).toHaveBeenCalledWith({
      screen: "payment",
      id: otherPaymentId,
      reservationId: undefined,
    }),
  );
  await act(async () => complete?.(payment));
  expect(restore).toHaveBeenCalledOnce();
  expect(result.current).toBeUndefined();
});
it("removes native listeners when the workspace unmounts", () => {
  const { unmount } = renderHook(() => useCustomerPaymentRecovery("owner", vi.fn()), {
    wrapper: harness().wrapper,
  });
  unmount();
  expect(calls.removeLink).toHaveBeenCalledOnce();
  expect(calls.removeState).toHaveBeenCalledOnce();
});
