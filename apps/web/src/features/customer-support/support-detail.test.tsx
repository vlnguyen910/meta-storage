import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { CustomerSupportDetail } from "./support-screens";

const calls = vi.hoisted(() => ({ detail: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: { support: { detail: calls.detail } } }));
vi.mock("@/features/returns/use-flow3-identity", () => ({ useFlow3Identity: () => "customer" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => vi.resetAllMocks());
it("shows the persisted description using only the supported detail endpoint", async () => {
  calls.detail.mockResolvedValue({
    ticket: {
      id: "ticket",
      category: "LOCK",
      subject: "Khóa cửa bị kẹt",
      description: "Chìa khóa không mở được cửa kho.",
      status: "OPEN",
      createdAt: "2026-10-29T00:00:00Z",
    },
    messages: { items: [], nextCursor: null },
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CustomerSupportDetail ticketId="ticket" />
    </QueryClientProvider>,
  );
  expect(await screen.findByText("Chìa khóa không mở được cửa kho.")).toBeVisible();
  expect(screen.getByText(/Đội ngũ hỗ trợ sẽ liên hệ qua email/)).toBeVisible();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /phản hồi|đính kèm/i })).not.toBeInTheDocument();
  expect(calls.detail).toHaveBeenCalledWith("ticket", expect.any(AbortSignal));
});
