import type { BookingListItem } from "./bookings";
import type { CatalogFacility, CatalogUnitType } from "./catalog";
import type { FacilityStaffMember } from "./facilities";
import type { HandoverChecklistItemResult } from "./handover-checklist";
import type { ReservationDraft, ReservationHold } from "./reservations";

export interface MobileDemoSession {
  phone?: string;
  id: string;
  name: string;
  email: string;
  role: "CUSTOMER" | "FACILITY_STAFF";
  facilityIds: string[];
}
export interface MobilePaidBooking extends BookingListItem {
  ownerId: string;
  rentalAmount: number;
  depositAmount: number;
  rescheduleCount: number;
  history: { action: "RESCHEDULE" | "CANCEL"; at: string; previousSlot: string }[];
  assignedStaff?: FacilityStaffMember | null;
  taskStatus?: "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
}
export interface MobileHeldDraft extends ReservationDraft {
  ownerId: string;
  hold: ReservationHold | null;
}
export interface MobileInspection {
  id: string;
  bookingId: string;
  staffId: string;
  version: number;
  status: "DRAFT" | "COMPLETED" | "HANDED_OVER";
  checklist: HandoverChecklistItemResult[];
  notes: string;
  photos: { id: string; uri: string }[];
}
export interface MobileRental {
  id: string;
  bookingId: string;
  ownerId: string;
  status: "ACTIVE";
  startedAt: string;
}
export interface MobileRentalRequest {
  id: string;
  rentalId: string;
  ownerId: string;
  type: "RETURN" | "CHANGE";
  reason: string;
  preferredAt: string;
  targetUnitTypeId?: string;
  status: "AWAITING_FM" | "ASSIGNED" | "REPORT_SENT";
  assignedStaffId: string | null;
  report: { notes: string; checklist: HandoverChecklistItemResult[]; photos: string[] } | null;
}
export interface MobileWorkspace {
  session: MobileDemoSession | null;
  guestId: string;
  facilities: CatalogFacility[];
  unitTypes: (CatalogUnitType & { facilityId: string })[];
  bookings: MobilePaidBooking[];
  drafts: MobileHeldDraft[];
  inspections: MobileInspection[];
  rentals: MobileRental[];
  requests: MobileRentalRequest[];
}
