import { createHttpClient, createMetastorageApiClient } from "@metastorage/api-client";

const http = createHttpClient({
  baseURL: process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api",
  tokenProvider: {
    getAccessToken: () => null,
    getRefreshToken: () => null,
    updateTokens: () => undefined,
    clearSession: () => undefined,
  },
});

export const api = createMetastorageApiClient(http, "better-auth");
