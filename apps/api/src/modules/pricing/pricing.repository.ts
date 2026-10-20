import type {
  PricingChangeValues,
  PricingQuery,
  UpdateDepositPolicy,
  UpdateUnitTypePrice,
} from "@metastorage/contracts";
import { PRICING_MESSAGES as m, SystemSettingKey } from "@metastorage/contracts";
import {
  asc,
  type Database,
  desc,
  eq,
  pricingChanges,
  systemSettingChanges,
  systemSettingInteger,
  systemSettings,
  unitTypes,
} from "@metastorage/database";
import { AppError, ConflictError, NotFoundError } from "../../common/errors/app-error";

const pricingPolicyFields = {
  depositMonths: systemSettingInteger,
  version: systemSettings.version,
  updatedBy: systemSettings.updatedBy,
  updatedAt: systemSettings.updatedAt,
};

export class PricingRepository {
  constructor(private readonly db: Database) {}

  async getConfiguration(query: PricingQuery) {
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
          code: unitTypes.code,
          name: unitTypes.name,
          monthlyPrice: unitTypes.monthlyPrice,
          isActive: unitTypes.isActive,
        })
        .from(unitTypes)
        .orderBy(asc(unitTypes.code))
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
    // One statement gives a consistent price/policy snapshot. No default policy is synthesized.
    const [row] = await this.db
      .select({
        monthlyPrice: unitTypes.monthlyPrice,
        depositMonths: systemSettingInteger,
      })
      .from(unitTypes)
      .innerJoin(systemSettings, eq(systemSettings.key, SystemSettingKey.DEPOSIT_MONTHS))
      .where(eq(unitTypes.id, unitTypeId));
    return row ?? null;
  }

  async updateDeposit(input: UpdateDepositPolicy, actor: string) {
    return this.update(input.expectedVersion, actor, async (tx) => {
      const [row] = await tx
        .select({ depositMonths: systemSettingInteger })
        .from(systemSettings)
        .where(eq(systemSettings.key, SystemSettingKey.DEPOSIT_MONTHS));
      if (!row) throw new AppError(m.unavailable, 503, "PRICING_NOT_CONFIGURED");
      await tx
        .update(systemSettings)
        .set({ value: input.depositMonths })
        .where(eq(systemSettings.key, SystemSettingKey.DEPOSIT_MONTHS));
      return {
        operation: "DEPOSIT_POLICY",
        before: row,
        after: { depositMonths: input.depositMonths },
      };
    });
  }

  async updatePrice(unitTypeId: string, input: UpdateUnitTypePrice, actor: string) {
    return this.update(input.expectedVersion, actor, async (tx) => {
      const [row] = await tx
        .select({ monthlyPrice: unitTypes.monthlyPrice })
        .from(unitTypes)
        .where(eq(unitTypes.id, unitTypeId))
        .for("update");
      if (!row) throw new NotFoundError(m.unitTypeNotFound);
      await tx
        .update(unitTypes)
        .set({ monthlyPrice: input.monthlyPrice, updatedAt: new Date() })
        .where(eq(unitTypes.id, unitTypeId));
      return {
        operation: "UNIT_TYPE_PRICE",
        before: { unitTypeId, monthlyPrice: row.monthlyPrice },
        after: { unitTypeId, monthlyPrice: input.monthlyPrice },
      };
    });
  }

  async history(query: PricingQuery) {
    return this.db
      .select({
        id: pricingChanges.id,
        version: pricingChanges.version,
        operation: pricingChanges.operation,
        before: pricingChanges.before,
        after: pricingChanges.after,
        changedBy: pricingChanges.changedBy,
        changedAt: pricingChanges.changedAt,
      })
      .from(pricingChanges)
      .orderBy(desc(pricingChanges.version))
      .limit(query.limit)
      .offset(query.offset);
  }

  private async update(
    expectedVersion: number,
    actor: string,
    change: (tx: Parameters<Parameters<Database["transaction"]>[0]>[0]) => Promise<{
      operation: "DEPOSIT_POLICY" | "UNIT_TYPE_PRICE";
      before: PricingChangeValues;
      after: PricingChangeValues;
    }>,
  ) {
    return this.db.transaction(async (tx) => {
      // Both price and deposit writes lock the singleton first, so the shared version
      // represents the entire pricing configuration and stale updates cannot win.
      const [settings] = await tx
        .select(pricingPolicyFields)
        .from(systemSettings)
        .where(eq(systemSettings.key, SystemSettingKey.DEPOSIT_MONTHS))
        .for("update");
      if (!settings) throw new AppError(m.unavailable, 503, "PRICING_NOT_CONFIGURED");
      if (settings.version !== expectedVersion) throw new ConflictError(m.conflict);
      const changed = await change(tx);
      const version = settings.version + 1;
      const now = new Date();
      await tx
        .update(systemSettings)
        .set({ version, updatedBy: actor, updatedAt: now })
        .where(eq(systemSettings.key, SystemSettingKey.DEPOSIT_MONTHS));
      await tx.insert(systemSettingChanges).values({
        key: SystemSettingKey.DEPOSIT_MONTHS,
        before: { value: settings.depositMonths, version: settings.version },
        after: {
          value:
            changed.operation === "DEPOSIT_POLICY"
              ? (changed.after as { depositMonths: number }).depositMonths
              : settings.depositMonths,
          version,
        },
        actorId: actor,
        source: changed.operation,
        createdAt: now,
      });
      await tx.insert(pricingChanges).values({
        version,
        operation: changed.operation,
        before: changed.before,
        after: changed.after,
        changedBy: actor,
        changedAt: now,
      });
      return { version };
    });
  }
}
