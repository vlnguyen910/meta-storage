"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { routes } from "@/config/routes";
import { api } from "@/lib/api";
import { useAuthStore } from "./auth-store";

export function useLogout() {
  const router = useRouter();
  const client = useQueryClient();
  return useMutation({
    mutationFn: api.auth.logout,
    onSuccess: () => {
      useAuthStore.getState().clearSession();
      client.clear();
      router.replace(routes.login);
    },
  });
}
