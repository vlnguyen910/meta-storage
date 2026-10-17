"use client";

import type { ReactNode } from "react";
import { hasPermission, type Permission } from "@/config/access-control";
import { useAuthStore } from "./auth-store";

export function usePermission(permission: Permission): boolean {
  const role = useAuthStore((state) => state.session?.user.role);
  return role ? hasPermission(role, permission) : false;
}

export function Can({ permission, children }: { permission: Permission; children: ReactNode }) {
  return usePermission(permission) ? children : null;
}
