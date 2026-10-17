import {
  and,
  type Database,
  desc,
  eq,
  type NewUnitType,
  type UnitType,
  unitTypes,
} from "@metastorage/database";
import { UNIT_TYPE_MESSAGES } from "./unit-types.messages";
import type { UpdateUnitTypeData } from "./unit-types.types";

export class UnitTypesRepository {
  constructor(private readonly db: Database) {}

  async create(data: NewUnitType): Promise<UnitType> {
    const [created] = await this.db.insert(unitTypes).values(data).returning();
    if (!created) {
      throw new Error(UNIT_TYPE_MESSAGES.failedToCreateUnitType);
    }
    return created;
  }

  async findById(id: string): Promise<UnitType | undefined> {
    const [unitType] = await this.db.select().from(unitTypes).where(eq(unitTypes.id, id));
    return unitType;
  }

  async findByCode(code: string): Promise<UnitType | undefined> {
    const [unitType] = await this.db.select().from(unitTypes).where(eq(unitTypes.code, code));
    return unitType;
  }

  async list(limit: number, offset: number, isActive?: boolean): Promise<UnitType[]> {
    return this.db
      .select()
      .from(unitTypes)
      .where(and(isActive === undefined ? undefined : eq(unitTypes.isActive, isActive)))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(unitTypes.createdAt), desc(unitTypes.id));
  }

  async update(id: string, data: UpdateUnitTypeData): Promise<UnitType | undefined> {
    const [updated] = await this.db
      .update(unitTypes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(unitTypes.id, id))
      .returning();
    return updated;
  }

  async delete(id: string): Promise<UnitType | undefined> {
    const [deleted] = await this.db.delete(unitTypes).where(eq(unitTypes.id, id)).returning();
    return deleted;
  }
}
