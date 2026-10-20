import type { RentalLifecycleSettingKeyValue } from "@metastorage/contracts";
import { type Database, eq, rentalLifecycleSettings, returnAudit } from "@metastorage/database";

export class RentalLifecycleSettingsRepository {
  constructor(readonly db: Database) {}

  list() {
    return this.db.select().from(rentalLifecycleSettings).orderBy(rentalLifecycleSettings.key);
  }

  async lock(
    key: RentalLifecycleSettingKeyValue,
    tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
  ) {
    const [row] = await tx
      .select()
      .from(rentalLifecycleSettings)
      .where(eq(rentalLifecycleSettings.key, key))
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
      .update(rentalLifecycleSettings)
      .set({ value, version, updatedBy: userId, updatedAt: new Date() })
      .where(eq(rentalLifecycleSettings.key, key))
      .returning();
    return row;
  }

  audit(
    tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
    userId: string,
    details: Record<string, unknown>,
  ) {
    return tx.insert(returnAudit).values({
      requestId: null,
      facilityId: null,
      actorId: userId,
      action: "RENTAL_LIFECYCLE_SETTING_CONFIGURED",
      details,
    });
  }
}
