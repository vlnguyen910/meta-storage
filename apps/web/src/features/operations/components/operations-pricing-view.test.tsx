import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { OperationsPricingView } from "./operations-pricing-view";

vi.mock("@/lib/api", () => ({
  api: {
    pricing: {
      getConfiguration: vi.fn(),
      getHistory: vi.fn(),
      updateUnitTypePrice: vi.fn(),
      updateDepositPolicy: vi.fn(),
    },
  },
}));

function mockPricesData() {
  return {
    version: 1,
    depositMonths: 2,
    updatedBy: null,
    updatedAt: "2026-10-28T14:13:00Z",
    prices: Array.from({ length: 12 }, (_, i) => ({
      unitTypeId: `unit-type-${i + 1}`,
      facilityId: "fac-1",
      priceRangeId: `range-${i + 1}`,
      code: `UT-${i + 1}M`,
      name: `Kho tiêu chuẩn (${i + 1} m²)`,
      monthlyPrice: (i + 1) * 500000,
      isActive: i !== 5,
    })),
  };
}

function renderComponent() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<OperationsPricingView />, { wrapper: Wrapper });
}

describe("OperationsPricingView", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(api.pricing.getConfiguration).mockResolvedValue(mockPricesData());
  });

  it("renders pricing configuration card, search bar, table and pagination", async () => {
    renderComponent();

    expect(await screen.findByText("Cấu hình giá và tiền cọc")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Làm mới bảng giá" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Tìm tên hoặc mã loại kho")).toBeInTheDocument();

    // With 12 items and pageSize 5, page 1 displays 5 items: Kho tiêu chuẩn (1 m²) to (5 m²)
    expect(screen.getByText("Kho tiêu chuẩn (1 m²)")).toBeInTheDocument();
    expect(screen.getByText("Kho tiêu chuẩn (5 m²)")).toBeInTheDocument();
    expect(screen.queryByText("Kho tiêu chuẩn (6 m²)")).not.toBeInTheDocument();

    // Pagination summary: 1 - 5 / 12
    expect(screen.getByText(/Hiển thị/)).toBeInTheDocument();
    expect(screen.getAllByText("12").length).toBeGreaterThanOrEqual(1);
  });

  it("navigates pages using next and previous buttons", async () => {
    const user = userEvent.setup();
    renderComponent();

    await screen.findByText("Kho tiêu chuẩn (1 m²)");

    // Click next page button "Sau"
    const nextBtn = screen.getByRole("button", { name: "Trang sau" });
    await user.click(nextBtn);

    // Page 2 should display items 6 to 10
    expect(screen.getByText("Kho tiêu chuẩn (6 m²)")).toBeInTheDocument();
    expect(screen.getByText("Kho tiêu chuẩn (10 m²)")).toBeInTheDocument();
    expect(screen.queryByText("Kho tiêu chuẩn (1 m²)")).not.toBeInTheDocument();

    // Click previous button "Trước"
    const prevBtn = screen.getByRole("button", { name: "Trang trước" });
    await user.click(prevBtn);

    expect(screen.getByText("Kho tiêu chuẩn (1 m²)")).toBeInTheDocument();
  });

  it("supports jumping directly to a page via the jump input", async () => {
    const user = userEvent.setup();
    renderComponent();

    await screen.findByText("Kho tiêu chuẩn (1 m²)");

    // Type page 3 into jump input
    const jumpInput = screen.getByPlaceholderText("1");
    await user.type(jumpInput, "3");

    // Click jump button "Đi"
    const jumpBtn = screen.getByRole("button", { name: "Đi" });
    await user.click(jumpBtn);

    // Page 3 has items 11 and 12
    expect(screen.getByText("Kho tiêu chuẩn (11 m²)")).toBeInTheDocument();
    expect(screen.getByText("Kho tiêu chuẩn (12 m²)")).toBeInTheDocument();
    expect(screen.queryByText("Kho tiêu chuẩn (1 m²)")).not.toBeInTheDocument();
  });

  it("filters items by name or code when searching", async () => {
    const user = userEvent.setup();
    renderComponent();

    await screen.findByText("Kho tiêu chuẩn (1 m²)");

    const searchInput = screen.getByPlaceholderText("Tìm tên hoặc mã loại kho");
    await user.type(searchInput, "UT-7M");

    expect(screen.getByText("Kho tiêu chuẩn (7 m²)")).toBeInTheDocument();
    expect(screen.getByText("UT-7M")).toBeInTheDocument();
    expect(screen.queryByText("Kho tiêu chuẩn (1 m²)")).not.toBeInTheDocument();
  });
});
