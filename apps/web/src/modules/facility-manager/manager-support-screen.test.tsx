import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ManagerSupportScreen } from "./manager-support-screen";

const calls = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn() }));
vi.mock("@/lib/api", () => ({
  api: { support: { facilityList: calls.list, facilityDetail: calls.detail } },
}));
vi.mock("./manager-tab-frame", () => ({
  ManagerTabFrame: ({ children }: { children: (id: string) => ReactNode }) =>
    children("facility-2"),
}));
vi.mock("./use-manager-tabs", () => ({
  useManagerKey: () => ["manager-tabs", "manager", "FACILITY_MANAGER"],
}));
const ticket = {
  id: "40000000-0000-4000-8000-000000000001",
  subject: "Khóa kho bị kẹt",
  category: "LOCK",
  status: "OPEN",
  description: "Không mở được khóa kho.",
  createdAt: "2026-11-08T03:15:50.705Z",
  customer: { name: "Khách hàng HCM-02", email: "customer@example.test", phone: "0901234567" },
  unitCode: "HCM-02-001",
  bookingCode: null,
};
const clients: QueryClient[] = [];
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  render(
    <QueryClientProvider client={client}>
      <ManagerSupportScreen />
    </QueryClientProvider>,
  );
}
beforeEach(() => vi.resetAllMocks());
afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) client.clear();
});

it("loads facility tickets and reads the persisted description when opening details", async () => {
  calls.list.mockResolvedValue({ items: [ticket], nextCursor: null });
  calls.detail.mockResolvedValue(ticket);
  mount();
  expect((await screen.findAllByText(ticket.subject))[0]).toBeVisible();
  expect(screen.getAllByText(ticket.customer.name)[0]).toBeVisible();
  expect(screen.getByText("Đã tải 1 yêu cầu")).toBeVisible();
  expect(screen.getByText("08/11/2026")).toBeVisible();
  expect(calls.list).toHaveBeenCalledWith(
    "facility-2",
    expect.objectContaining({ limit: 20 }),
    expect.any(AbortSignal),
  );
  const opener = within(screen.getByRole("table")).getByRole("button", {
    name: `Xem chi tiết: ${ticket.subject}`,
  });
  fireEvent.click(opener);
  expect(
    await within(await screen.findByRole("dialog")).findByText(ticket.description),
  ).toBeVisible();
  expect(calls.detail).toHaveBeenCalledWith("facility-2", ticket.id, expect.any(AbortSignal));
  expect(screen.queryByRole("button", { name: /Phân công|Đóng phiếu/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Đóng" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(opener).toHaveFocus();
  expect(screen.getByText("Đã tải 1 yêu cầu")).toBeVisible();
});

it("passes a submitted search to the API instead of filtering only the loaded page", async () => {
  calls.list.mockResolvedValue({ items: [ticket], nextCursor: null });
  mount();
  await screen.findAllByText(ticket.subject);
  fireEvent.change(screen.getByRole("textbox", { name: "Tìm yêu cầu hỗ trợ" }), {
    target: { value: "  Khóa kho  " },
  });
  fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));
  await waitFor(() =>
    expect(calls.list).toHaveBeenLastCalledWith(
      "facility-2",
      expect.objectContaining({ search: "Khóa kho", cursor: undefined }),
      expect.any(AbortSignal),
    ),
  );
});

it("loads the next cursor page without replacing previously loaded requests", async () => {
  calls.list.mockResolvedValueOnce({ items: [ticket], nextCursor: "next" });
  calls.list.mockResolvedValue({
    items: [{ ...ticket, id: "40000000-0000-4000-8000-000000000002", subject: "Phiếu trước đó" }],
    nextCursor: null,
  });
  mount();
  fireEvent.click(await screen.findByRole("button", { name: "Tải thêm yêu cầu" }));
  expect((await screen.findAllByText("Phiếu trước đó"))[0]).toBeVisible();
  expect(screen.getAllByText(ticket.subject)[0]).toBeVisible();
  expect(calls.list).toHaveBeenLastCalledWith(
    "facility-2",
    expect.objectContaining({ cursor: "next" }),
    expect.any(AbortSignal),
  );
});

it("shows failures as errors and offers retry before showing an empty result", async () => {
  calls.list.mockRejectedValueOnce(new Error("Unavailable"));
  calls.list.mockResolvedValue({ items: [], nextCursor: null });
  mount();
  expect(await screen.findByText("Không tải được dữ liệu. Vui lòng thử lại.")).toBeVisible();
  expect(screen.queryByText("Chưa có yêu cầu hỗ trợ phù hợp")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Thử lại/ }));
  expect(await screen.findByText("Chưa có yêu cầu hỗ trợ phù hợp")).toBeVisible();
});

it("keeps the submitted search and list visible while opening and closing a detail sheet", async () => {
  calls.list.mockResolvedValue({ items: [ticket], nextCursor: null });
  calls.detail.mockResolvedValue(ticket);
  mount();
  await screen.findAllByText(ticket.subject);
  const input = screen.getByRole("textbox", { name: "Tìm yêu cầu hỗ trợ" });
  fireEvent.change(input, { target: { value: "Khóa kho" } });
  fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));
  await waitFor(() =>
    expect(calls.list).toHaveBeenLastCalledWith(
      "facility-2",
      expect.objectContaining({ search: "Khóa kho" }),
      expect.any(AbortSignal),
    ),
  );
  await screen.findAllByText(ticket.subject);
  fireEvent.click(
    within(screen.getByRole("table")).getByRole("button", {
      name: `Xem chi tiết: ${ticket.subject}`,
    }),
  );
  expect(await screen.findByRole("dialog")).toBeVisible();
  expect(input).toHaveValue("Khóa kho");
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(screen.getByRole("textbox", { name: "Tìm yêu cầu hỗ trợ" })).toHaveValue("Khóa kho");
});
