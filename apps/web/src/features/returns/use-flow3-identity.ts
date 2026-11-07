"use client";
import { useAuthStore } from "@/features/auth/auth-store";

export function useFlow3Identity() {
  return useAuthStore(
    (s) => `${s.session?.user.id ?? "anonymous"}:${s.session?.user.role ?? "guest"}`,
  );
}
