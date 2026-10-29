export type CustomerRoute =
  | {
      screen:
        | "home"
        | "catalog"
        | "bookings"
        | "rentals"
        | "support"
        | "transactions"
        | "notifications";
    }
  | { screen: "checkout"; facilityId: string; unitTypeId: string }
  | { screen: "booking" | "rental" | "ticket"; id: string }
  | { screen: "support-new"; reservationId?: string; paymentId?: string }
  | { screen: "payment"; id: string; reservationId?: string };
export type CustomerNavigation = (route: CustomerRoute) => void;
export type CheckoutSession = {
  checkoutUrl: string;
  checkoutFormFields: Record<string, string | number>;
};

export type CustomerCheckoutCommand = {
  signature: string;
  draft: import("@metastorage/contracts").ReservationRecordDto;
  key: string;
  values: import("@metastorage/contracts").CreateReservationDraftInput;
  contactPhone?: string;
  payment?: import("@metastorage/contracts").ReservationPaymentSession;
};
