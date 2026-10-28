import type { RentalLifecycleSettingKeyValue } from "@metastorage/contracts";
import {
  type Database,
  eq,
  inArray,
  systemSettingChanges,
  systemSettingInteger,
  systemSettings,
} from "@metastorage/database";

const keys = ["EXPIRY_REMINDER_DAYS", "ABANDONED_REVIEW_DAYS"] as const;
const fields = {
  key: systemSettings.key,
  value: systemSettingInteger,
  description: systemSettings.description,
  version: systemSettings.version,
  updatedBy: systemSettings.updatedBy,
  updatedAt: systemSettings.updatedAt,
};

export class RentalLifecycleSettingsRepository {
  constructor(readonly db: Database) {}

  list() {
    return this.db
      .select(fields)
      .from(systemSettings)
      .where(inArray(systemSettings.key, keys))
      .orderBy(systemSettings.key);
  }

  async lock(
    key: RentalLifecycleSettingKeyValue,
    tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
  ) {
    const [row] = await tx
      .select(fields)
      .from(systemSettings)
      .where(eq(systemSettings.key, key))
      .for("update");
    return row;
  }

  async save(
    key: RentalLifecycleSettingKeyValue,
    value: number,
    version: number,
    userId: string,
    tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
  ) {
    const [row] = await tx
      .update(systemSettings)
      .set({ value, version, updatedBy: userId, updatedAt: new Date() })
      .where(eq(systemSettings.key, key))
      .returning(fields);
    return row;
  }

  async audit(
    tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
    userId: string,
    details: {
      key: RentalLifecycleSettingKeyValue;
      before: { value: number; version: number };
      after: { value: number; version: number };
    },
  ) {
    await tx.insert(systemSettingChanges).values({
      key: details.key,
      before: details.before,
      after: details.after,
      actorId: userId,
      source: "RENTAL_LIFECYCLE_SETTING_CONFIGURED",
    });
  }
}
