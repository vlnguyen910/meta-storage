import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAdminData } from "@/features/administration/use-admin-data";
import { useOperationsWorkspace } from "./use-operations-workspace";

// FM/Staff use live APIs, while the existing BOM/Admin prototypes remain independent.
vi.mock("@/config/api-mode", () => ({ isMockMode: false }));
afterEach(cleanup);
describe("independent workspaces in API mode", () => {
  it("loads the existing BOM prototype without the Flow 2 API-mode gate", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useOperationsWorkspace(), { wrapper });
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
    expect(result.current.query.data?.facilities.length).toBeGreaterThan(0);
  });
  it("loads Admin prototype data without coupling it to FM/Staff backend state", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useAdminData(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.users.length).toBeGreaterThan(0);
  });
});
