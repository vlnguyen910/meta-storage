import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";

import { API_BASE_URL } from "./runtime-config";

export const authClient = createAuthClient({
  baseURL: `${API_BASE_URL}/auth`,
  plugins: [
    expoClient({
      scheme: "metastorage",
      storagePrefix: "metastorage",
      cookiePrefix: "metastorage-auth",
      storage: SecureStore,
    }),
  ],
});
