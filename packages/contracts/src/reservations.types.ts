export interface ReservationQuoteInput {
  facilityId: string;
  unitTypeId: string;
  startDate: string;
  durationMonths: number;
}

export interface ConfirmReservationInput {
  quoteId: string;
  paymentToken: string;
  cardBrand: string;
  cardLast4: string;
}
