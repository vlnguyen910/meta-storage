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
  async find(key: SystemSettingKeyValue) {
    const [row] = await this.db.select().from(systemSettings).where(eq(systemSettings.key, key));
    return row;
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
  async lock(
    key: SystemSettingKeyValue,
    tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
  ) {
    const [row] = await tx
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, key))
      .for("update");
    return row;
  }
  async save(
    key: SystemSettingKeyValue,
    value: number,
    version: number,
    actorId: string,
    tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
  ) {
    const [row] = await tx
      .update(systemSettings)
      .set({ value, version, updatedBy: actorId, updatedAt: new Date() })
      .where(eq(systemSettings.key, key))
      .returning();
    return row;
  }
  async audit(
    tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
    key: SystemSettingKeyValue,
    actorId: string,
    before: { value: number; version: number },
    after: { value: number; version: number },
  ) {
    await tx
      .insert(systemSettingChanges)
      .values({ key, before, after, actorId, source: "SYSTEM_SETTING_CONFIGURED" });
  }
}
