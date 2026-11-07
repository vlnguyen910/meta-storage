import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { TaskPanel } from "./task-workspace";

const calls = vi.hoisted(() => ({ list: vi.fn(), staff: vi.fn(), update: vi.fn(), unit: vi.fn() }));
vi.mock("@/config/api-mode", () => ({ isMockMode: false }));
vi.mock("@/features/auth/auth-store", () => ({
  useAuthStore: (select: (s: unknown) => unknown) =>
    select({ session: { user: { id: "manager", role: "FACILITY_MANAGER" } } }),
}));
vi.mock("./task-assignment-form", () => ({ TaskAssignmentForm: () => null }));
vi.mock("@/lib/api", () => ({
  api: {
    facilities: { getStaff: calls.staff },
    flow5: {
      units: { get: calls.unit },
      tasks: { listFacility: calls.list, update: calls.update },
    },
  },
}));

beforeEach(() => {
  vi.resetAllMocks();
  calls.staff.mockResolvedValue([]);
  calls.unit.mockResolvedValue({ code: "UNIT", status: "AVAILABLE" });
  calls.list.mockResolvedValue({
    items: [
      {
        id: "task",
        referenceType: "STORAGE_UNIT",
        referenceId: "unit",
        type: "UNIT_INSPECTION",
        status: "IN_PROGRESS",
        description: "Kiểm tra cửa kho",
        assignedStaffName: "Nhân viên",
        assignedAt: "2026-10-29T00:00:00Z",
      },
    ],
    total: 1,
  });
  calls.update.mockResolvedValue({ id: "task", status: "CANCELLED" });
});
it("FM can read task details without changing the staff task status", async () => {
  const user = userEvent.setup();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <TaskPanel facilityId="facility" manager />
    </QueryClientProvider>,
  );
  await screen.findByText("Kiểm tra cửa kho");
  expect(screen.queryByRole("combobox", { name: "Trạng thái" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Bắt đầu|Hoàn tất|Duyệt/ })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Xem chi tiết" }));
  expect(await screen.findByRole("dialog")).toBeVisible();
  expect(screen.queryByRole("combobox", { name: "Trạng thái" })).not.toBeInTheDocument();
  expect(calls.update).not.toHaveBeenCalled();
});
