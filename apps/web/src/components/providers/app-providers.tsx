"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useEffect, useState } from "react";
import { LOADING_MESSAGES } from "@/components/ui/loading.messages";
import { FullScreenLoading } from "@/components/ui/states";
import { ToastProvider } from "@/components/ui/toast";
import { isMockMode } from "@/config/api-mode";
import { useAuthStore } from "@/features/auth/auth-store";
import { PrivateDataBoundary } from "@/features/returns/private-data-boundary";
import { api } from "@/lib/api";
import { installMockApi } from "@/mocks/install-mock-api";
import { GlobalActivityIndicator } from "./global-activity-indicator";
import { GlobalLoadingProvider } from "./global-loading-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
          mutations: { retry: false },
        },
      }),
  );
  const [ready, setReady] = useState(!isMockMode);

  useEffect(() => {
    if (isMockMode) {
      installMockApi(api.http);
      const { session, clearSession } = useAuthStore.getState();
      if (session && !("accessToken" in session)) clearSession();
      useAuthStore.getState().setAuthReady(true);
      setReady(true);
      return;
    }

    const { clearSession, setSession, setAuthReady } = useAuthStore.getState();
    clearSession();
    setAuthReady(false);
    api.auth
      .me()
      .then((user) => setSession({ user }))
      .catch(() => clearSession())
      .finally(() => setAuthReady(true));
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <PrivateDataBoundary />
      <ToastProvider>
        <GlobalLoadingProvider>
          <GlobalActivityIndicator />
          {ready ? children : <FullScreenLoading label={LOADING_MESSAGES.app} />}
        </GlobalLoadingProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
