export interface ContractTermsSnapshot {
  bookingId: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  facilityId: string;
  facilityName: string;
  facilityAddress: string;
  unitTypeId: string;
  unitTypeName: string;
  requestedMonths: number;
  checkInDate: string;
  checkInSlotId: string;
  rentalEndAt: string;
  monthlyRate: string;
  rentalFee: string;
  deposit: string;
  paymentId: string;
  paidAt: string;
}
export interface RentalDocumentDto {
  id: string;
  bookingId: string;
  version: number;
  status: "UPLOADED" | "ISSUED";
  filename: string;
  byteSize: number;
  pageCount: number;
  uploadedAt: string;
  issuedAt: string | null;
  terms: ContractTermsSnapshot | null;
  currentIssued: boolean;
  usedForHandover: boolean;
}
