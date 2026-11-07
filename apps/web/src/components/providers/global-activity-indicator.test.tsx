import { QueryClient, QueryClientProvider, useMutation } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { LOADING_MESSAGES } from "@/components/ui/loading.messages";
import { GlobalActivityIndicator } from "./global-activity-indicator";
import { GlobalLoadingProvider } from "./global-loading-provider";

let resolveMutation: (() => void) | undefined;

function MutationTrigger({ isBlocking }: { isBlocking: boolean }) {
  const mutation = useMutation({
    mutationFn: () =>
      new Promise<void>((resolve) => {
        resolveMutation = resolve;
      }),
    meta: isBlocking ? { globalLoading: true } : undefined,
  });

  return (
    <button type="button" onClick={() => mutation.mutate()}>
      Start operation
    </button>
  );
}

function renderWithLoading(isBlocking: boolean) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <GlobalLoadingProvider>{children}</GlobalLoadingProvider>
    </QueryClientProvider>
  );
  const view = render(
    <>
      <GlobalActivityIndicator />
      <MutationTrigger isBlocking={isBlocking} />
    </>,
    { wrapper },
  );

  return { client, ...view };
}

afterEach(() => {
  resolveMutation = undefined;
});

describe("GlobalActivityIndicator", () => {
  it("shows the full-screen loading state for blocking writes and clears when they settle", async () => {
    const { client } = renderWithLoading(true);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Start operation" }));
      await Promise.resolve();
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    expect(
      await screen.findByRole("status", { name: LOADING_MESSAGES.processing }),
    ).toBeInTheDocument();

    await act(async () => resolveMutation?.());
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    client.clear();
  });

  it("does not cover the screen for unmarked non-blocking mutations", async () => {
    const { client } = renderWithLoading(false);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Start operation" }));
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    await act(async () => resolveMutation?.());
    act(() => client.clear());
  });
});
