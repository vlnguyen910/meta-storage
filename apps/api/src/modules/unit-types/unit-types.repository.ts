import type { CreateUnitTypeCatalog, UpdateUnitTypeCatalog } from "@metastorage/contracts";
import {
  and,
  type Database,
  desc,
  eq,
  facilityUnitTypes,
  gt,
  lt,
  ne,
  or,
  unitTypes,
} from "@metastorage/database";
import { ConflictError, NotFoundError } from "../../common/errors/app-error";
import { lockPricingRevision, recordPricingChange } from "../pricing/pricing.repository";
import { UNIT_TYPE_MESSAGES as M } from "./unit-types.messages";

export class UnitTypesRepository {
  constructor(private readonly db: Database) {}
  list(limit: number, offset: number, isActive?: boolean) {
    return this.db
      .select()
      .from(unitTypes)
      .where(isActive === undefined ? undefined : eq(unitTypes.isActive, isActive))
      .orderBy(desc(unitTypes.createdAt), desc(unitTypes.id))
      .limit(limit)
      .offset(offset);
  }
  async create(input: CreateUnitTypeCatalog, actor: string) {
    const [row] = await this.db
      .insert(unitTypes)
      .values({ ...input, updatedBy: actor })
      .onConflictDoNothing({ target: unitTypes.code })
      .returning();
    if (!row) throw new ConflictError(M.codeAlreadyExists);
    return row;
  }
  update(id: string, input: UpdateUnitTypeCatalog, actor: string) {
    return this.db.transaction(async (tx) => {
      const revision = await lockPricingRevision(tx);
      const [before] = await tx.select().from(unitTypes).where(eq(unitTypes.id, id)).for("update");
      if (!before) throw new NotFoundError(M.unitTypeNotFound);
      if (before.version !== input.expectedVersion) throw new ConflictError(M.stale);
      const min = input.minMonthlyPrice ?? before.minMonthlyPrice;
      const max = input.maxMonthlyPrice ?? before.maxMonthlyPrice;
      if (min > max) throw new ConflictError(M.invalidBounds);
      const [outside] = await tx
        .select({ id: facilityUnitTypes.id })
        .from(facilityUnitTypes)
        .where(
          and(
            eq(facilityUnitTypes.unitTypeId, id),
            or(lt(facilityUnitTypes.monthlyPrice, min), gt(facilityUnitTypes.monthlyPrice, max)),
          ),
        )
        .limit(1);
      if (outside) throw new ConflictError(M.pricesInUse);
      const dimensionsChanged =
        (input.lengthM !== undefined && input.lengthM !== before.lengthM) ||
        (input.widthM !== undefined && input.widthM !== before.widthM) ||
        (input.heightM !== undefined && input.heightM !== before.heightM);
      if (dimensionsChanged) {
        const [used] = await tx
          .select({ id: facilityUnitTypes.id })
          .from(facilityUnitTypes)
          .where(eq(facilityUnitTypes.unitTypeId, id))
          .limit(1);
        if (used) throw new ConflictError(M.dimensionsInUse);
      }
      if (input.code && input.code !== before.code) {
        const [duplicate] = await tx
          .select({ id: unitTypes.id })
          .from(unitTypes)
          .where(and(eq(unitTypes.code, input.code), ne(unitTypes.id, id)))
          .limit(1);
        if (duplicate) throw new ConflictError(M.codeAlreadyExists);
      }
      const { expectedVersion: _, ...values } = input;
      const [row] = await tx
        .update(unitTypes)
        .set({ ...values, version: before.version + 1, updatedBy: actor, updatedAt: new Date() })
        .where(eq(unitTypes.id, id))
        .returning();
      if (!row) throw new NotFoundError(M.unitTypeNotFound);
      if (min !== before.minMonthlyPrice || max !== before.maxMonthlyPrice)
        await recordPricingChange(tx, revision, actor, {
          operation: "UNIT_TYPE_PRICE_RANGE",
          before: {
            unitTypeId: id,
            minMonthlyPrice: before.minMonthlyPrice,
            maxMonthlyPrice: before.maxMonthlyPrice,
          },
          after: { unitTypeId: id, minMonthlyPrice: min, maxMonthlyPrice: max },
        });
      return row;
    });
  }
}
