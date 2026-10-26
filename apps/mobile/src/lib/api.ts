import { createHttpClient, createMetastorageApiClient } from "@metastorage/api-client";
import { Platform } from "react-native";
import { authClient } from "./auth-client";

const http = createHttpClient({
  baseURL: process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api",
  tokenProvider: {
    getAccessToken: () => null,
    getRefreshToken: () => null,
    updateTokens: () => undefined,
    clearSession: () => undefined,
  },
});

http.interceptors.request.use(async (config) => {
  if (Platform.OS !== "web") {
    const cookie = await authClient.getCookie();
    if (cookie) config.headers.Cookie = cookie;
  }
  return config;
});

export const api = createMetastorageApiClient(http, "better-auth");
