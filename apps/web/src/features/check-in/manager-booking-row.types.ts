import type { BookingListItem } from "@metastorage/contracts";
export interface ManagerBookingRowProps {
  booking: BookingListItem;
  state: string;
  canAssign: boolean;
  onAssignStaff: () => void;
}
