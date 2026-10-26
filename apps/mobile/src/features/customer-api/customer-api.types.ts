export type CustomerRoute =
  | { screen: "home" | "catalog" | "bookings" | "rentals" | "support" }
  | { screen: "checkout"; facilityId: string; unitTypeId: string }
  | { screen: "booking" | "rental" | "ticket"; id: string }
  | { screen: "support-new"; bookingId?: string; paymentId?: string }
  | { screen: "payment"; id: string; bookingId?: string; chargeId?: string };
export type CustomerNavigation = (route: CustomerRoute) => void;
export type CheckoutSession = {
  checkoutUrl: string;
  checkoutFormFields: Record<string, string | number>;
};

export type CustomerCheckoutCommand = {
  signature: string;
  draft: import("@metastorage/contracts").BookingDraft;
  key: string;
  values: import("@metastorage/contracts").BookingDraftInput;
  contactPhone?: string;
  payment?: import("@metastorage/contracts").BookingPaymentSession;
};
