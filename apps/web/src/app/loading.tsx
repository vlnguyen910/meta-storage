"use client";

import { useGlobalLoading } from "@/components/providers/global-loading-provider";
import { LOADING_MESSAGES } from "@/components/ui/loading.messages";
import { DelayedFullScreenLoading } from "@/components/ui/states";

export default function Loading() {
  const { navigationCount } = useGlobalLoading();
  if (navigationCount > 0) return null;
  return <DelayedFullScreenLoading label={LOADING_MESSAGES.page} />;
}
