import type {
  BookingListItem,
  CheckInVerification,
  Facility,
  Inspection,
  InspectionPhotoContent,
  Payment,
  PaymentResult,
  RentalDetail,
  Reservation,
  ReservationDraft,
  ReservationHold,
  ReservationQuote,
  StorageUnitStatus,
  User,
} from "@metastorage/contracts";

export interface MockUser extends User {
  password: string;
  assignedFacilityIds: string[];
}

export interface MockStorageUnit {
  id: string;
  facilityId: string;
  unitTypeId: string;
  code: string;
  unitType: string;
  sizeLabel: string;
  sizeSqm: number;
  monthlyPrice: number;
  status: StorageUnitStatus;
}

export interface MockDatabase {
  version: 4;
  drafts: ReservationDraft[];
  holds: (ReservationHold & { draftId: string })[];
  checkoutResults: (PaymentResult & { draftId: string })[];
  verifications: CheckInVerification[];
  inspections: Inspection[];
  photoContents: (InspectionPhotoContent & { inspectionId: string })[];
  rentals: (RentalDetail & { userId: string | null })[];
  users: MockUser[];
  facilities: Facility[];
  units: MockStorageUnit[];
  quotes: ReservationQuote[];
  reservations: Reservation[];
  payments: Payment[];
  bookings: MockBooking[];
}

export interface MockBooking extends BookingListItem {
  userId?: string | null;
}
