import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { RentalDetail } from "./rental-detail";

const calls = vi.hoisted(() => ({
  get: vi.fn(),
  payments: vi.fn(),
  appointments: vi.fn(),
  slots: vi.fn(),
  create: vi.fn(),
  renewals: vi.fn(),
}));
vi.mock("@/lib/api", () => ({
  api: {
    rentals: { get: calls.get },
    rentalPayments: calls.payments,
    renewals: { list: calls.renewals },
    appointments: { mine: calls.appointments, slots: calls.slots, create: calls.create },
  },
}));
vi.mock("@/features/returns/use-flow3-identity", () => ({ useFlow3Identity: () => "customer" }));
const rentalId = "85000000-0000-4000-8000-000000000005";
const slotId = "87000000-0000-4000-8000-000000000005";
beforeEach(() => {
  vi.resetAllMocks();
  calls.get.mockResolvedValue({
    id: rentalId,
    status: "ACTIVE",
    bookingStatus: "CHECKED_IN",
    bookingCode: "SX-TEST",
    reservationId: "reservation",
    unitType: { name: "Kho tiêu chuẩn", sizeLabel: "4 m²" },
    storageUnit: { code: "HCM-01-012" },
    facility: { name: "Cơ sở kiểm thử", address: "TP. Hồ Chí Minh" },
    startAt: "2026-01-01T00:00:00Z",
    endAt: "2031-04-29T00:00:00Z",
    renewalWindow: { canRequest: true },
  });
  calls.appointments.mockResolvedValue([]);
  calls.payments.mockResolvedValue([
    {
      id: "payment",
      type: "CHARGE",
      paymentCode: "PAY-TEST",
      status: "SUCCEEDED",
      totalAmount: "900000",
      createdAt: "2026-10-30T00:00:00Z",
      paidAt: "2026-10-30T00:00:00Z",
    },
  ]);
  calls.slots.mockResolvedValue([
    { id: slotId, name: "Ca sáng", startTime: "09:00:00", endTime: "10:00:00" },
  ]);
  calls.create.mockResolvedValue({ id: "appointment", status: "SCHEDULED" });
});
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <RentalDetail rentalId={rentalId} />
    </QueryClientProvider>,
  );
}
it("shows only the rental's transactions below its details and keeps renewal inside the rental card", async () => {
  setup();
  await screen.findByText("PAY-TEST");
  expect(calls.payments).toHaveBeenCalledWith(rentalId, expect.any(AbortSignal));
  expect(calls.renewals).not.toHaveBeenCalled();
  expect(screen.queryByRole("heading", { name: "Lịch sử gia hạn" })).not.toBeInTheDocument();
  const renewal = screen.getByRole("link", { name: "Gia hạn kỳ thuê" });
  expect(renewal.closest("section")).toHaveTextContent("HCM-01-012");
  expect(renewal).toHaveAttribute("href", `/customer/storage/${rentalId}/renew`);
  expect(screen.getByRole("heading", { name: "Lịch sử giao dịch của kỳ thuê" })).toBeVisible();
});
it("keeps the date and slot request payload and the early-return confirmation in the redesigned dialog", async () => {
  const user = userEvent.setup();
  setup();
  await user.click(await screen.findByRole("button", { name: "Hẹn trả kho" }));
  const dialog = screen.getByRole("dialog", { name: "Hẹn trả kho" });
  await within(dialog).findByRole("button", { name: /09:00.*10:00/ });
  expect(within(dialog).getByRole("button", { name: /09:00.*10:00/ })).toBeDisabled();
  await user.click(within(dialog).getByRole("button", { name: "Ngày mai" }));
  await user.click(within(dialog).getByRole("button", { name: /09:00.*10:00/ }));
  await user.click(within(dialog).getByRole("button", { name: "Xác nhận lịch trả" }));
  expect(calls.create).not.toHaveBeenCalled();
  const confirmation = await screen.findByRole("alertdialog", { name: "Xác nhận trả kho sớm" });
  await user.click(within(confirmation).getByRole("button", { name: "Xác nhận trả sớm" }));
  await waitFor(() =>
    expect(calls.create).toHaveBeenCalledWith({
      appointmentType: "CHECK_OUT",
      rentalId,
      scheduledDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      slotId,
    }),
  );
});
