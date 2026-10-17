import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { DEMO_MESSAGES as m } from "./demo.messages";
import { mobileWorkflows } from "./demo-client";

export function useMobileWorkspace() {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const query = useQuery({
    queryKey: ["mobile", "workspace"],
    queryFn: mobileWorkflows.workspace,
    refetchInterval: 15000,
    retry: 1,
  });
  const run = useCallback(
    async <T>(action: () => Promise<T>, after?: (result: T) => void, success = m.success) => {
      if (busy.current) return;
      busy.current = true;
      setPending(true);
      setMessage(null);
      setError(false);
      try {
        const result = await action();
        queryClient.removeQueries({
          predicate: (q) => q.queryKey[0] === "mobile" && q.queryKey[1] !== "workspace",
        });
        await queryClient.invalidateQueries({ queryKey: ["mobile", "workspace"] });
        setMessage(success);
        after?.(result);
        return result;
      } catch (e) {
        setError(true);
        setMessage(e instanceof Error ? e.message : m.invalid);
      } finally {
        busy.current = false;
        setPending(false);
      }
    },
    [queryClient],
  );
  return {
    query,
    data: query.data,
    run,
    pending,
    message,
    error,
    clearMessage: () => setMessage(null),
  };
}
