import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ReservationReceipt } from "./reservation-receipt";

const { state } = vi.hoisted(() => ({ state: { value: {} as Record<string, unknown> } }));
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
