import { expoClient } from "@better-auth/expo/client";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";

import { API_BASE_URL } from "./runtime-config";

export const authClient = createAuthClient({
  baseURL: `${API_BASE_URL}/auth`,
  plugins: [
    inferAdditionalFields({ user: { phone: { type: "string", required: false, input: true } } }),
    expoClient({
      scheme: "metastorage",
      storagePrefix: "metastorage",
      cookiePrefix: "metastorage-auth",
      storage: SecureStore,
    }),
  ],
});
