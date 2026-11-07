import { createHttpClient, createMetastorageApiClient } from "@metastorage/api-client";
import { Platform } from "react-native";
import { authClient } from "./auth-client";
import { API_BASE_URL } from "./runtime-config";

const http = createHttpClient({
  baseURL: API_BASE_URL,
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
