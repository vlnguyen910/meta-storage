import type { BookingListItem } from "@metastorage/contracts";

export interface UnitAssignmentModalProps {
  booking: BookingListItem;
  isOpen: boolean;
  onClose: () => void;
}
