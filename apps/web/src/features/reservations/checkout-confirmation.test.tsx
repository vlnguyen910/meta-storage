import type { BookingConfirmation } from "@metastorage/contracts";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CheckoutConfirmation } from "./checkout-confirmation";

vi.mock("@/config/api-mode", () => ({ isMockMode: false }));

const confirmation: BookingConfirmation = {
  bookingId: "11111111-1111-4111-8111-111111111111",
  bookingCode: "STX-DEMO-001",
  qrToken: "test-confirmation-token-for-component-only",
  qrUrl: "https://example.com/check-in/test",
  facility: { name: "Chi nhánh demo", address: "Địa chỉ demo" },
  checkInSlotStart: "2026-10-05T02:00:00.000Z",
  checkInSlotEnd: null,
  rentalEndAt: "2027-01-05T02:00:00.000Z",
  unitTypeName: "Kho tiêu chuẩn",
  sizeLabel: "4 m²",
  durationMonths: 3,
  emailStatus: "QUEUED",
};

afterEach(cleanup);

describe("checkout confirmation", () => {
  it("shows the server booking code and queued email without claiming email was sent", () => {
    render(<CheckoutConfirmation state={{ confirmation, qrDataUrl: null, paidPricing: null }} />);
    expect(screen.getAllByText("STX-DEMO-001")).toHaveLength(2);
    expect(screen.getByText("Email xác nhận đang chờ gửi.")).toBeInTheDocument();
    expect(screen.queryByText("Xác nhận đã được gửi tới email của bạn.")).not.toBeInTheDocument();
    expect(screen.getByText(/Chưa tải được QR/)).toBeInTheDocument();
  });
  it("shows successful email delivery only when reported by the server", () => {
    render(
      <CheckoutConfirmation
        state={{
          confirmation: { ...confirmation, emailStatus: "SENT" },
          qrDataUrl: null,
          paidPricing: null,
        }}
      />,
    );
    expect(screen.getByText("Xác nhận đã được gửi tới email của bạn.")).toBeInTheDocument();
  });
  it("does not show success without a server confirmation", () => {
    const { container } = render(
      <CheckoutConfirmation state={{ confirmation: null, qrDataUrl: null, paidPricing: null }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
