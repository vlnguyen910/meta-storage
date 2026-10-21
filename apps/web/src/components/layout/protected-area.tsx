"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LOADING_MESSAGES } from "@/components/ui/loading.messages";
import { FullScreenLoading } from "@/components/ui/states";
import { routes } from "@/config/routes";
import { useAuthStore } from "@/features/auth/auth-store";
import { AppShell } from "./app-shell";
import type { ProtectedAreaProps } from "./protected-area.types";

export function ProtectedArea({
  allowedRole,
  children,
  withAppShell = true,
}: Readonly<ProtectedAreaProps>) {
  const router = useRouter();
  const session = useAuthStore((state) => state.session);
  const hydrated = useAuthStore((state) => state.hydrated);
  const authReady = useAuthStore((state) => state.authReady);

  useEffect(() => {
    if (!hydrated || !authReady) return;
    if (!session)
      router.replace(`${routes.login}?returnTo=${encodeURIComponent(location.pathname)}`);
    else if (session.user.role !== allowedRole) router.replace(routes.forbidden);
  }, [allowedRole, authReady, hydrated, router, session]);

  if (!hydrated || !authReady || !session || session.user.role !== allowedRole) {
    return <FullScreenLoading label={LOADING_MESSAGES.auth} />;
  }

  return withAppShell ? <AppShell>{children}</AppShell> : children;
}
