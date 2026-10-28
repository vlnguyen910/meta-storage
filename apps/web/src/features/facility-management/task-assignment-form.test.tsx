import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TaskAssignmentForm } from "./task-assignment-form";

const calls = vi.hoisted(() => ({
  staff: vi.fn(),
  bookings: vi.fn(),
  units: vi.fn(),
  create: vi.fn(),
}));
vi.mock("@/config/api-mode", () => ({ isMockMode: false }));
vi.mock("@/features/auth/auth-store", () => ({
  useAuthStore: (select: (state: unknown) => unknown) =>
    select({ session: { user: { id: "manager-test", role: "FACILITY_MANAGER" } } }),
}));
vi.mock("@/lib/api", () => ({
  api: {
    facilities: { getStaff: calls.staff },
    bookings: { listFacilityBookings: calls.bookings },
    flow5: { units: { list: calls.units }, tasks: { create: calls.create } },
  },
}));
const id = (n: number) => `94000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const facilityId = id(1);
const staff = { id: id(2), name: "Nhân viên HCM-02", email: "staff@example.test", isActive: true };
const unit = {
  id: id(3),
  facilityId,
  code: "HCM-02-4M-001",
  unitTypeName: "Kho tiêu chuẩn",
  unitTypeSizeLabel: "4 m²",
  status: "AVAILABLE",
};
const booking = {
  id: id(4),
  facilityId,
  bookingCode: "SX-BOOKING-001",
  contactName: "Khách kiểm thử",
  checkInSlotStart: "2026-10-29T13:00:00Z",
  status: "CONFIRMED",
  assignedUnit: { physicalUnitCode: unit.code },
};
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <TaskAssignmentForm facilityId={facilityId} />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}
async function chooseStaff(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Nhân viên được giao" })).toBeEnabled(),
  );
  await user.click(screen.getByRole("button", { name: "Nhân viên được giao" }));
  await user.click(screen.getByRole("option", { name: /Nhân viên HCM-02/ }));
}
async function chooseUnit(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Ô kho cần kiểm tra" })).toBeEnabled(),
  );
  await user.click(screen.getByRole("button", { name: "Ô kho cần kiểm tra" }));
  await user.click(screen.getByRole("option", { name: /HCM-02-4M-001/ }));
}
beforeEach(() => {
  vi.clearAllMocks();
  calls.staff.mockResolvedValue([
    staff,
    { ...staff, id: id(8), name: "Nhân viên ngừng hoạt động", isActive: false },
  ]);
  calls.units.mockResolvedValue({
    items: [unit, { ...unit, id: id(9), facilityId: id(99), code: "OTHER-UNIT" }],
    total: 2,
    limit: 100,
    offset: 0,
  });
  calls.bookings.mockResolvedValue([
    booking,
    { ...booking, id: id(10), facilityId: id(99), bookingCode: "OTHER-BOOKING" },
  ]);
  calls.create.mockResolvedValue({ id: id(20) });
});

describe("FM task assignment", () => {
  it("shows business labels and sends the selected unit UUID with a trimmed description", async () => {
    const user = setup();
    await chooseStaff(user);
    await chooseUnit(user);
    await user.type(
      screen.getByLabelText("Nội dung công việc (tùy chọn)"),
      "  Kiểm tra cửa và khóa  ",
    );
    await user.click(screen.getByRole("button", { name: "Giao công việc" }));
    await waitFor(() =>
      expect(calls.create).toHaveBeenCalledWith({
        facilityId,
        assignedStaffId: staff.id,
        type: "UNIT_INSPECTION",
        referenceType: "STORAGE_UNIT",
        referenceId: unit.id,
        description: "Kiểm tra cửa và khóa",
      }),
    );
    await screen.findByText("Đã giao công việc cho nhân viên.");
    expect(screen.getByRole("button", { name: "Giao công việc" })).toBeDisabled();
    expect(screen.queryByText("Reference ID")).not.toBeInTheDocument();
    expect(screen.queryByText("Reference type")).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Check-in handover" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Booking & Bàn giao" })).toHaveAttribute(
      "href",
      "/facility-manager/tasks?view=bookings",
    );
    expect(calls.bookings).not.toHaveBeenCalled();
    expect(calls.units).toHaveBeenCalledWith(
      expect.objectContaining({ facilityId, limit: 100 }),
      expect.any(AbortSignal),
    );
  });

  it("clears the old unit when switching to booking and submits the booking UUID", async () => {
    const user = setup();
    await chooseStaff(user);
    await chooseUnit(user);
    await user.selectOptions(screen.getByLabelText("Đối tượng cần kiểm tra"), "BOOKING");
    expect(screen.getByRole("button", { name: "Giao công việc" })).toBeDisabled();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Booking liên quan" })).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: "Booking liên quan" }));
    expect(screen.queryByRole("option", { name: /OTHER-BOOKING/ })).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("option", { name: /SX-BOOKING-001.*Khách kiểm thử.*HCM-02-4M-001/ }),
    );
    await user.click(screen.getByRole("button", { name: "Giao công việc" }));
    await waitFor(() =>
      expect(calls.create).toHaveBeenCalledWith(
        expect.objectContaining({ referenceType: "BOOKING", referenceId: booking.id }),
      ),
    );
    expect(calls.bookings).toHaveBeenCalledWith(facilityId);
  });

  it("excludes inactive staff and units belonging to another facility", async () => {
    const user = setup();
    await chooseStaff(user);
    await user.click(screen.getByRole("button", { name: "Nhân viên được giao" }));
    expect(screen.queryByRole("option", { name: /ngừng hoạt động/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Nhân viên được giao" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Ô kho cần kiểm tra" })).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: "Ô kho cần kiểm tra" }));
    expect(screen.queryByRole("option", { name: /OTHER-UNIT/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Giao công việc" })).toBeDisabled();
  });

  it("distinguishes a failed unit request from an empty list and supports retry", async () => {
    calls.units.mockRejectedValueOnce(new Error("network"));
    const user = setup();
    await screen.findByText("Không thể tải danh sách để giao việc. Vui lòng thử lại.");
    expect(screen.queryByText("Cơ sở chưa có ô kho để giao kiểm tra.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Giao công việc" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Thử lại" }));
    await chooseStaff(user);
    await chooseUnit(user);
    expect(screen.getByRole("button", { name: "Giao công việc" })).toBeEnabled();
  });

  it("blocks assignment when no active staff or units are available", async () => {
    calls.staff.mockResolvedValue([]);
    calls.units.mockResolvedValue({ items: [], total: 0, limit: 100, offset: 0 });
    setup();
    await screen.findByText("Cơ sở chưa có nhân viên đang hoạt động để giao việc.");
    await screen.findByText("Cơ sở chưa có ô kho để giao kiểm tra.");
    expect(screen.getByRole("button", { name: "Giao công việc" })).toBeDisabled();
    expect(calls.create).not.toHaveBeenCalled();
  });
});
