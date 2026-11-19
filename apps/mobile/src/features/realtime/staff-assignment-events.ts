import type { StaffTaskAssignedNotification } from "@metastorage/contracts";

type AssignmentListener = (event: StaffTaskAssignedNotification) => void;
const listeners = new Set<AssignmentListener>();

/** Lets the open staff workspace announce new work; returns the unsubscribe function. */
export function onStaffTaskAssigned(listener: AssignmentListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitStaffTaskAssigned(event: StaffTaskAssignedNotification) {
  for (const listener of listeners) listener(event);
}
