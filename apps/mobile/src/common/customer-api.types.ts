/** @lintignore Retained for archived screens in screens/old/ until their cleanup. */
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
/** @lintignore Retained for archived screens in screens/old/ until their cleanup. */
export type CustomerNavigation = (route: CustomerRoute) => void;
export type CheckoutSession = {
  paymentId: string;
  reservationId?: string;
  checkoutUrl: string;
  checkoutFormFields: Record<string, string | number>;
};

/** @lintignore Retained for archived screens in screens/old/ until their cleanup. */
export type CustomerCheckoutCommand = {
  signature: string;
  draft: import("@metastorage/contracts").ReservationRecordDto;
  key: string;
  values: import("@metastorage/contracts").CreateReservationDraftInput;
  contactPhone?: string;
  payment?: import("@metastorage/contracts").ReservationPaymentSession;
};
