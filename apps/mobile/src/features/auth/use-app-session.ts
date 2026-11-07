import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Linking } from "react-native";
import { authClient } from "../../lib/auth-client";
import { mobileWorkflows } from "../demo/demo-client";
import { AUTHENTICATION as M } from "./authentication.messages";

export function useAppSession() {
  const session = authClient.useSession();
  const client = useQueryClient();
  const callbackUrl = useAuthCallback(session.data?.user.id);
  const signOut = useMutation({
    mutationFn: async () => {
      const result = await authClient.signOut();
      if (result.error) throw new Error(M.requestFailed);
      client.clear();
    },
  });
  return {
    user: session.data?.user,
    pending: session.isPending,
    error: session.error,
    callbackUrl,
    refresh: () => void session.refetch(),
    signOut: () => signOut.mutate(),
    signingOut: signOut.isPending,
    signOutError: signOut.error ? M.requestFailed : undefined,
  };
}

export function useDemoSession() {
  const client = useQueryClient();
  const session = useQuery({
    queryKey: ["mobile", "workspace"],
    queryFn: mobileWorkflows.workspace,
  });
  const callbackUrl = useAuthCallback(session.data?.session?.id);
  const signOut = useMutation({
    mutationFn: async () => {
      await mobileWorkflows.logout();
      await session.refetch();
      client.removeQueries({
        predicate: (query) => query.queryKey[0] !== "mobile" || query.queryKey[1] !== "workspace",
      });
    },
  });
  return {
    user: session.data?.session,
    pending: session.isPending,
    error: session.error,
    callbackUrl,
    refresh: () => void session.refetch(),
    signOut: () => signOut.mutate(),
    signingOut: signOut.isPending,
    signOutError: signOut.error ? M.requestFailed : undefined,
  };
}

function useAuthCallback(owner?: string) {
  const [callbackUrl, setCallbackUrl] = useState<string>();
  useEffect(() => {
    if (owner) setCallbackUrl(undefined);
  }, [owner]);
  useEffect(() => {
    function handleUrl(value: string | null) {
      if (!value) return;
      try {
        const url = new URL(value);
        if (url.protocol === "metastorage:" && url.hostname === "auth") {
          setCallbackUrl(value);
        } else if (["http:", "https:"].includes(url.protocol) && url.searchParams.has("error")) {
          setCallbackUrl("metastorage://auth?error=google");
        }
      } catch {
        // Ignore malformed links and links outside the active authentication flow.
      }
    }
    void Linking.getInitialURL()
      .then(handleUrl)
      .catch(() => undefined);
    const listener = Linking.addEventListener("url", ({ url }) => handleUrl(url));
    return () => listener.remove();
  }, []);
  return callbackUrl;
}
