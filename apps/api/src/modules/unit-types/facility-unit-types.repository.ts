import {
  and,
  asc,
  type Database,
  eq,
  type FacilityUnitType,
  facilityUnitTypes,
  type UnitType,
  unitTypes,
} from "@metastorage/database";
import { UNIT_TYPE_MESSAGES } from "./unit-types.messages";

export class FacilityUnitTypesRepository {
  constructor(private readonly db: Database) {}

  async findActiveUnitType(facilityId: string, unitTypeId: string): Promise<UnitType | undefined> {
    const [row] = await this.db
      .select({ unitType: unitTypes })
      .from(facilityUnitTypes)
      .innerJoin(unitTypes, eq(unitTypes.id, facilityUnitTypes.unitTypeId))
      .where(
        and(
          eq(facilityUnitTypes.facilityId, facilityId),
          eq(facilityUnitTypes.unitTypeId, unitTypeId),
          eq(facilityUnitTypes.isActive, true),
          eq(unitTypes.isActive, true),
        ),
      );
    return row?.unitType;
  }

  async link(facilityId: string, unitTypeId: string): Promise<FacilityUnitType> {
    const [link] = await this.db
      .insert(facilityUnitTypes)
      .values({ facilityId, unitTypeId })
      .returning();
    if (!link) throw new Error(UNIT_TYPE_MESSAGES.failedToLinkUnitType);
    return link;
  }

  async find(facilityId: string, unitTypeId: string): Promise<FacilityUnitType | undefined> {
    const [link] = await this.db
      .select()
      .from(facilityUnitTypes)
      .where(
        and(
          eq(facilityUnitTypes.facilityId, facilityId),
          eq(facilityUnitTypes.unitTypeId, unitTypeId),
        ),
      );
    return link;
  }

  async list(facilityId: string, limit: number, offset: number, isActive?: boolean) {
    return this.db
      .select({ offering: facilityUnitTypes, unitType: unitTypes })
      .from(facilityUnitTypes)
      .innerJoin(unitTypes, eq(unitTypes.id, facilityUnitTypes.unitTypeId))
      .where(
        and(
          eq(facilityUnitTypes.facilityId, facilityId),
          isActive === undefined ? undefined : eq(facilityUnitTypes.isActive, isActive),
        ),
      )
      .orderBy(asc(unitTypes.code))
      .limit(limit)
      .offset(offset);
  }

  async listByFacility(facilityId: string, limit: number, offset: number): Promise<UnitType[]> {
    const rows = await this.db
      .select({ unitType: unitTypes })
      .from(facilityUnitTypes)
      .innerJoin(unitTypes, eq(unitTypes.id, facilityUnitTypes.unitTypeId))
      .where(
        and(
          eq(facilityUnitTypes.facilityId, facilityId),
          eq(facilityUnitTypes.isActive, true),
          eq(unitTypes.isActive, true),
        ),
      )
      .orderBy(asc(unitTypes.monthlyPrice))
      .limit(limit)
      .offset(offset);
    return rows.map((row) => row.unitType);
  }

  async setActive(
    facilityId: string,
    unitTypeId: string,
    isActive: boolean,
  ): Promise<FacilityUnitType | undefined> {
    const [updated] = await this.db
      .update(facilityUnitTypes)
      .set({ isActive, updatedAt: new Date() })
      .where(
        and(
          eq(facilityUnitTypes.facilityId, facilityId),
          eq(facilityUnitTypes.unitTypeId, unitTypeId),
        ),
      )
      .returning();
    return updated;
  }

  async unlink(facilityId: string, unitTypeId: string): Promise<FacilityUnitType | undefined> {
    const [deleted] = await this.db
      .delete(facilityUnitTypes)
      .where(
        and(
          eq(facilityUnitTypes.facilityId, facilityId),
          eq(facilityUnitTypes.unitTypeId, unitTypeId),
        ),
      )
      .returning();
    return deleted;
  }
}
