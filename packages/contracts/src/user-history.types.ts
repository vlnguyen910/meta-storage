export interface LoginHistoryItem {
  id: string;
  userId: string | null;
  occurredAt: string;
  device: string | null;
  operatingSystem: string | null;
  browser: string | null;
  model: string | null;
}

export interface UserActivityLogItem {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  facilityId: string | null;
  occurredAt: string;
}

export interface UserHistoryPage<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
