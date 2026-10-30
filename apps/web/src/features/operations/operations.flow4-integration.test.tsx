import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { OperationsPricingView } from "./components/operations-pricing-view";
import { OperationsRulesView } from "./components/operations-rules-view";
import { useOperationsRefunds } from "./hooks/use-operations-refunds";
import { OperationsDepositDraftSchema, OperationsPriceDraftSchema } from "./operations.schema";
import { REPORTING_MESSAGES as R } from "./operations-reporting.messages";

vi.mock("@/lib/api", () => ({
  api: {
    pricing: {
      getConfiguration: vi.fn(),
      getHistory: vi.fn(),
      updateUnitTypePrice: vi.fn(),
      updateDepositPolicy: vi.fn(),
    },
    payments: { listRefunds: vi.fn(), confirmManualRefund: vi.fn() },
  },
}));
let serverVersion = 1;
function configuration() {
  return {
    version: serverVersion,
    depositMonths: serverVersion === 1 ? 2 : 3,
    updatedBy: null,
    updatedAt: "2026-10-20T00:00:00Z",
    prices: [
      {
        unitTypeId: "44000000-0000-4000-8000-000000000080",
        facilityId: "30000000-0000-4000-8000-000000000001",
        priceRangeId: "61000000-0000-4000-8000-000000000001",
        code: "TEST",
        name: "Test type",
        monthlyPrice: 1000000,
        isActive: true,
      },
    ],
  };
}
function harness() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, Wrapper };
}
const conflict = () => ({
  isAxiosError: true,
  response: { status: 409, data: { message: "Conflict" } },
});
beforeEach(() => {
  vi.resetAllMocks();
  serverVersion = 1;
  vi.mocked(api.pricing.getConfiguration).mockImplementation(async () => configuration());
  vi.mocked(api.pricing.getHistory).mockResolvedValue([]);
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(cleanup);

describe("Flow 4 actual form, hook and cache integration", () => {
  it("BOM views prices without a price-edit action or write request", async () => {
    const { Wrapper } = harness();
    render(<OperationsPricingView />, { wrapper: Wrapper });
    await screen.findByText("Test type");
    expect(screen.queryByRole("button", { name: /Chỉnh giá/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(api.pricing.updateUnitTypePrice).not.toHaveBeenCalled();
  });
  it("retains dirty deposit input on background refresh and explicit conflict reload", async () => {
    const user = userEvent.setup();
    const { client, Wrapper } = harness();
    vi.mocked(api.pricing.updateDepositPolicy).mockImplementation(async () => {
      serverVersion = 3;
      throw conflict();
    });
    render(<OperationsRulesView />, { wrapper: Wrapper });
    const input = await screen.findByRole("spinbutton");
    await user.clear(input);
    await user.type(input, "9");
    serverVersion = 2;
    await client.invalidateQueries({ queryKey: ["pricing", "configuration"] });
    expect(input).toHaveValue(9);
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    expect(api.pricing.updateDepositPolicy).toHaveBeenCalledWith({
      expectedVersion: 1,
      depositMonths: 9,
    });
    await user.click(await screen.findByRole("button", { name: "Tải lại dữ liệu mới nhất" }));
    await screen.findByText(R.compareVersion);
    expect(input).toHaveValue(9);
    expect(screen.getByText(R.latestDeposit(3, 3))).toBeInTheDocument();
  });
  it("keeps the last price list visible and reports a failed reload", async () => {
    const user = userEvent.setup();
    const { Wrapper } = harness();
    render(<OperationsPricingView />, { wrapper: Wrapper });
    await screen.findByText("Test type");
    vi.mocked(api.pricing.getConfiguration).mockRejectedValue(new Error("offline"));
    await user.click(screen.getByRole("button", { name: "Làm mới bảng giá" }));
    await screen.findByRole("alert");
    expect(screen.getByText("Test type")).toBeInTheDocument();
    expect(api.pricing.updateUnitTypePrice).not.toHaveBeenCalled();
  });
  it("loads refunds beyond the old 50-row cap through the existing paginated API", async () => {
    const { Wrapper } = harness();
    vi.mocked(api.payments.listRefunds).mockImplementation(async (params) =>
      Array.from({ length: params?.offset ? 55 : 100 }, (_, i) => ({
        paymentId: `payment-${(params?.offset ?? 0) + i}`,
        type: "CHARGE",
        bookingId: null,
        amount: "100",
        paidAt: null,
        depositForfeitedAmount: "0",
        currency: "VND",
        reason: null,
        contactName: null,
        contactEmail: null,
        contactPhone: null,
      })),
    );
    const { result } = renderHook(() => useOperationsRefunds(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.query.data).toHaveLength(155));
    expect(api.payments.listRefunds).toHaveBeenNthCalledWith(2, { offset: 100, limit: 100 });
  });
  it("honors shared integer boundaries instead of accepting values the backend rejects", () => {
    expect(OperationsPriceDraftSchema.safeParse({ monthlyPrice: 2147483648 }).success).toBe(false);
    expect(OperationsDepositDraftSchema.safeParse({ depositMonths: 2147483648 }).success).toBe(
      false,
    );
    expect(OperationsDepositDraftSchema.safeParse({ depositMonths: 36 }).success).toBe(true);
  });
});
