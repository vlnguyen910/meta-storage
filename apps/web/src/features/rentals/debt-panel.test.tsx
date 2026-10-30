import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { DebtPanel, SettlementSummary } from "./debt-panel";

const mocks = vi.hoisted(() => ({
  role: "FACILITY_STAFF",
  list: vi.fn(),
  get: vi.fn(),
  collect: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ api: { debts: mocks } }));
vi.mock("@/features/auth/auth-store", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ session: { user: { id: "actor", role: mocks.role } } }),
}));
const debt = {
  id: "debt",
  rentalId: "rental",
  customerId: "customer",
  customerName: "Khách thử",
  unitCode: "A01",
  originalAmount: "50000",
  paidAmount: "0",
  remainingAmount: "50000",
  status: "UNPAID",
  currency: "VND",
  createdAt: "2026-10-30T02:00:00Z",
};
function view() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      <DebtPanel />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.role = "FACILITY_STAFF";
  mocks.list.mockResolvedValue({ items: [debt], total: 1, limit: 10, offset: 0 });
  mocks.get.mockResolvedValue({ ...debt, payments: [] });
});
test("Staff retries a failed receipt with the same idempotency key", async () => {
  mocks.collect.mockRejectedValueOnce(new Error("Network uncertain")).mockResolvedValueOnce({
    ...debt,
    status: "PARTIALLY_PAID",
    paidAmount: "20000",
    remainingAmount: "30000",
    payments: [],
  });
  const user = userEvent.setup();
  view();
  await user.click(await screen.findByRole("button", { name: "Xem lịch sử / ghi nhận khoản thu" }));
  await user.type(await screen.findByLabelText("Số tiền đã nhận (VND)"), "20000");
  await user.click(screen.getByRole("button", { name: "Xác nhận đã nhận tiền" }));
  await screen.findByRole("alert");
  await user.click(screen.getByRole("button", { name: "Xác nhận đã nhận tiền" }));
  await waitFor(() => expect(mocks.collect).toHaveBeenCalledTimes(2));
  expect(mocks.collect.mock.calls[0]?.[1]).toEqual(mocks.collect.mock.calls[1]?.[1]);
  expect(mocks.collect.mock.calls[0]?.[1]).toMatchObject({
    amount: 20000,
    method: "CASH",
    idempotencyKey: expect.any(String),
  });
});
test.each(["FACILITY_MANAGER", "CUSTOMER"])(
  "%s can read debt history without collecting",
  async (role) => {
    mocks.role = role;
    const user = userEvent.setup();
    view();
    await user.click(await screen.findByRole("button", { name: "Xem lịch sử" }));
    await screen.findByText("Chưa ghi nhận khoản thu nào.");
    expect(screen.queryByLabelText("Số tiền đã nhận (VND)")).not.toBeInTheDocument();
  },
);
test("settlement remains visible when refund and debt are zero", () => {
  render(
    <SettlementSummary
      settlement={{
        id: "settlement",
        inspectionId: "inspection",
        depositAmount: "100000",
        deductionAmount: "100000",
        refundAmount: "0",
        debtAmount: "0",
        currency: "VND",
        settledBy: "staff",
        settledAt: "2026-10-30T02:00:00Z",
      }}
    />,
  );
  expect(screen.getByText("Quyết toán trả kho")).toBeInTheDocument();
  expect(screen.getByText("Tiền hoàn")).toBeInTheDocument();
  expect(screen.getByText("Công nợ phát sinh")).toBeInTheDocument();
});
