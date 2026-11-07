import { and, capacityAllocations, type Database, eq, lte, sql } from "@metastorage/database";

// Application namespace + job ID. Transaction-scoped so crashes release the lock.
export const CAPACITY_HOLD_EXPIRY_LOCK = [0x4d535447, 1] as const;

export async function expireCapacityHolds(db: Database, now = new Date(), facilityId?: string) {
  return db.transaction(async (tx) => {
    const [lock] = await tx.execute<{ acquired: boolean }>(
      sql`SELECT pg_try_advisory_xact_lock(${CAPACITY_HOLD_EXPIRY_LOCK[0]}::integer, ${CAPACITY_HOLD_EXPIRY_LOCK[1]}::integer) AS acquired`,
    );
    if (!lock?.acquired) return { expired: 0, skipped: true };

    const expired = await tx
      .update(capacityAllocations)
      .set({ status: "EXPIRED", updatedAt: now })
      .where(
        and(
          eq(capacityAllocations.kind, "HOLD"),
          facilityId ? eq(capacityAllocations.facilityId, facilityId) : undefined,
          eq(capacityAllocations.status, "ACTIVE"),
          lte(capacityAllocations.expiresAt, now),
        ),
      )
      .returning({ id: capacityAllocations.id });
    return { expired: expired.length, skipped: false };
  });
}
