"use client";

import { UserRole } from "@metastorage/contracts";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { FullScreenLoading } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { roleHome, routes, safeReturnTo } from "@/config/routes";
import { AUTH_MESSAGES } from "@/features/auth/auth.messages";
import { useAuthStore } from "@/features/auth/auth-store";
import { api } from "@/lib/api";

function parseOAuthErrorMessage(error: string): string {
  switch (error) {
    case "email_does_not_match":
      return AUTH_MESSAGES.googleEmailMismatch;
    case "google_email_unverified":
      return AUTH_MESSAGES.googleEmailUnverified;
    case "account_disabled":
      return AUTH_MESSAGES.googleAccountDisabled;
    case "link_session_required":
      return AUTH_MESSAGES.googleLinkSessionRequired;
    case "access_denied":
      return AUTH_MESSAGES.googleAccessDenied;
    case "invalid_state":
    case "state_mismatch":
      return AUTH_MESSAGES.googleStateExpired;
    case "provider_not_found":
      return AUTH_MESSAGES.googleProviderDisabled;
    default:
      return AUTH_MESSAGES.googleAuthFailed;
  }
}

function LoginCompleteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const setSession = useAuthStore((state) => state.setSession);
  const clearSession = useAuthStore((state) => state.clearSession);
  const setAuthReady = useAuthStore((state) => state.setAuthReady);
  const existingSession = useAuthStore((state) => state.session);

  const action = searchParams.get("action");
  const returnTo = searchParams.get("returnTo");
  const error = searchParams.get("error");
  const isLinking = action === "link";

  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    if (error) {
      const message = parseOAuthErrorMessage(error);
      showToast(message, "error");

      if (isLinking && existingSession?.user?.role) {
        const destination = safeReturnTo(returnTo, roleHome[existingSession.user.role]);
        router.replace(destination);
      } else {
        const queryParams = new URLSearchParams();
        queryParams.set("error", error);
        if (returnTo) queryParams.set("returnTo", returnTo);
        router.replace(`${routes.login}?${queryParams.toString()}`);
      }
      return;
    }

    api.auth
      .me()
      .then((user) => {
        setSession({ user });
        setAuthReady(true);

        if (isLinking) {
          showToast(AUTH_MESSAGES.googleLinkSuccess, "success");
        } else {
          showToast(AUTH_MESSAGES.loginWelcome(user.name), "success");
        }

        const role = user.role;
        if (!role) {
          router.replace(routes.forbidden);
          return;
        }

        const requested = safeReturnTo(returnTo, roleHome[role]);
        const roleRoot = `/${roleHome[role].split("/")[1]}`;
        const customerReservationEntry =
          role === UserRole.STORAGE_CUSTOMER &&
          (requested === routes.reservationNew ||
            requested.startsWith(`${routes.reservationNew}?`));
        const destination =
          requested === roleRoot || requested.startsWith(`${roleRoot}/`) || customerReservationEntry
            ? requested
            : roleHome[role];

        router.replace(destination);
      })
      .catch(() => {
        if (!isLinking) {
          clearSession();
        }
        setAuthReady(true);
        showToast(
          isLinking ? AUTH_MESSAGES.googleLinkFailed : AUTH_MESSAGES.googleAuthFailed,
          "error",
        );
        router.replace(
          isLinking && existingSession?.user?.role
            ? safeReturnTo(returnTo, roleHome[existingSession.user.role])
            : routes.login,
        );
      });
  }, [
    error,
    isLinking,
    existingSession,
    returnTo,
    router,
    showToast,
    setSession,
    clearSession,
    setAuthReady,
  ]);

  return (
    <FullScreenLoading
      label={isLinking ? AUTH_MESSAGES.googleLinking : AUTH_MESSAGES.googleConnecting}
    />
  );
}

export default function LoginCompletePage() {
  return (
    <Suspense fallback={<FullScreenLoading label={AUTH_MESSAGES.googleConnecting} />}>
      <LoginCompleteContent />
    </Suspense>
  );
}
