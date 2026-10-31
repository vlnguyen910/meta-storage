import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import {
  useStaffCheckIn,
  useStaffWorkspace,
} from "../../../../mobile/src/features/staff-api/use-staff-workspace";

const calls = vi.hoisted(() => ({
  lookup: vi.fn(),
  tasks: vi.fn(),
  history: vi.fn(),
  update: vi.fn(),
  handover: vi.fn(),
  assignments: vi.fn(),
  bookings: vi.fn(),
}));
vi.mock("../../../../mobile/src/lib/api", () => ({
  api: {
    appointments: { get: calls.lookup, assignedToMe: calls.bookings },
    facilities: { myAssignments: calls.assignments },
    flow5: { tasks: { listMine: calls.tasks, update: calls.update } },
    inspections: { forAppointment: calls.history, handover: calls.handover },
  },
}));
vi.mock("../../../../mobile/src/lib/pick-image", () => ({ pickImage: vi.fn() }));

const task = {
  id: "handover-task",
  type: "CHECK_IN_HANDOVER",
  referenceType: "APPOINTMENT",
  referenceId: "appointment",
  status: "ASSIGNED",
  facilityId: "facility",
  assignedStaffId: "staff",
};
function harness() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}
beforeEach(() => {
  vi.resetAllMocks();
  calls.lookup.mockResolvedValue({
    id: "appointment",
    status: "CONFIRMED",
    appointmentType: "CHECK_IN",
  });
  calls.tasks.mockResolvedValue({ items: [task], total: 1, limit: 100, offset: 0 });
  calls.history.mockResolvedValue([]);
  calls.update.mockResolvedValue({ ...task, status: "IN_PROGRESS" });
  calls.assignments.mockResolvedValue([{ facilityId: "facility", isActive: true, endedAt: null }]);
  calls.bookings.mockResolvedValue([]);
});

it("keeps the infinite work list cache separate from appointment handover task queries", async () => {
  const { client, wrapper } = harness();
  const list = { pages: [{ items: [], total: 0, limit: 20, offset: 0 }], pageParams: [0] };
  client.setQueryData(["mobile-staff-tasks", "staff"], list);
  const { result } = renderHook(() => useStaffCheckIn("staff", "appointment"), { wrapper });
  await waitFor(() => expect(result.current.tasks.isSuccess).toBe(true));
  expect(result.current.tasks.data?.[0]?.id).toBe(task.id);
  expect(client.getQueryData(["mobile-staff-tasks", "staff"])).toEqual(list);
  expect(calls.tasks).toHaveBeenCalledWith({
    referenceId: "appointment",
    limit: 100,
    offset: 0,
  });
});

it("loads persisted inspection history before the task is started", async () => {
  const { wrapper } = harness();
  const { result } = renderHook(() => useStaffCheckIn("staff", "appointment"), { wrapper });
  await waitFor(() => expect(result.current.history.isSuccess).toBe(true));
  expect(result.current.record).toBeUndefined();
  expect(calls.history).toHaveBeenCalledWith("appointment");
});

it("does not show an undated duplicate handover task outside the appointment date filter", async () => {
  const { wrapper } = harness();
  const { result } = renderHook(
    () =>
      useStaffWorkspace("staff", { kind: "all", date: "2026-10-29", group: "pending", search: "" }),
    { wrapper },
  );
  await waitFor(() => expect(result.current.pending).toBe(false));
  expect(result.current.items).toEqual([]);
});

it("starts the assigned handover through the task status endpoint", async () => {
  const { wrapper } = harness();
  const { result } = renderHook(() => useStaffCheckIn("staff", "appointment"), { wrapper });
  await waitFor(() => expect(result.current.tasks.isSuccess).toBe(true));
  await act(() => result.current.begin.mutateAsync());
  expect(calls.update).toHaveBeenCalledWith(task.id, { status: "IN_PROGRESS" });
});
