import type { PricingQuery, UpdateDepositPolicy } from "@metastorage/contracts";
import {
  PRICING_MESSAGES as m,
  SYSTEM_SETTING_DEFINITIONS,
  SystemSettingKey,
} from "@metastorage/contracts";
import {
  and,
  asc,
  type Database,
  desc,
  eq,
  facilityUnitTypes,
  getTableColumns,
  pricingChanges,
  sql,
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
          unitTypeId: facilityUnitTypes.id,
          facilityId: facilityUnitTypes.facilityId,
          code: unitTypes.code,
          name: unitTypes.name,
          monthlyPrice: facilityUnitTypes.monthlyPrice,
          priceRangeId: sql<string | null>`null`,
          isActive: sql<boolean>`${unitTypes.isActive} and ${facilityUnitTypes.isActive}`,
        })
        .from(facilityUnitTypes)
        .innerJoin(unitTypes, eq(unitTypes.id, facilityUnitTypes.unitTypeId))
        .orderBy(asc(facilityUnitTypes.facilityId), asc(unitTypes.code))
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

  async getVatRate(executor: Database | PricingTransaction = this.db) {
    const [row] = await executor
      .select({ value: systemSettingInteger })
      .from(systemSettings)
      .where(eq(systemSettings.key, SystemSettingKey.VAT_RATE));
    return row?.value ?? SYSTEM_SETTING_DEFINITIONS.VAT_RATE.defaultValue;
  }

  async findQuote(unitTypeId: string) {
    const [row] = await this.db
      .select({ monthlyPrice: facilityUnitTypes.monthlyPrice, depositMonths: systemSettingInteger })
      .from(facilityUnitTypes)
      .innerJoin(unitTypes, eq(unitTypes.id, facilityUnitTypes.unitTypeId))
      .innerJoin(systemSettings, eq(systemSettings.key, SystemSettingKey.DEPOSIT_MONTHS))
      .where(
        and(
          eq(facilityUnitTypes.id, unitTypeId),
          eq(unitTypes.isActive, true),
          eq(facilityUnitTypes.isActive, true),
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
