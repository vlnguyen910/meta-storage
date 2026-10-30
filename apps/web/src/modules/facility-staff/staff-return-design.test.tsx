import { HANDOVER_CHECKLIST_ITEMS } from "@metastorage/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { StaffTaskDetailScreen } from "./staff-task-detail-screen";

const calls = vi.hoisted(() => ({
  update: vi.fn(),
  create: vi.fn(),
  history: vi.fn(),
  save: vi.fn(),
  refetch: vi.fn(),
  push: vi.fn(),
}));
const state = vi.hoisted(() => ({
  task: {} as Record<string, unknown>,
  record: null as Record<string, unknown> | null,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: calls.push }) }));
vi.mock("@/features/auth/auth-store", () => ({
  useAuthStore: (select: (value: unknown) => unknown) =>
    select({ session: { user: { id: "staff" } } }),
}));
vi.mock("@/features/facility-management/hooks", () => ({
  useFacilityTaskDetail: () => ({
    data: state.task,
    isPending: false,
    isError: false,
    refetch: calls.refetch,
  }),
  useUpdateTask: () => ({ isPending: false }),
  managementError: () => "Error",
}));
vi.mock("@/lib/api", () => ({
  api: {
    appointments: {
      get: async () => ({
        id: "appointment",
        appointmentType: "CHECK_OUT",
        customerName: "Trần Ngọc Anh",
        contactPhone: "0900000000",
        scheduledDate: "2030-06-01",
        slotStart: "09:00:00",
        slotName: "Ca sáng",
      }),
    },
    flow5: { tasks: { update: calls.update } },
    inspections: { create: calls.create, forAppointment: calls.history, save: calls.save },
  },
}));
beforeEach(() => {
  vi.resetAllMocks();
  state.task = {
    id: "task",
    assignedStaffId: "staff",
    facilityId: "facility",
    type: "UNIT_INSPECTION",
    referenceType: "APPOINTMENT",
    referenceId: "appointment",
    status: "ASSIGNED",
    assignedAt: "2030-06-01T00:00:00Z",
  };
  state.record = null;
  calls.history.mockImplementation(async () => (state.record ? [state.record] : []));
  calls.create.mockImplementation(async () => {
    state.record = {
      id: "inspection",
      taskId: "task",
      status: "IN_PROGRESS",
      unitCode: "HCM-01-012",
      notes: "",
      condition: "GOOD",
      checklist: {},
      evidence: [],
      returnContext: {
        checkIn: {
          condition: "GOOD",
          notes: "Đã đối chiếu cửa kho",
          inspectedAt: "2030-05-01T00:00:00Z",
        },
        depositAmount: 500000,
        fees: [],
        penalties: [],
        policyVersion: 1,
      },
    };
    return state.record;
  });
  calls.update.mockImplementation(async () => {
    state.task.status = "IN_PROGRESS";
    return state.task;
  });
  calls.save.mockImplementation(async (_id, input) => {
    state.record = { ...state.record, ...input };
    return state.record;
  });
});
it("keeps start, draft save and validated completion working in the new staff layout", async () => {
  const user = userEvent.setup();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <StaffTaskDetailScreen taskId="task" />
    </QueryClientProvider>,
  );
  expect(await screen.findByRole("heading", { name: "Sẵn sàng tiếp nhận kho" })).toBeVisible();
  expect(screen.getAllByRole("link", { name: "Quay lại công việc" })).toHaveLength(1);
  await user.click(screen.getByRole("button", { name: "Bắt đầu kiểm tra trả kho" }));
  expect(
    await screen.findByRole("heading", { name: "Kiểm tra trả kho · HCM-01-012" }),
  ).toBeVisible();
  expect(calls.update).toHaveBeenCalledWith("task", { status: "IN_PROGRESS" });
  expect(calls.create).toHaveBeenCalledWith({ taskId: "task" });
  expect(screen.getByText(/Tình trạng khi nhận kho: Tốt/, { selector: "p" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Hoàn tất trả kho" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Lưu bản nháp" }));
  await waitFor(() =>
    expect(calls.save).toHaveBeenCalledWith(
      "inspection",
      expect.objectContaining({ status: "IN_PROGRESS" }),
    ),
  );
  for (const item of HANDOVER_CHECKLIST_ITEMS)
    await user.click(
      within(screen.getByRole("group", { name: item.label })).getByRole("radio", {
        name: "Đạt",
      }),
    );
  await user.click(screen.getByRole("button", { name: "Hoàn tất trả kho" }));
  await waitFor(() =>
    expect(calls.save).toHaveBeenCalledWith(
      "inspection",
      expect.objectContaining({ status: "PASSED", condition: "GOOD" }),
    ),
  );
  await waitFor(() => expect(calls.push).toHaveBeenCalledWith("/staff/tasks"));
});
