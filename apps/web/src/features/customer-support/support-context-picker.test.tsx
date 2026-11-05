import type { SupportBookingContext } from "@metastorage/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { SupportContextPicker, supportContextText } from "./support-context-picker";

const calls = vi.hoisted(() => ({ contexts: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: { support: { contexts: calls.contexts } } }));
vi.mock("@/features/returns/use-flow3-identity", () => ({ useFlow3Identity: () => "customer" }));
const item: SupportBookingContext = {
  id: "84000000-0000-4000-8000-000000000001",
  bookingCode: "84000000",
  status: "CHECKED_IN",
  facility: { id: "facility", name: "Bến Thành" },
  unitType: { id: "type", name: "Kho 1 m²" },
  checkInDate: "2026-11-04",
  createdAt: "2026-11-03T00:00:00Z",
  rentalId: "rental",
  rentalStatus: "ACTIVE",
  storageUnitCode: "HCM-02-UT-1M-002",
  startAt: "2026-11-04T00:00:00Z",
  endAt: "2027-02-04T00:00:00Z",
};
function mount(category: "PAYMENT" | "UNIT" = "UNIT", value = item.id) {
  const change = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <SupportContextPicker category={category} value={value} onChange={change} />
    </QueryClientProvider>,
  );
  return change;
}
beforeEach(() => {
  vi.resetAllMocks();
  calls.contexts.mockResolvedValue({ items: [item], nextCursor: null });
});
it("shows the actual unit, rental dates and translated state instead of a repeated booking prefix", async () => {
  mount();
  expect(await screen.findByText("HCM-02-UT-1M-002 · Bến Thành")).toBeVisible();
  expect(screen.getByText(/04\/11\/2026 – 04\/02\/2027 · Đang thuê/)).toBeVisible();
  expect(screen.getByRole("combobox", { name: /Kỳ thuê/ })).toBeVisible();
  expect(
    supportContextText({ ...item, id: "84000000-0000-4000-8000-000000000002" }).reference,
  ).not.toBe(supportContextText(item).reference);
});
it("keeps payment help available before handover and applies search to the server query", async () => {
  mount("PAYMENT", "");
  expect(screen.getByRole("combobox", { name: /Đặt chỗ \/ Kỳ thuê liên quan/ })).toBeVisible();
  await waitFor(() => expect(calls.contexts).toHaveBeenCalled());
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Bến Thành" } });
  fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Enter" });
  await waitFor(() =>
    expect(calls.contexts).toHaveBeenLastCalledWith(
      { category: "PAYMENT", search: "Bến Thành", limit: 20, cursor: undefined },
      expect.any(AbortSignal),
    ),
  );
});
it("loads subsequent server pages without losing the selected rental label", async () => {
  calls.contexts
    .mockResolvedValueOnce({ items: [item], nextCursor: "page-2" })
    .mockResolvedValueOnce({
      items: [
        { ...item, id: "84000000-0000-4000-8000-000000000002", storageUnitCode: "HCM-02-002" },
      ],
      nextCursor: null,
    });
  mount();
  fireEvent.click(await screen.findByRole("button", { name: "Tải thêm" }));
  await waitFor(() =>
    expect(calls.contexts).toHaveBeenLastCalledWith(
      { category: "UNIT", search: undefined, limit: 20, cursor: "page-2" },
      expect.any(AbortSignal),
    ),
  );
  expect(screen.getByText("HCM-02-UT-1M-002 · Bến Thành")).toBeVisible();
});
it("shows a useful empty state", async () => {
  calls.contexts.mockResolvedValue({ items: [], nextCursor: null });
  mount("UNIT", "");
  expect(await screen.findByText("Không tìm thấy kỳ thuê phù hợp.")).toBeVisible();
});
