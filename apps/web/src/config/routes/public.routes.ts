export const publicRoutes = {
  home: "/",
  facilities: "/facilities",
  facility: (facilityId: string) => `/facilities/${facilityId}`,
  reservationNew: "/reservations/new",
  login: "/login",
  register: "/register",
  verifyEmail: "/verify-email",
  forgotPassword: "/forgot-password",
  forbidden: "/forbidden",
} as const;
