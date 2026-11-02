import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import { useBooking, useEligibleUnits } from "./hooks";

const { load, list } = vi.hoisted(() => ({ load: vi.fn(), list: vi.fn() }));
vi.mock("@/features/facility-flow/use-dispatch", () => ({ loadAppointmentItem: load }));
vi.mock("@/lib/api", () => ({ api: { flow5: { units: { list } } } }));
it("shares the appointment read and reloads units when its type changes", async () => {
  const item = {
    id: "appointment",
    facilityId: "facility",
    unitTypeId: "type-a",
    assignedUnit: null,
  };
  load.mockResolvedValue(item);
  list.mockResolvedValue({ items: [], total: 0 });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, unmount } = renderHook(
    () => {
      const appointment = useBooking("appointment");
      return useEligibleUnits(appointment.data);
    },
    { wrapper },
  );
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(load).toHaveBeenCalledTimes(1);
  client.setQueryData(["bookings", "detail", "appointment"], { ...item, unitTypeId: "type-b" });
  await waitFor(() =>
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ unitTypeId: "type-b" })),
  );
  unmount();
  client.clear();
});
