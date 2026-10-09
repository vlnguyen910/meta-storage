import { createHttpClient, createMetastorageApiClient } from "@metastorage/api-client";
import { isMockMode } from "@/config/api-mode";
import { authStore } from "@/features/auth/auth-store";

const http = createHttpClient({
  baseURL: isMockMode
    ? "/api"
    : (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api"),
  tokenProvider: {
    getAccessToken: () => {
      const session = authStore.getState().session;
      return session && "accessToken" in session ? session.accessToken : null;
    },
    getRefreshToken: () => {
      const session = authStore.getState().session;
      return session && "refreshToken" in session ? session.refreshToken : null;
    },
    updateTokens: (tokens) => authStore.getState().updateTokens(tokens),
    clearSession: () => authStore.getState().clearSession(),
  },
});

export const api = createMetastorageApiClient(http, isMockMode ? "mock" : "better-auth");
