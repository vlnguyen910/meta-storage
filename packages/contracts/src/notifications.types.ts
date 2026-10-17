export interface StaffTaskAssignedNotification {
  id: string;
  type: "STAFF_TASK_ASSIGNED";
  recipientId: string;
  bookingId: string;
  occurredAt: string;
}
