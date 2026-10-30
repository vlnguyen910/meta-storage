import type { CreateUnitTypeInput, UpdateUnitTypeInput } from "@metastorage/contracts";
import {
  and,
  bookings,
  type Database,
  desc,
  eq,
  facilityAssignments,
  gt,
  isNull,
  ne,
  or,
  type UnitType,
  unitTypes,
  users,
} from "@metastorage/database";
import { ConflictError, ForbiddenError, NotFoundError } from "../../common/errors/app-error";
import { lockPricingRevision, recordPricingChange } from "../pricing/pricing.repository";
import type { PricingTransaction } from "../pricing/pricing.types";
import { UNIT_TYPE_MESSAGES as M } from "./unit-types.messages";

export class UnitTypesRepository {
  constructor(private readonly db: Database) {}

  async managerFacility(userId: string, facilityId?: string) {
    const [row] = await this.db
      .select({ facilityId: facilityAssignments.facilityId })
      .from(facilityAssignments)
      .where(
        and(
          eq(facilityAssignments.userId, userId),
          eq(facilityAssignments.role, "FACILITY_MANAGER"),
          eq(facilityAssignments.isActive, true),
          or(isNull(facilityAssignments.endedAt), gt(facilityAssignments.endedAt, new Date())),
          facilityId ? eq(facilityAssignments.facilityId, facilityId) : undefined,
        ),
      );
    return row?.facilityId;
  }

  private async manager(tx: PricingTransaction, facilityId: string, actor: string) {
    const [row] = await tx
      .select({ id: facilityAssignments.id })
      .from(facilityAssignments)
      .innerJoin(users, eq(users.id, facilityAssignments.userId))
      .where(
        and(
          eq(users.id, actor),
          eq(users.role, "FACILITY_MANAGER"),
          eq(users.status, "ACTIVE"),
          eq(facilityAssignments.facilityId, facilityId),
          eq(facilityAssignments.role, "FACILITY_MANAGER"),
          eq(facilityAssignments.isActive, true),
          or(isNull(facilityAssignments.endedAt), gt(facilityAssignments.endedAt, new Date())),
        ),
      )
      .for("share");
    if (!row) throw new ForbiddenError(M.forbidden);
  }

  async create(input: CreateUnitTypeInput, actor: string): Promise<UnitType> {
    return this.db.transaction(async (tx) => {
      const revision = await lockPricingRevision(tx);
      await this.manager(tx, input.facilityId, actor);
      const [created] = await tx
        .insert(unitTypes)
        .values({ ...input, updatedBy: actor })
        .onConflictDoNothing({ target: [unitTypes.facilityId, unitTypes.code] })
        .returning();
      if (!created) throw new ConflictError(M.codeAlreadyExists);
      await recordPricingChange(tx, revision, actor, {
        operation: "UNIT_TYPE_PRICE",
        before: {
          facilityId: created.facilityId,
          unitTypeId: created.id,

          monthlyPrice: null,
        },
        after: {
          facilityId: created.facilityId,
          unitTypeId: created.id,

          monthlyPrice: created.monthlyPrice,
        },
      });
      return created;
    });
  }

  async findById(id: string): Promise<UnitType | undefined> {
    const [row] = await this.db.select().from(unitTypes).where(eq(unitTypes.id, id));
    return row;
  }

  async list(
    limit: number,
    offset: number,
    isActive?: boolean,
    facilityId?: string,
  ): Promise<UnitType[]> {
    return this.db
      .select()
      .from(unitTypes)
      .where(
        and(
          isActive === undefined ? undefined : eq(unitTypes.isActive, isActive),
          facilityId ? eq(unitTypes.facilityId, facilityId) : undefined,
        ),
      )
      .limit(limit)
      .offset(offset)
      .orderBy(desc(unitTypes.createdAt), desc(unitTypes.id));
  }

  async update(id: string, input: UpdateUnitTypeInput, actor: string): Promise<UnitType> {
    const initial = await this.findById(id);
    if (!initial) throw new NotFoundError(M.unitTypeNotFound);
    return this.db.transaction(async (tx) => {
      const revision = await lockPricingRevision(tx);
      await this.manager(tx, initial.facilityId, actor);
      const [before] = await tx.select().from(unitTypes).where(eq(unitTypes.id, id)).for("update");
      if (!before) throw new NotFoundError(M.unitTypeNotFound);
      if (before.version !== input.expectedVersion) throw new ConflictError(M.stale);
      if (input.code && input.code !== before.code) {
        const [duplicate] = await tx
          .select({ id: unitTypes.id })
          .from(unitTypes)
          .where(
            and(
              eq(unitTypes.facilityId, before.facilityId),
              eq(unitTypes.code, input.code),
              ne(unitTypes.id, id),
            ),
          )
          .limit(1);
        if (duplicate) throw new ConflictError(M.codeAlreadyExists);
      }
      const dimensionsChanged =
        (input.lengthM !== undefined && input.lengthM !== before.lengthM) ||
        (input.widthM !== undefined && input.widthM !== before.widthM) ||
        (input.heightM !== undefined && input.heightM !== before.heightM);
      if (dimensionsChanged) {
        const [booking] = await tx
          .select({ id: bookings.id })
          .from(bookings)
          .where(eq(bookings.unitTypeId, id))
          .limit(1);
        if (booking) throw new ConflictError(M.dimensionsInUse);
      }
      const { expectedVersion: _version, ...values } = input;
      const [updated] = await tx
        .update(unitTypes)
        .set({ ...values, version: before.version + 1, updatedBy: actor, updatedAt: new Date() })
        .where(eq(unitTypes.id, id))
        .returning();
      if (!updated) throw new NotFoundError(M.unitTypeNotFound);
      if (before.monthlyPrice !== updated.monthlyPrice)
        await recordPricingChange(tx, revision, actor, {
          operation: "UNIT_TYPE_PRICE",
          before: {
            facilityId: before.facilityId,
            unitTypeId: id,

            monthlyPrice: before.monthlyPrice,
          },
          after: {
            facilityId: updated.facilityId,
            unitTypeId: id,

            monthlyPrice: updated.monthlyPrice,
          },
        });
      return updated;
    });
  }
}
