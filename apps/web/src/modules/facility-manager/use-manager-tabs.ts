"use client";
import { useAuthStore } from "@/features/auth/auth-store";
export function useManagerKey() {
  const user = useAuthStore((s) => s.session?.user);
  return ["manager-tabs", user?.id, user?.role] as const;
}
