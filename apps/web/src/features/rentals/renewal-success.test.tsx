import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { ToastContext } from "@/components/ui/toast";
import { RenewalScreen } from "./renewal-screen";

const calls = vi.hoisted(() => ({
  rental: vi.fn(),
  get: vi.fn(),
  list: vi.fn(),
  status: vi.fn(),
  toast: vi.fn(),
  quote: vi.fn(),
}));
vi.mock("@/lib/api", () => ({
  api: {
    rentals: { get: calls.rental },
    renewals: { get: calls.get, list: calls.list, quote: calls.quote },
    payments: { status: calls.status },
  },
}));
vi.mock("@/features/returns/use-flow3-identity", () => ({ useFlow3Identity: () => "customer" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
const rentalId = "85000000-0000-4000-8000-000000000005";
const renewalId = "86000000-0000-4000-8000-000000000005";
const renewal = {
  id: renewalId,
  rentalId,
  paymentId: "payment",
  status: "PENDING_PAYMENT",
  oldEndAt: "2031-01-01T00:00:00Z",
  newEndAt: "2031-01-31T00:00:00Z",
  expiresAt: "2030-12-01T00:00:00Z",
  months: 1,
  monthlyRateSnapshot: "900000",
  amount: "900000",
};
beforeEach(() => {
  vi.resetAllMocks();
  calls.rental.mockResolvedValue({
    status: "ACTIVE",
    unitType: { name: "Kho tiêu chuẩn" },
    storageUnit: { code: "HCM-01-023" },
    facility: { address: "TP. Hồ Chí Minh" },
    endAt: renewal.oldEndAt,
    renewalWindow: { canRequest: true },
  });
  calls.list.mockResolvedValue({ items: [], total: 0 });
  calls.get.mockResolvedValue(renewal);
  calls.status.mockResolvedValue({ status: "SUCCEEDED" });
});
function setup(selectedRenewalId: string | null = renewalId) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <ToastContext.Provider value={{ showToast: calls.toast }}>
        <RenewalScreen rentalId={rentalId} renewalId={selectedRenewalId} />
      </ToastContext.Provider>
    </QueryClientProvider>,
  );
  return { client, ...view };
}
it("announces success once only after the renewal is applied, even if payment succeeded earlier", async () => {
  const user = userEvent.setup();
  const { client } = setup();
  await screen.findByRole("heading", { name: "Chờ xác nhận thanh toán" });
  await waitFor(() => expect(calls.status).toHaveBeenCalled());
  expect(calls.toast).not.toHaveBeenCalled();
  expect(screen.queryByText("Gia hạn kho thành công")).not.toBeInTheDocument();
  const applied = { ...renewal, status: "APPLIED" };
  calls.get.mockResolvedValue(applied);
  await user.click(screen.getByRole("button", { name: "Kiểm tra trạng thái" }));
  expect(await screen.findByRole("heading", { name: "Gia hạn kho thành công" })).toBeVisible();
  expect(screen.getByText("Hạn thuê trước gia hạn")).toBeVisible();
  expect(screen.getByRole("link", { name: "Xem kỳ thuê đã cập nhật" })).toHaveAttribute(
    "href",
    `/customer/storage/${rentalId}`,
  );
  expect(calls.toast).toHaveBeenCalledExactlyOnceWith(
    "Kỳ thuê đã được gia hạn thành công.",
    "success",
  );
  await act(async () => {
    client.setQueryData(["renewal", "customer", rentalId, renewalId], { ...applied });
  });
  expect(calls.toast).toHaveBeenCalledTimes(1);
  expect(calls.get).toHaveBeenCalledWith(rentalId, renewalId);
});
it("previews a 30-day month selection and requests a quote for the selected duration", async () => {
  const user = userEvent.setup();
  calls.quote.mockResolvedValue({ ...renewal, status: "QUOTED" });
  setup(null);
  await screen.findByRole("group", { name: "Số tháng gia hạn" });
  await user.click(screen.getByRole("radio", { name: "3 tháng" }));
  expect(screen.getByRole("radio", { name: "3 tháng" })).toBeChecked();
  expect(screen.getByText("07:00 1 thg 4, 2031")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Xem báo giá" }));
  await waitFor(() =>
    expect(calls.quote).toHaveBeenCalledWith(rentalId, expect.objectContaining({ months: 3 })),
  );
});
it("keeps a refund-required renewal out of the success state", async () => {
  calls.get.mockResolvedValue({ ...renewal, status: "REFUND_REQUIRED" });
  setup();
  await screen.findByRole("heading", { name: "Cần hoàn tiền" });
  expect(screen.queryByText("Gia hạn kho thành công")).not.toBeInTheDocument();
  expect(calls.toast).not.toHaveBeenCalled();
});
