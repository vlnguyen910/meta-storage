export const customerRoutes = {
  dashboard: "/customer/dashboard",
  facilities: "/customer/facilities",
  reservations: "/customer/reservations",
  newReservation: "/reservations/new",
  reservation: (reservationId: string) => `/customer/reservations/${reservationId}`,
  rentals: "/customer/storage",
  transactions: "/customer/transactions",
  rental: (rentalId: string) => `/customer/storage/${rentalId}`,
  newReturn: (rentalId: string) => `/customer/storage/${rentalId}/return`,
  returnRequest: (requestId: string) => `/customer/returns/${requestId}`,
} as const;
