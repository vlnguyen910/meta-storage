import type { DispatchItem } from "@/features/facility-flow/use-dispatch";

export interface StaffAssignmentModalProps {
  booking: DispatchItem;
  isOpen: boolean;
  onClose: () => void;
}
