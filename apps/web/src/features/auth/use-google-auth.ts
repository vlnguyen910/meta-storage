"use client";

import { useContext, useState } from "react";
import { ToastContext } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { AUTH_MESSAGES } from "./auth.messages";
import { useAuthStore } from "./auth-store";

export function useGoogleAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const toastContext = useContext(ToastContext);
  const showToast = toastContext?.showToast ?? (() => {});
  const session = useAuthStore((state) => state.session);

  async function signInWithGoogle(returnTo?: string | null) {
    setIsLoading(true);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const callbackURL = returnTo
        ? `${origin}/login/complete?returnTo=${encodeURIComponent(returnTo)}`
        : `${origin}/login/complete`;
      const errorCallbackURL = returnTo
        ? `${origin}/login?returnTo=${encodeURIComponent(returnTo)}`
        : `${origin}/login`;

      const response = await api.auth.signInSocial({
        provider: "google",
        callbackURL,
        errorCallbackURL,
        disableRedirect: true,
      });

      if (response?.url) {
        window.location.assign(response.url);
      } else {
        throw new Error("No redirect URL returned");
      }
    } catch {
      setIsLoading(false);
      showToast(AUTH_MESSAGES.googleAuthFailed, "error");
    }
  }

  async function linkGoogleAccount(returnTo?: string | null) {
    if (!session?.user) {
      showToast(AUTH_MESSAGES.googleLinkSessionRequired, "error");
      return;
    }

    setIsLoading(true);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const targetParam = returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : "";
      const callbackURL = `${origin}/login/complete?action=link${targetParam}`;
      const errorCallbackURL = `${origin}/login/complete?action=link${targetParam}`;

      const response = await api.auth.linkSocial({
        provider: "google",
        callbackURL,
        errorCallbackURL,
        disableRedirect: true,
      });

      if (response?.url) {
        window.location.assign(response.url);
      } else {
        throw new Error("No redirect URL returned");
      }
    } catch {
      setIsLoading(false);
      showToast(AUTH_MESSAGES.googleLinkFailed, "error");
    }
  }

  return {
    isLoading,
    signInWithGoogle,
    linkGoogleAccount,
  };
}
