import type {
  LoginHistoryItem,
  LoginHistoryQuery,
  UserActivityLogItem,
  UserActivityLogQuery,
  UserHistoryPage,
} from "@metastorage/contracts";
import type { UserHistoryRepository } from "./user-history.repository";

export class UserHistoryService {
  constructor(private readonly repository: UserHistoryRepository) {}

  async loginHistory(query: LoginHistoryQuery): Promise<UserHistoryPage<LoginHistoryItem>> {
    const page = await this.repository.loginHistory(query);
    return {
      ...page,
      items: page.items.map((item) => ({ ...item, occurredAt: item.occurredAt.toISOString() })),
    };
  }

  async activityLogs(query: UserActivityLogQuery): Promise<UserHistoryPage<UserActivityLogItem>> {
    const page = await this.repository.activityLogs(query);
    return {
      ...page,
      items: page.items.map((item) => ({ ...item, occurredAt: item.occurredAt.toISOString() })),
    };
  }
}
