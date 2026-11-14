import { QueryClient, QueryClientProvider, useQueries } from "@tanstack/react-query";
import { act, render, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ManagerWorkRealtime } from "./manager-work-realtime";

const state = vi.hoisted(() => ({
  authReady: true,
  session: { user: { id: "manager", role: "FACILITY_MANAGER" } },
}));
vi.mock("@/config/api-mode", () => ({ isMockMode: false }));
vi.mock("@/features/auth/auth-store", () => ({
  useAuthStore: (select: (value: typeof state) => unknown) => select(state),
}));
vi.mock("@/lib/api", () => ({
  api: { notifications: { webSocketUrl: () => "ws://localhost/api/notifications/ws" } },
}));

class Socket {
  static instances: Socket[] = [];
  onopen?: () => void;
  onmessage?: (message: { data: string }) => void;
  onclose?: (event: { code: number }) => void;
  onerror?: () => void;
  close = vi.fn();
  constructor() {
    Socket.instances.push(this);
  }
  update(facilityId = "facility") {
    this.onmessage?.({
      data: JSON.stringify({
        id: "event",
        type: "FACILITY_WORK_UPDATED",
        facilityId,
        occurredAt: new Date().toISOString(),
      }),
    });
  }
}

const clients: QueryClient[] = [];
function harness() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  clients.push(client);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ManagerWorkRealtime facilityId="facility" />
      {children}
    </QueryClientProvider>
  );
  return { client, wrapper };
}

beforeEach(() => {
  Socket.instances = [];
  state.session.user.role = "FACILITY_MANAGER";
  state.authReady = true;
  vi.stubGlobal("WebSocket", Socket);
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
});
afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("refetches active appointment/task lists and open details while preserving unrelated data", async () => {
  const { client, wrapper } = harness();
  let serverStatus = "ASSIGNED";
  const keys = [
    ["bookings", "facility", "facility"],
    ["bookings", "detail", "appointment"],
    ["facility-flow", "lookup", "appointment", ""],
    ["flow5", "manager", "FACILITY_MANAGER", "tasks", { offset: 20, assignedStaffId: "staff" }],
    ["flow5", "manager", "FACILITY_MANAGER", "task", "task"],
    ["facility-task-related-appointment", "facility", "appointment"],
  ];
  const loads = keys.map(() => vi.fn(async () => serverStatus));
  const { result, unmount } = renderHook(
    () => useQueries({ queries: keys.map((queryKey, i) => ({ queryKey, queryFn: loads[i] })) }),
    { wrapper },
  );
  await waitFor(() =>
    expect(result.current.every((query) => query.data === "ASSIGNED")).toBe(true),
  );
  client.setQueryData(["customer-appointments", "customer"], "unchanged");
  client.setQueryData(["flow5", "manager", "FACILITY_MANAGER", "units"], "unchanged");
  vi.useFakeTimers();
  serverStatus = "IN_PROGRESS";
  await act(async () => {
    Socket.instances[0]?.onmessage?.({ data: "not json" });
    Socket.instances[0]?.update("another-facility");
    await vi.advanceTimersByTimeAsync(200);
  });
  expect(loads.every((load) => load.mock.calls.length === 1)).toBe(true);
  await act(async () => {
    Socket.instances[0]?.update();
    Socket.instances[0]?.update();
    await vi.advanceTimersByTimeAsync(200);
  });
  expect(result.current.every((query) => query.data === "IN_PROGRESS")).toBe(true);
  expect(loads.every((load) => load.mock.calls.length === 2)).toBe(true);
  expect(client.getQueryState(["customer-appointments", "customer"])?.isInvalidated).toBe(false);
  expect(
    client.getQueryState(["flow5", "manager", "FACILITY_MANAGER", "units"])?.isInvalidated,
  ).toBe(false);
  unmount();
});

it("recovers missed changes on reconnect, stops after authorization rejection and closes on unmount", async () => {
  const { client, wrapper } = harness();
  const { unmount } = renderHook(() => null, { wrapper });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  vi.useFakeTimers();
  await act(async () => {
    Socket.instances[0]?.onopen?.();
  });
  expect(invalidate).toHaveBeenCalled();
  invalidate.mockClear();
  await act(async () => {
    Socket.instances[0]?.onclose?.({ code: 1006 });
    await vi.advanceTimersByTimeAsync(1000);
    Socket.instances[1]?.onopen?.();
  });
  expect(Socket.instances).toHaveLength(2);
  expect(invalidate).toHaveBeenCalled();
  await act(async () => {
    Socket.instances[1]?.onclose?.({ code: 1008 });
    await vi.advanceTimersByTimeAsync(60_000);
  });
  expect(Socket.instances).toHaveLength(2);
  unmount();
  await vi.advanceTimersByTimeAsync(60_000);
  expect(Socket.instances).toHaveLength(2);
});

it("reconnects after going offline and closes the old connection on logout", async () => {
  const { wrapper } = harness();
  const view = render(<span />, { wrapper });
  const first = Socket.instances[0];
  act(() => window.dispatchEvent(new Event("offline")));
  expect(first?.close).toHaveBeenCalledOnce();
  act(() => window.dispatchEvent(new Event("online")));
  expect(Socket.instances).toHaveLength(2);
  state.session.user.role = "CUSTOMER";
  view.rerender(<span />);
  expect(Socket.instances[1]?.close).toHaveBeenCalledOnce();
  view.unmount();
});

it("does not connect for staff/customer or before the session is ready", () => {
  const { wrapper } = harness();
  state.authReady = false;
  const view = render(<span />, { wrapper });
  expect(Socket.instances).toHaveLength(0);
  state.authReady = true;
  state.session.user.role = "FACILITY_STAFF";
  view.rerender(<span />);
  expect(Socket.instances).toHaveLength(0);
  state.session.user.role = "CUSTOMER";
  view.rerender(<span />);
  expect(Socket.instances).toHaveLength(0);
  view.unmount();
});
