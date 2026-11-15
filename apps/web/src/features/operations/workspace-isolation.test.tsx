import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useOperationsWorkspace } from "./use-operations-workspace";

// The offline operations workspace remains independent of live facility state.
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
});
