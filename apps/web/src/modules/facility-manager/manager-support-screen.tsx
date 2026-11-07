"use client";
import { EmptyState } from "@/components/ui/states";
import { ManagerTabFrame } from "./manager-tab-frame";
import { MANAGER_TABS as M } from "./manager-tabs.messages";

export function ManagerSupportScreen() {
  return (
    <ManagerTabFrame title={M.support} description={M.supportHint}>
      {() => <EmptyState title={M.supportUnavailable} description={M.supportUnavailableHint} />}
    </ManagerTabFrame>
  );
}
