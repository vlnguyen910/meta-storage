import type { SystemSettingHistoryQuery, SystemSettingKeyValue } from "@metastorage/contracts";
import {
  asc,
  type Database,
  desc,
  eq,
  systemSettingChanges,
  systemSettings,
} from "@metastorage/database";

export class SystemSettingsRepository {
  constructor(readonly db: Database) {}
  list() {
    return this.db.select().from(systemSettings).orderBy(asc(systemSettings.key));
  }
  history(key: SystemSettingKeyValue, query: SystemSettingHistoryQuery) {
    return this.db
      .select()
      .from(systemSettingChanges)
      .where(eq(systemSettingChanges.key, key))
      .orderBy(desc(systemSettingChanges.createdAt), desc(systemSettingChanges.id))
      .limit(query.limit)
      .offset(query.offset);
  }
}
