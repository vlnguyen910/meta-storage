import type {
  CreateRentalPriceRange,
  PricingChangeValues,
  PricingQuery,
  UpdateDepositPolicy,
  UpdateRentalPriceRange,
} from "@metastorage/contracts";
import { PRICING_MESSAGES as m, SystemSettingKey } from "@metastorage/contracts";
import {
  and,
  asc,
  type Database,
  desc,
  eq,
  gt,
  gte,
  isNotNull,
  lt,
  lte,
  or,
  pricingChanges,
  rentalPriceRanges,
  systemSettingChanges,
  systemSettingInteger,
  systemSettings,
  unitTypes,
} from "@metastorage/database";
import { AppError, ConflictError, NotFoundError } from "../../common/errors/app-error";
import type { PricingRevision, PricingTransaction, PricingWrite } from "./pricing.types";

const pricingPolicyFields = {
  depositMonths: systemSettingInteger,
  version: systemSettings.version,
  updatedBy: systemSettings.updatedBy,
  updatedAt: systemSettings.updatedAt,
};

export async function lockPricingRevision(
  tx: PricingTransaction,
  expectedVersion?: number,
): Promise<PricingRevision> {
  const [settings] = await tx
    .select(pricingPolicyFields)
    .from(systemSettings)
    .where(eq(systemSettings.key, SystemSettingKey.DEPOSIT_MONTHS))
    .for("update");
  if (!settings) throw new AppError(m.unavailable, 503, "PRICING_NOT_CONFIGURED");
  if (expectedVersion !== undefined && settings.version !== expectedVersion)
    throw new ConflictError(m.conflict);
  return settings;
}

export async function recordPricingChange(
  tx: PricingTransaction,
  settings: PricingRevision,
  actor: string,
  change: PricingWrite,
) {
  const version = settings.version + 1,
    now = new Date();
  const value =
    change.operation === "DEPOSIT_POLICY"
      ? (change.after as { depositMonths: number }).depositMonths
      : settings.depositMonths;
  await tx
    .update(systemSettings)
    .set({ value, version, updatedBy: actor, updatedAt: now })
    .where(eq(systemSettings.key, SystemSettingKey.DEPOSIT_MONTHS));
  await tx.insert(systemSettingChanges).values({
    key: SystemSettingKey.DEPOSIT_MONTHS,
    before: { value: settings.depositMonths, version: settings.version },
    after: { value, version },
    actorId: actor,
    source: change.operation,
    createdAt: now,
  });
  await tx.insert(pricingChanges).values({ version, ...change, changedBy: actor, changedAt: now });
  return { version };
}

export class PricingRepository {
  constructor(private readonly db: Database) {}

  getConfiguration(query: PricingQuery) {
    return this.db.transaction(async (tx) => {
      const [settings] = await tx
        .select(pricingPolicyFields)
        .from(systemSettings)
        .where(eq(systemSettings.key, SystemSettingKey.DEPOSIT_MONTHS))
        .for("share");
      if (!settings) throw new AppError(m.unavailable, 503, "PRICING_NOT_CONFIGURED");
      const prices = await tx
        .select({
          unitTypeId: unitTypes.id,
          facilityId: unitTypes.facilityId,
          priceRangeId: unitTypes.priceRangeId,
          code: unitTypes.code,
          name: unitTypes.name,
          monthlyPrice: unitTypes.monthlyPrice,
          isActive: unitTypes.isActive,
        })
        .from(unitTypes)
        .orderBy(asc(unitTypes.facilityId), asc(unitTypes.code))
        .limit(query.limit)
        .offset(query.offset);
      return {
        version: settings.version,
        depositMonths: settings.depositMonths,
        updatedBy: settings.updatedBy,
        updatedAt: settings.updatedAt,
        prices,
      };
    });
  }

  async findQuote(unitTypeId: string) {
    const [row] = await this.db
      .select({ monthlyPrice: unitTypes.monthlyPrice, depositMonths: systemSettingInteger })
      .from(unitTypes)
      .innerJoin(systemSettings, eq(systemSettings.key, SystemSettingKey.DEPOSIT_MONTHS))
      .innerJoin(rentalPriceRanges, eq(rentalPriceRanges.id, unitTypes.priceRangeId))
      .where(
        and(
          eq(unitTypes.id, unitTypeId),
          eq(unitTypes.isActive, true),
          eq(rentalPriceRanges.isActive, true),
          isNotNull(rentalPriceRanges.minMonthlyPrice),
          isNotNull(rentalPriceRanges.maxMonthlyPrice),
          gte(unitTypes.monthlyPrice, rentalPriceRanges.minMonthlyPrice),
          lte(unitTypes.monthlyPrice, rentalPriceRanges.maxMonthlyPrice),
        ),
      );
    return row ?? null;
  }

  updateDeposit(input: UpdateDepositPolicy, actor: string) {
    return this.db.transaction(async (tx) => {
      const settings = await lockPricingRevision(tx, input.expectedVersion);
      return recordPricingChange(tx, settings, actor, {
        operation: "DEPOSIT_POLICY",
        before: { depositMonths: settings.depositMonths },
        after: { depositMonths: input.depositMonths },
      });
    });
  }

  ranges(query: PricingQuery) {
    return this.db
      .select()
      .from(rentalPriceRanges)
      .orderBy(asc(rentalPriceRanges.code))
      .limit(query.limit)
      .offset(query.offset);
  }

  createRange(input: CreateRentalPriceRange, actor: string) {
    return this.db.transaction(async (tx) => {
      const settings = await lockPricingRevision(tx);
      const [row] = await tx
        .insert(rentalPriceRanges)
        .values({ ...input, updatedBy: actor })
        .onConflictDoNothing({ target: rentalPriceRanges.code })
        .returning();
      if (!row) throw new ConflictError(m.rangeCodeExists);
      await recordPricingChange(tx, settings, actor, {
        operation: "RENTAL_PRICE_RANGE",
        before: {
          priceRangeId: row.id,
          code: row.code,
          name: row.name,
          minMonthlyPrice: null,
          maxMonthlyPrice: null,
          isActive: row.isActive,
        },
        after: rangeValues(row),
      });
      return row;
    });
  }

  updateRange(id: string, input: UpdateRentalPriceRange, actor: string) {
    return this.db.transaction(async (tx) => {
      const settings = await lockPricingRevision(tx);
      const [before] = await tx
        .select()
        .from(rentalPriceRanges)
        .where(eq(rentalPriceRanges.id, id))
        .for("update");
      if (!before) throw new NotFoundError(m.rangeNotFound);
      if (before.version !== input.expectedVersion) throw new ConflictError(m.conflict);
      const [outside] = await tx
        .select({ id: unitTypes.id })
        .from(unitTypes)
        .where(
          and(
            eq(unitTypes.priceRangeId, id),
            or(
              lt(unitTypes.monthlyPrice, input.minMonthlyPrice),
              gt(unitTypes.monthlyPrice, input.maxMonthlyPrice),
            ),
          ),
        )
        .limit(1);
      if (outside) throw new ConflictError(m.rangeInUse);
      const [row] = await tx
        .update(rentalPriceRanges)
        .set({
          name: input.name ?? before.name,
          minMonthlyPrice: input.minMonthlyPrice,
          maxMonthlyPrice: input.maxMonthlyPrice,
          isActive: input.isActive ?? before.isActive,
          version: before.version + 1,
          updatedBy: actor,
          updatedAt: new Date(),
        })
        .where(eq(rentalPriceRanges.id, id))
        .returning();
      if (!row) throw new NotFoundError(m.rangeNotFound);
      await recordPricingChange(tx, settings, actor, {
        operation: "RENTAL_PRICE_RANGE",
        before: rangeValues(before),
        after: rangeValues(row),
      });
      return row;
    });
  }

  history(query: PricingQuery) {
    return this.db
      .select()
      .from(pricingChanges)
      .orderBy(desc(pricingChanges.version))
      .limit(query.limit)
      .offset(query.offset);
  }
}

function rangeValues(row: typeof rentalPriceRanges.$inferSelect): PricingChangeValues {
  return {
    priceRangeId: row.id,
    code: row.code,
    name: row.name,
    minMonthlyPrice: row.minMonthlyPrice,
    maxMonthlyPrice: row.maxMonthlyPrice,
    isActive: row.isActive,
  };
}
