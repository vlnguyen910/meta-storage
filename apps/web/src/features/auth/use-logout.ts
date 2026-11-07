"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useGlobalLoading } from "@/components/providers/global-loading-provider";
import { routes } from "@/config/routes";
import { api } from "@/lib/api";
import { useAuthStore } from "./auth-store";

export function useLogout() {
  const router = useRouter();
  const client = useQueryClient();
  const { startNavigationLoading } = useGlobalLoading();
  return useMutation({
    meta: { globalLoading: true },
    mutationFn: api.auth.logout,
    onSuccess: () => {
      useAuthStore.getState().clearSession();
      client.clear();
      startNavigationLoading();
      router.replace(routes.login);
    },
  });
}
