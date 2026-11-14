import { createNotificationStream } from "@metastorage/api-client";
import { QueryClient, QueryClientProvider, useQueries } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useStaffTaskNotifications } from "@/features/facility-flow/use-staff-task-notifications";
import { CustomerAppointmentsRealtime } from "./customer-appointments-realtime";

const { state, toast } = vi.hoisted(() => ({
  state: { authReady: true, session: { user: { id: "customer", role: "CUSTOMER" } } },
  toast: vi.fn(),
}));
vi.mock("@/config/api-mode", () => ({ isMockMode: false }));
vi.mock("@/features/auth/auth-store", () => ({
  useAuthStore: (select: (s: typeof state) => unknown) => select(state),
}));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ showToast: toast }) }));
vi.mock("@/lib/api", () => ({
  api: { notifications: { webSocketUrl: () => "ws://localhost/api/notifications/ws" } },
}));

class Socket {
  static instances: Socket[] = [];
  onopen?: () => void;
  onmessage?: (event: { data: string }) => void;
  onclose?: (event: { code: number }) => void;
  onerror?: () => void;
  close = vi.fn();
  constructor() {
    Socket.instances.push(this);
  }
  event(type: string, recipientId = state.session.user.id) {
    this.onmessage?.({
      data: JSON.stringify({
        id: "event",
        type,
        recipientId,
        facilityId: "facility",
        appointmentId: "appointment",
        occurredAt: new Date().toISOString(),
      }),
    });
  }
}
async function emitDuplicateEvents(type: string) {
  await act(async () => {
    Socket.instances[0]?.event(type);
    Socket.instances[0]?.event(type);
    await vi.advanceTimersByTimeAsync(200);
  });
}
function StaffListener() {
  useStaffTaskNotifications();
  return null;
}
const clients: QueryClient[] = [];
function harness(role: "CUSTOMER" | "FACILITY_STAFF", keys: unknown[][]) {
  state.session.user = { id: role === "CUSTOMER" ? "customer" : "staff", role };
  let status = "BEFORE";
  const loads = keys.map(() => vi.fn(async () => status));
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  clients.push(client);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      {role === "CUSTOMER" ? <CustomerAppointmentsRealtime /> : <StaffListener />}
      {children}
    </QueryClientProvider>
  );
  return {
    client,
    loads,
    wrapper,
    setStatus: (value: string) => {
      status = value;
    },
    read: () =>
      useQueries({ queries: keys.map((queryKey, i) => ({ queryKey, queryFn: loads[i] })) }),
  };
}
beforeEach(() => {
  state.authReady = true;
  Socket.instances = [];
  toast.mockClear();
  vi.stubGlobal("WebSocket", Socket);
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
});
afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("updates customer appointment lists/open details while leaving rentals and notifications untouched", async () => {
  const h = harness("CUSTOMER", [
    ["customer-appointments", "customer:CUSTOMER"],
    ["appointments", "customer:CUSTOMER", "mine"],
  ]);
  const view = renderHook(h.read, { wrapper: h.wrapper });
  await waitFor(() =>
    expect(view.result.current.every((query) => query.data === "BEFORE")).toBe(true),
  );
  await waitFor(() => expect(Socket.instances[0]?.onmessage).toBeDefined());
  h.client.setQueryData(["rentals", "mine", "current", "customer:CUSTOMER"], "kept");
  h.client.setQueryData(["lifecycle-notifications", "customer:CUSTOMER"], "kept");
  vi.useFakeTimers();
  h.setStatus("CONFIRMED");
  await act(async () => {
    Socket.instances[0]?.event("CUSTOMER_APPOINTMENT_UPDATED", "another-customer");
    Socket.instances[0]?.event("STAFF_WORK_UPDATED");
    Socket.instances[0]?.onmessage?.({ data: "not json" });
    await vi.advanceTimersByTimeAsync(200);
  });
  expect(h.loads.every((load) => load.mock.calls.length === 1)).toBe(true);
  await emitDuplicateEvents("CUSTOMER_APPOINTMENT_UPDATED");
  expect(view.result.current.every((query) => query.data === "CONFIRMED")).toBe(true);
  expect(h.loads.every((load) => load.mock.calls.length === 2)).toBe(true);
  expect(
    h.client.getQueryState(["rentals", "mine", "current", "customer:CUSTOMER"])?.isInvalidated,
  ).toBe(false);
  expect(
    h.client.getQueryState(["lifecycle-notifications", "customer:CUSTOMER"])?.isInvalidated,
  ).toBe(false);
  view.unmount();
  expect(Socket.instances[0]?.close).toHaveBeenCalledOnce();
});

it("refreshes staff lists and details for transfers/cancellations without creating assignment toasts", async () => {
  const h = harness("FACILITY_STAFF", [
    ["bookings", "staff-tasks", "facility", "staff"],
    ["flow5", "staff", "FACILITY_STAFF", "staff-work", "facility"],
    ["flow5", "staff", "FACILITY_STAFF", "task", "task"],
    ["facility-flow", "lookup", "appointment", ""],
    ["staff-return-appointment", "appointment"],
  ]);
  const view = renderHook(h.read, { wrapper: h.wrapper });
  await waitFor(() =>
    expect(view.result.current.every((query) => query.data === "BEFORE")).toBe(true),
  );
  vi.useFakeTimers();
  h.setStatus("CANCELLED");
  await act(async () => {
    Socket.instances[0]?.event("STAFF_WORK_UPDATED", "another-staff");
    await vi.advanceTimersByTimeAsync(200);
  });
  expect(h.loads.every((load) => load.mock.calls.length === 1)).toBe(true);
  await emitDuplicateEvents("STAFF_WORK_UPDATED");
  expect(view.result.current.every((query) => query.data === "CANCELLED")).toBe(true);
  expect(h.loads.every((load) => load.mock.calls.length === 2)).toBe(true);
  expect(toast).not.toHaveBeenCalled();
  view.unmount();
});

it("recovers missed customer updates on reconnect and stops sockets after logout", async () => {
  const h = harness("CUSTOMER", [["customer-appointments", "customer:CUSTOMER"]]);
  const view = renderHook(h.read, { wrapper: h.wrapper });
  await waitFor(() => expect(view.result.current[0]?.data).toBe("BEFORE"));
  await waitFor(() => expect(Socket.instances[0]?.onclose).toBeDefined());
  vi.useFakeTimers();
  h.setStatus("COMPLETED");
  await act(async () => {
    Socket.instances[0]?.onclose?.({ code: 1006 });
    await vi.advanceTimersByTimeAsync(1000);
    Socket.instances[1]?.onopen?.();
    await vi.advanceTimersByTimeAsync(10);
  });
  expect(Socket.instances).toHaveLength(2);
  expect(view.result.current[0]?.data).toBe("COMPLETED");
  state.session.user.role = "guest";
  view.rerender();
  expect(Socket.instances[1]?.close).toHaveBeenCalledOnce();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60_000);
  });
  expect(Socket.instances).toHaveLength(2);
  view.unmount();
});

it("does not reconnect after authorization rejection or attach a socket resolved after disposal", async () => {
  vi.useFakeTimers();
  const stream = createNotificationStream({
    createSocket: () => new WebSocket("ws://localhost"),
    onOpen: vi.fn(),
    onMessage: vi.fn(),
  });
  await stream.connect();
  Socket.instances[0]?.onclose?.({ code: 1008 });
  await vi.advanceTimersByTimeAsync(60_000);
  await stream.connect();
  expect(Socket.instances).toHaveLength(1);
  stream.dispose();
  let finish: ((socket: WebSocket) => void) | undefined;
  const late = createNotificationStream({
    createSocket: () =>
      new Promise<WebSocket>((resolve) => {
        finish = resolve;
      }),
    onOpen: vi.fn(),
    onMessage: vi.fn(),
  });
  const pending = late.connect();
  late.dispose();
  const socket = new WebSocket("ws://localhost");
  finish?.(socket);
  await pending;
  expect(Socket.instances[1]?.close).toHaveBeenCalledOnce();
  expect(Socket.instances[1]?.onmessage).toBeUndefined();
});
