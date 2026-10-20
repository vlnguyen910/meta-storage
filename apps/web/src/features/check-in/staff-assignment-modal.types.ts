import type { BookingListItem } from "@metastorage/contracts";

export interface StaffAssignmentModalProps {
  booking: BookingListItem;
  isOpen: boolean;
  onClose: () => void;
}
