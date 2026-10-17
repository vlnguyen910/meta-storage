import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { routes } from "@/config/routes";
import { useLogout } from "./use-logout";

const mocks = vi.hoisted(() => ({ logout: vi.fn(), clearSession: vi.fn(), replace: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: { auth: { logout: mocks.logout } } }));
vi.mock("./auth-store", () => ({
  useAuthStore: { getState: () => ({ clearSession: mocks.clearSession }) },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));

function setup() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  client.setQueryData(["session-sample"], "private-cache");
  const hook = renderHook(() => useLogout(), {
    wrapper: ({ children }: PropsWithChildren) =>
      createElement(QueryClientProvider, { client }, children),
  });
  return { ...hook, client };
}

describe("shared logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.logout.mockResolvedValue(undefined);
  });
  it("clears session and cached private data, then redirects after logout succeeds", async () => {
    const { result, client } = setup();
    await act(async () => {
      await result.current.mutateAsync();
    });
    expect(mocks.logout).toHaveBeenCalledOnce();
    expect(mocks.clearSession).toHaveBeenCalledOnce();
    expect(client.getQueryData(["session-sample"])).toBeUndefined();
    expect(mocks.replace).toHaveBeenCalledWith(routes.login);
  });
  it("keeps the current session and cached data when logout fails so users can retry", async () => {
    mocks.logout.mockRejectedValue(new Error("Mock logout failure"));
    const { result, client } = setup();
    await act(async () => {
      await result.current.mutateAsync().catch(() => undefined);
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mocks.clearSession).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(client.getQueryData(["session-sample"])).toBe("private-cache");
  });
});
