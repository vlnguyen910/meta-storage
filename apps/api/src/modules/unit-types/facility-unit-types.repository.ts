import { and, asc, type Database, eq, type UnitType, unitTypes } from "@metastorage/database";

export class FacilityUnitTypesRepository {
  constructor(private readonly db: Database) {}

  private available(facilityId: string) {
    return and(eq(unitTypes.facilityId, facilityId), eq(unitTypes.isActive, true));
  }

  async findActiveUnitType(facilityId: string, unitTypeId: string): Promise<UnitType | undefined> {
    const [row] = await this.db
      .select({ unitType: unitTypes })
      .from(unitTypes)
      .where(and(this.available(facilityId), eq(unitTypes.id, unitTypeId)));
    return row?.unitType;
  }

  async listByFacility(facilityId: string, limit: number, offset: number): Promise<UnitType[]> {
    const rows = await this.db
      .select({ unitType: unitTypes })
      .from(unitTypes)
      .where(this.available(facilityId))
      .orderBy(asc(unitTypes.monthlyPrice), asc(unitTypes.id))
      .limit(limit)
      .offset(offset);
    return rows.map((row) => row.unitType);
  }
}
