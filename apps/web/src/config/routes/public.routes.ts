export const publicRoutes = {
  home: "/",
  facilities: "/facilities",
  facility: (facilityId: string) => `/facilities/${facilityId}`,
  bookingTracking: "/booking/tracking",
  reservationNew: "/reservations/new",
  login: "/login",
  register: "/register",
  verifyEmail: "/verify-email",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  forbidden: "/forbidden",
} as const;
