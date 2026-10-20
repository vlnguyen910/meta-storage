import type { LifecycleNotificationItem, NotificationInboxQuery } from "@metastorage/contracts";
import type { LifecycleNotificationsRepository } from "./lifecycle-notifications.repository";

export class LifecycleNotificationsService {
  constructor(private readonly repository: LifecycleNotificationsRepository) {}
  async inbox(
    userId: string,
    role: string,
    query: NotificationInboxQuery,
  ): Promise<LifecycleNotificationItem[]> {
    return (await this.repository.inbox(userId, role, query)).map((row) => ({
      id: row.id,
      type: row.type,
      bookingId: row.bookingId,
      subject: row.subject,
      body: row.body,
      occurredAt: row.occurredAt.toISOString(),
    }));
  }
}
