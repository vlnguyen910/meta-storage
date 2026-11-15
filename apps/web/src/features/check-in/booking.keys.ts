export const bookingKeys = {
  all: ["bookings"] as const,
  facility: (facilityId: string, status?: string) =>
    [...bookingKeys.all, "facility", facilityId, status] as const,
  facilityStaff: (facilityId: string) =>
    [...bookingKeys.all, "facility-staff", facilityId] as const,
  staffTasks: (facilityId?: string) => [...bookingKeys.all, "staff-tasks", facilityId] as const,
  detail: (id: string) => [...bookingKeys.all, "detail", id] as const,
  eligibleUnits: (id: string) => [...bookingKeys.all, "eligible-units", id] as const,
};
