import type { LifecycleNotificationEvent } from "./lifecycle-notifications";
export interface StaffTaskAssignedNotification {
  id: string;
  type: "STAFF_TASK_ASSIGNED";
  recipientId: string;
  bookingId: string;
  occurredAt: string;
}

export interface LifecycleNotificationItem {
  id: string;
  type: LifecycleNotificationEvent;
  bookingId: string;
  subject: string;
  body: string;
  occurredAt: string;
}

export interface BookingEmailSnapshot {
  bookingCode: string | null;
  facilityName: string;
  unitTypeName: string;
  paidAt: string;
}
