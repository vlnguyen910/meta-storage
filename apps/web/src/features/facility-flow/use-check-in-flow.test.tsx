import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { FLOW } from "./flow.messages";
import { useCheckInFlow } from "./use-check-in-flow";

const calls = vi.hoisted(() => ({
  get: vi.fn(),
  tasks: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
  history: vi.fn(),
  push: vi.fn(),
  toast: vi.fn(),
}));
const appointmentId = "11111111-1111-4111-8111-111111111111";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: calls.push }),
  usePathname: () => "/staff/check-in",
  useSearchParams: () =>
    new URLSearchParams({ appointmentId: "11111111-1111-4111-8111-111111111111" }),
}));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ showToast: calls.toast }) }));
vi.mock("@/lib/api", () => ({
  api: {
    appointments: { get: calls.get },
    flow5: { tasks: { listMine: calls.tasks, update: calls.update } },
    inspections: { forAppointment: calls.history, create: calls.create },
  },
}));
const unit = {
  id: "assignment",
  physicalUnitId: "unit-new",
  physicalUnitCode: "A-02",
  status: "ACTIVE",
};
function harness() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  calls.get.mockResolvedValue({
    id: appointmentId,
    reservationId: "reservation",
    status: "CONFIRMED",
    appointmentType: "CHECK_IN",
    scheduledDate: "2030-01-01",
    slotStart: "09:00:00",
    slotEnd: "10:00:00",
    paymentStatus: "SUCCEEDED",
    assignedUnit: unit,
    reservation: { status: "CONFIRMED" },
  });
  calls.tasks.mockResolvedValue({
    items: [
      {
        id: "task",
        referenceId: appointmentId,
        referenceType: "APPOINTMENT",
        type: "CHECK_IN_HANDOVER",
        status: "ASSIGNED",
      },
    ],
  });
  calls.history.mockResolvedValue([]);
  calls.create.mockResolvedValue({
    id: "inspection",
    storageUnitId: "unit-new",
    inspectionType: "CHECK_IN",
  });
});
it("starts the assigned appointment task and inspects the currently assigned unit", async () => {
  const { result } = renderHook(useCheckInFlow, { wrapper: harness() });
  await waitFor(() => expect(result.current.lookup.isSuccess).toBe(true));
  await act(() => result.current.verify.mutateAsync());
  expect(calls.tasks).toHaveBeenCalledWith({
    type: "CHECK_IN_HANDOVER",
    referenceId: appointmentId,
    limit: 100,
    offset: 0,
  });
  expect(calls.update).toHaveBeenCalledWith("task", { status: "IN_PROGRESS" });
  expect(calls.create).toHaveBeenCalledWith({ taskId: "task", storageUnitId: "unit-new" });
  expect(calls.push).toHaveBeenCalledWith(expect.stringContaining("view=inspect"));
});
it("blocks missing unit data before changing task status", async () => {
  const appointment = await calls.get();
  calls.get.mockResolvedValue({
    ...appointment,
    assignedUnit: { id: null, physicalUnitId: null, physicalUnitCode: null, status: null },
  });
  const { result } = renderHook(useCheckInFlow, { wrapper: harness() });
  await waitFor(() => expect(result.current.lookup.isSuccess).toBe(true));
  expect(result.current.result?.assignedUnit).toBeNull();
  expect(result.current.result?.checkInReadiness).toEqual({
    canProceed: false,
    reasons: ["UNIT_NOT_ASSIGNED"],
  });
  await act(async () => {
    await expect(result.current.verify.mutateAsync()).rejects.toThrow(FLOW.unassigned);
  });
  expect(calls.tasks).not.toHaveBeenCalled();
  expect(calls.update).not.toHaveBeenCalled();
  expect(calls.create).not.toHaveBeenCalled();
});
