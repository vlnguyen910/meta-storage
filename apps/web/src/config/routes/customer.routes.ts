export const customerRoutes = {
  dashboard: "/customer/dashboard",
  facilities: "/customer/facilities",
  reservations: "/customer/reservations",
  newReservation: "/reservations/new",
  reservation: (reservationId: string) => `/customer/reservations/${reservationId}`,
  rentals: "/customer/storage",
  rental: (rentalId: string) => `/customer/storage/${rentalId}`,
} as const;
