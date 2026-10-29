import type { DispatchItem } from "@/features/facility-flow/use-dispatch";
export interface ManagerBookingRowProps {
  booking: DispatchItem;
  state: string;
  canAssign: boolean;
  onAssignStaff: () => void;
}
