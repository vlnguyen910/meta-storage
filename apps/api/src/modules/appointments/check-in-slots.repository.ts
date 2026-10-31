import type { Database } from "@metastorage/database";
import { asc, checkInSlots, eq, max, sql } from "@metastorage/database";

type SlotQueryExecutor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

import type { ResolvedCheckInSlot } from "./check-in-slots.types";

export class CheckInSlotsRepository {
  constructor(private readonly executor: SlotQueryExecutor) {}

  async findDayEnd(checkInDate: string): Promise<Date | null> {
    const [row] = await this.executor
      .select({
        endsAt: sql<Date | null>`(${checkInDate}::date + ${max(checkInSlots.endTime)})
        at time zone 'Asia/Ho_Chi_Minh'`.mapWith((value) =>
          value === null ? null : new Date(value),
        ),
      })
      .from(checkInSlots);
    return row?.endsAt ?? null;
  }

  async list() {
    return this.executor
      .select({
        id: checkInSlots.id,
        name: checkInSlots.name,
        startTime: checkInSlots.startTime,
        endTime: checkInSlots.endTime,
      })
      .from(checkInSlots)
      .orderBy(asc(checkInSlots.startTime), asc(checkInSlots.endTime), asc(checkInSlots.id));
  }

  async findByIdForDate(
    checkInSlotId: string,
    checkInDate: string,
  ): Promise<ResolvedCheckInSlot | null> {
    const localDate = sql`${checkInDate}::date`;
    const [slot] = await this.executor
      .select({
        id: checkInSlots.id,
        checkInDate: sql<string>`${localDate}::text`,
        startsAt:
          sql<Date>`(${localDate} + ${checkInSlots.startTime}) at time zone 'Asia/Ho_Chi_Minh'`.mapWith(
            (value) => new Date(value),
          ),
        endsAt:
          sql<Date>`(${localDate} + ${checkInSlots.endTime}) at time zone 'Asia/Ho_Chi_Minh'`.mapWith(
            (value) => new Date(value),
          ),
      })
      .from(checkInSlots)
      .where(eq(checkInSlots.id, checkInSlotId))
      .limit(1);
    return slot ?? null;
  }

  async findForCheckIn(checkInAt: Date): Promise<ResolvedCheckInSlot | null> {
    const localTimestamp = sql`${checkInAt.toISOString()}::timestamptz at time zone 'Asia/Ho_Chi_Minh'`;
    const localDate = sql`(${localTimestamp})::date`;
    const localTime = sql`(${localTimestamp})::time`;
    const rows = await this.executor
      .select({
        id: checkInSlots.id,
        checkInDate: sql<string>`${localDate}::text`,
        startsAt:
          sql<Date>`(${localDate} + ${checkInSlots.startTime}) at time zone 'Asia/Ho_Chi_Minh'`.mapWith(
            (value) => new Date(value),
          ),
        endsAt:
          sql<Date>`(${localDate} + ${checkInSlots.endTime}) at time zone 'Asia/Ho_Chi_Minh'`.mapWith(
            (value) => new Date(value),
          ),
      })
      .from(checkInSlots)
      .where(
        sql`${checkInSlots.startTime} <= ${localTime} and ${localTime} < ${checkInSlots.endTime}`,
      )
      .limit(2);

    // Reject missing or ambiguous definitions rather than choose an arbitrary slot.
    return rows.length === 1 ? (rows[0] ?? null) : null;
  }
}
