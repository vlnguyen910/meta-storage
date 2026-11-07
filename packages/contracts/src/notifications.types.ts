import type { LifecycleNotificationEvent } from "./lifecycle-notifications";
export interface StaffTaskAssignedNotification {
  id: string;
  type: "STAFF_TASK_ASSIGNED";
  appointmentId?: string;
  recipientId: string;
  bookingId: string | null;
  reservationId?: string | null;
  occurredAt: string;
}

export interface LifecycleNotificationItem {
  id: string;
  type: LifecycleNotificationEvent;
  bookingId: string | null;
  reservationId?: string | null;
  subject: string;
  body: string;
  occurredAt: string;
}

export interface BookingEmailSnapshot {
  bookingCode: string | null;
  facilityName: string;
  unitTypeName: string;
  paidAt: string;
  kind?: "BOOKING_CONFIRMATION" | "TRACKING_LINK";
  deliveryId?: string;
  linkCreatedAt?: string;
  linkExpiresAt?: string;
}
