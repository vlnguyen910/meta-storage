import type { CreateFacilityUnitType, UpdateFacilityUnitType } from "@metastorage/contracts";
import {
  and,
  asc,
  type Database,
  eq,
  facilityUnitTypes,
  getTableColumns,
  sql,
  unitTypes,
} from "@metastorage/database";
import { ConflictError, ForbiddenError, NotFoundError } from "../../common/errors/app-error";
import { FacilityAssignmentsRepository } from "../facilities/facility-assignments.repository";
import { lockPricingRevision, recordPricingChange } from "../pricing/pricing.repository";
import { UNIT_TYPE_MESSAGES as M } from "./unit-types.messages";

export class FacilityUnitTypesRepository {
  constructor(readonly db: Database) {}
  // Public unitTypeId values remain offering IDs; catalog metadata is flattened for clients.
  private readQuery() {
    return this.db
      .select({
        ...getTableColumns(unitTypes),
        ...getTableColumns(facilityUnitTypes),
        catalogUnitTypeId: unitTypes.id,
        isActive: sql<boolean>`${unitTypes.isActive} and ${facilityUnitTypes.isActive}`,
      })
      .from(facilityUnitTypes)
      .innerJoin(unitTypes, eq(unitTypes.id, facilityUnitTypes.unitTypeId));
  }
  async findActiveUnitType(facilityId: string, id: string) {
    const [row] = await this.readQuery().where(
      and(
        eq(facilityUnitTypes.facilityId, facilityId),
        eq(facilityUnitTypes.id, id),
        eq(facilityUnitTypes.isActive, true),
        eq(unitTypes.isActive, true),
      ),
    );
    return row;
  }
  listByFacility(facilityId: string, limit: number, offset: number, isActive?: boolean) {
    return this.readQuery()
      .where(
        and(
          eq(facilityUnitTypes.facilityId, facilityId),
          isActive === undefined ? undefined : eq(facilityUnitTypes.isActive, isActive),
          isActive === true ? eq(unitTypes.isActive, true) : undefined,
        ),
      )
      .orderBy(asc(unitTypes.code), asc(facilityUnitTypes.id))
      .limit(limit)
      .offset(offset);
  }
  async findById(id: string) {
    const [row] = await this.readQuery().where(eq(facilityUnitTypes.id, id));
    return row;
  }
  save(
    facilityId: string,
    input: CreateFacilityUnitType | UpdateFacilityUnitType,
    actor: string,
    id?: string,
  ) {
    return this.db.transaction(async (tx) => {
      const revision = await lockPricingRevision(tx);
      const assignments = await new FacilityAssignmentsRepository(this.db).lockActiveAssignments(
        tx,
        facilityId,
        [{ userId: actor, role: "FACILITY_MANAGER" }],
      );
      if (assignments.size !== 1) throw new ForbiddenError(M.forbidden);
      const [before] = id
        ? await tx
            .select()
            .from(facilityUnitTypes)
            .where(and(eq(facilityUnitTypes.id, id), eq(facilityUnitTypes.facilityId, facilityId)))
            .for("update")
        : [];
      if (id && !before) throw new NotFoundError(M.facilityUnitTypeUnavailable);
      if (before && "expectedVersion" in input && before.version !== input.expectedVersion)
        throw new ConflictError(M.stale);
      const typeId = before?.unitTypeId ?? (input as CreateFacilityUnitType).unitTypeId;
      const [catalog] = await tx
        .select()
        .from(unitTypes)
        .where(eq(unitTypes.id, typeId))
        .for("share");
      if (
        !catalog ||
        (!catalog.isActive && (!before || ("isActive" in input && input.isActive === true)))
      )
        throw new NotFoundError(M.unitTypeUnavailable);
      const price = input.monthlyPrice ?? before?.monthlyPrice;
      if (price === undefined) throw new ConflictError(M.priceOutsideBounds);
      if (price < catalog.minMonthlyPrice || price > catalog.maxMonthlyPrice)
        throw new ConflictError(M.priceOutsideBounds);
      const values = { monthlyPrice: price, updatedBy: actor, updatedAt: new Date() };
      const [row] = before
        ? await tx
            .update(facilityUnitTypes)
            .set({
              ...values,
              isActive: "isActive" in input ? input.isActive : before.isActive,
              version: before.version + 1,
            })
            .where(eq(facilityUnitTypes.id, before.id))
            .returning()
        : await tx
            .insert(facilityUnitTypes)
            .values({ ...values, facilityId, unitTypeId: typeId })
            .onConflictDoNothing()
            .returning();
      if (!row) throw new ConflictError(M.alreadyAssigned);
      if (!before || before.monthlyPrice !== row.monthlyPrice)
        await recordPricingChange(tx, revision, actor, {
          operation: "UNIT_TYPE_PRICE",
          before: { facilityId, unitTypeId: row.id, monthlyPrice: before?.monthlyPrice ?? null },
          after: { facilityId, unitTypeId: row.id, monthlyPrice: row.monthlyPrice },
        });
      return row;
    });
  }
}
