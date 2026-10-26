export type CustomerLiveFixture = {
  api: string;
  facilityId: string;
  typeId: string;
  slotId: string;
  rentalIds: [string, string, string];
  bookingIds: [string, string, string];
  contractId: string;
  failedBookingId: string;
  failedPaymentId: string;
  email: string;
  password: string;
  otherEmail: string;
  managerEmail: string;
  staffEmail: string;
};
