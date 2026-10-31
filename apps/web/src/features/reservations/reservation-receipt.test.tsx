import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import QRCode from "qrcode";
import { beforeEach, expect, it, vi } from "vitest";
import { ReservationReceipt } from "./reservation-receipt";

const { state } = vi.hoisted(() => ({ state: { value: {} as Record<string, unknown> } }));
vi.mock("@/config/api-mode", () => ({ isMockMode: false }));
vi.mock("next/navigation", () => ({ usePathname: () => "/customer/payments/result" }));
vi.mock("qrcode", () => ({
  default: { toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,test") },
}));
vi.mock("./reservation.hooks", () => ({ useReservationRecord: () => state.value }));

beforeEach(() => {
  state.value = {
    reservation: { isPending: false, isError: false },
    record: {
      id: "reservation",
      status: "CONFIRMED",
      facilityId: "facility",
      unitTypeId: "type",
      rentalStartAt: "2030-06-01T02:00:00Z",
      rentalEndAt: "2030-07-01T02:00:00Z",
      depositAmount: 1000000,
      totalAmount: 2000000,
    },
    appointments: { isSuccess: true, isPending: false },
    appointment: undefined,
    slots: [{ id: "slot", name: "Sáng", startTime: "09:00", endTime: "10:00" }],
    createAppointment: { mutate: vi.fn(), isError: false },
    cancel: { mutate: vi.fn() },
  };
});

it("creates the receiving appointment once after confirmation, and allows retry after failure", async () => {
  const mutation = state.value.createAppointment as {
    mutate: ReturnType<typeof vi.fn>;
    isError: boolean;
    error?: Error;
  };
  const view = render(<ReservationReceipt reservationId="reservation" />);
  await waitFor(() => expect(mutation.mutate).toHaveBeenCalledExactlyOnceWith("slot"));
  mutation.isError = true;
  mutation.error = new Error("Appointment service unavailable");
  view.rerender(<ReservationReceipt reservationId="reservation" />);
  expect(mutation.mutate).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Tạo lịch hẹn nhận kho" }));
  expect(mutation.mutate).toHaveBeenCalledTimes(2);
});

it("does not create another appointment when one exists or payment is unconfirmed", () => {
  state.value.appointment = { scheduledDate: "2030-06-01", status: "SCHEDULED" };
  const view = render(<ReservationReceipt reservationId="reservation" />);
  expect((state.value.createAppointment as { mutate: unknown }).mutate).not.toHaveBeenCalled();
  state.value.appointment = undefined;
  (state.value.record as { status: string }).status = "DRAFT";
  view.rerender(<ReservationReceipt reservationId="reservation" />);
  expect((state.value.createAppointment as { mutate: unknown }).mutate).not.toHaveBeenCalled();
});

it("keeps the original success, QR and summary UI while adding the receiving appointment", async () => {
  state.value.appointment = { scheduledDate: "2030-06-01", status: "SCHEDULED" };
  state.value.facility = { name: "Kho Thủ Đức", address: "Thủ Đức, TP.HCM" };
  state.value.unitType = { name: "Kho nhỏ", sizeLabel: "5 m²" };
  (state.value.record as Record<string, unknown>).requestedMonths = 1;
  render(<ReservationReceipt reservationId="reservation" variant="confirmation" />);
  expect(screen.getByRole("heading", { name: "Đặt thuê kho thành công!" })).toBeInTheDocument();
  expect(screen.getByText("Mã xác nhận & QR")).toBeInTheDocument();
  expect(screen.getByText("Kho Thủ Đức")).toBeInTheDocument();
  expect(screen.getByText("Lịch hẹn nhận kho")).toBeInTheDocument();
  expect(screen.queryByText("Xác nhận đã được gửi tới email của bạn.")).not.toBeInTheDocument();
  expect(screen.queryByText("Email xác nhận đang chờ gửi.")).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByAltText("Mã xác nhận & QR")).toBeInTheDocument());
  expect(QRCode.toDataURL).toHaveBeenCalledWith(
    `${window.location.origin}/customer/reservations/reservation`,
    { width: 320, margin: 1 },
  );
});
