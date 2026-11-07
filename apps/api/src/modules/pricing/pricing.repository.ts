import type {
  CreatePriceRange,
  PricingQuery,
  UpdateDepositPolicy,
  UpdatePriceRange,
} from "@metastorage/contracts";
import { PRICING_MESSAGES as m, SystemSettingKey } from "@metastorage/contracts";
import {
  and,
  asc,
  type Database,
  desc,
  eq,
  getTableColumns,
  ne,
  pricingChanges,
  rentalPriceRanges,
  systemSettingChanges,
  systemSettingInteger,
  systemSettings,
  unitTypes,
  users,
} from "@metastorage/database";
import { AppError, ConflictError } from "../../common/errors/app-error";
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

  listPriceRanges(query: PricingQuery) {
    return this.db
      .select()
      .from(rentalPriceRanges)
      .orderBy(
        desc(rentalPriceRanges.isActive),
        asc(rentalPriceRanges.minMonthlyPrice),
        asc(rentalPriceRanges.code),
      )
      .limit(query.limit)
      .offset(query.offset);
  }

  async createPriceRange(input: CreatePriceRange, actor: string) {
    const [created] = await this.db
      .insert(rentalPriceRanges)
      .values({ ...input, updatedBy: actor })
      .onConflictDoNothing({ target: rentalPriceRanges.code })
      .returning();
    if (!created) throw new ConflictError(m.rangeCodeExists);
    return created;
  }

  updatePriceRange(id: string, input: UpdatePriceRange, actor: string) {
    return this.db.transaction(async (tx) => {
      const [before] = await tx
        .select()
        .from(rentalPriceRanges)
        .where(eq(rentalPriceRanges.id, id))
        .for("update");
      if (!before) throw new AppError(m.rangeNotFound, 404, "PRICE_RANGE_NOT_FOUND");
      if (before.version !== input.expectedVersion) throw new ConflictError(m.conflict);

      if (input.code && input.code !== before.code) {
        const [duplicate] = await tx
          .select({ id: rentalPriceRanges.id })
          .from(rentalPriceRanges)
          .where(and(eq(rentalPriceRanges.code, input.code), ne(rentalPriceRanges.id, id)))
          .limit(1);
        if (duplicate) throw new ConflictError(m.rangeCodeExists);
      }

      const minMonthlyPrice =
        input.minMonthlyPrice === undefined ? before.minMonthlyPrice : input.minMonthlyPrice;
      const maxMonthlyPrice =
        input.maxMonthlyPrice === undefined ? before.maxMonthlyPrice : input.maxMonthlyPrice;
      const isActive = input.isActive ?? before.isActive;
      if (!isValidPriceRange(minMonthlyPrice, maxMonthlyPrice))
        throw new ConflictError(m.rangeBoundsInvalid);

      const assignedTypes = await tx
        .select({ monthlyPrice: unitTypes.monthlyPrice })
        .from(unitTypes)
        .where(eq(unitTypes.priceRangeId, id));
      if (
        assignedTypes.some(
          ({ monthlyPrice }) => !containsPrice(monthlyPrice, minMonthlyPrice, maxMonthlyPrice),
        ) ||
        (!isActive && assignedTypes.length > 0)
      )
        throw new ConflictError(m.rangeInUse);

      const [updated] = await tx
        .update(rentalPriceRanges)
        .set({
          code: input.code ?? before.code,
          name: input.name ?? before.name,
          minMonthlyPrice,
          maxMonthlyPrice,
          isActive,
          version: before.version + 1,
          updatedBy: actor,
          updatedAt: new Date(),
        })
        .where(eq(rentalPriceRanges.id, id))
        .returning();
      if (!updated) throw new AppError(m.rangeNotFound, 404, "PRICE_RANGE_NOT_FOUND");
      return updated;
    });
  }

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
          code: unitTypes.code,
          name: unitTypes.name,
          monthlyPrice: unitTypes.monthlyPrice,
          priceRangeId: unitTypes.priceRangeId,
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
      .where(and(eq(unitTypes.id, unitTypeId), eq(unitTypes.isActive, true)));
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

  history(query: PricingQuery) {
    return this.db
      .select({
        ...getTableColumns(pricingChanges),
        user: {
          name: users.name,
        },
      })
      .from(pricingChanges)
      .innerJoin(users, eq(pricingChanges.changedBy, users.id))
      .orderBy(desc(pricingChanges.version))
      .limit(query.limit)
      .offset(query.offset);
  }
}

function isValidPriceRange(min: number | null, max: number | null) {
  return (min === null && max === null) || (min !== null && max !== null && min > 0 && max >= min);
}

function containsPrice(price: number, min: number | null, max: number | null) {
  return (
    (min === null && max === null) || (min !== null && max !== null && price >= min && price <= max)
  );
}
