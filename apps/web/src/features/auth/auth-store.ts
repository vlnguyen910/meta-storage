"use client";

import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import type { AuthState } from "./auth-store.types";

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      hydrated: false,
      authReady: false,
      setSession: (session) => set({ session }),
      updateTokens: (tokens) =>
        set((state) => ({
          session: state.session ? { ...state.session, ...tokens } : null,
        })),
      clearSession: () => set({ session: null }),
      setHydrated: (hydrated) => set({ hydrated }),
      setAuthReady: (authReady) => set({ authReady }),
    }),
    {
      name: "metastorage.auth-session.v2",
      storage: createJSONStorage(() =>
        typeof window === "undefined" ? noopStorage : window.sessionStorage,
      ),
      partialize: (state) => ({ session: state.session }),
      onRehydrateStorage: () => (state) => state?.setHydrated(true),
    },
  ),
);

export const authStore = useAuthStore;
