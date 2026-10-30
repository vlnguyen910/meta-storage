import {
  type ConfigureSystemSetting,
  SYSTEM_SETTING_MESSAGES as m,
  SYSTEM_SETTING_DEFINITIONS,
  type SystemSettingChangeDto,
  type SystemSettingDto,
  type SystemSettingHistoryQuery,
  type SystemSettingKeyValue,
  type SystemSettingUpdateResult,
} from "@metastorage/contracts";
import type { Database } from "@metastorage/database";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../common/errors/app-error";
import { PricingRepository } from "../pricing/pricing.repository";
import type { SystemSettingsRepository } from "./system-settings.repository";

export class SystemSettingsService {
  constructor(private readonly repository: SystemSettingsRepository) {}
  getRenewalNoticeSetting(tx: Parameters<Parameters<Database["transaction"]>[0]>[0]) {
    return this.repository.find("RENEWAL_NOTICE_DAYS", tx);
  }
  async getOpeningHour(): Promise<number> {
    const setting = await this.repository.find("OPENING_HOUR");
    if (!setting) throw new NotFoundError(m.notFound);
    return Number(setting.value);
  }
  async getClosingHour(): Promise<number> {
    const setting = await this.repository.find("CLOSING_HOUR");
    if (!setting) throw new NotFoundError(m.notFound);
    return Number(setting.value);
  }
  private authorize(role: string | null | undefined, key?: SystemSettingKeyValue) {
    if (
      key
        ? role !== SYSTEM_SETTING_DEFINITIONS[key].role
        : !["SYSTEM_ADMIN", "BUSINESS_OPERATION_MANAGER"].includes(role ?? "")
    )
      throw new ForbiddenError(m.forbidden);
  }
  async list(actor: { role: string | null | undefined }): Promise<SystemSettingDto[]> {
    this.authorize(actor.role);
    return (await this.repository.list())
      .filter(
        (row) =>
          Object.hasOwn(SYSTEM_SETTING_DEFINITIONS, row.key) &&
          SYSTEM_SETTING_DEFINITIONS[row.key].role === actor.role,
      )
      .map((row) => {
        const { category, valueType, unit } = SYSTEM_SETTING_DEFINITIONS[row.key];
        return { ...row, category, valueType, unit, updatedAt: row.updatedAt.toISOString() };
      });
  }
  async update(
    actor: { id: string; role: string | null | undefined },
    input: ConfigureSystemSetting,
  ): Promise<SystemSettingUpdateResult> {
    this.authorize(actor.role, input.key);
    // Delegate to the same domain operations as existing APIs, preserving pricing's
    // shared revision, snapshot semantics and financial authorization/audit.
    let version: number;
    if (input.key === "DEPOSIT_MONTHS") {
      const result = await new PricingRepository(this.repository.db).updateDeposit(
        { depositMonths: input.value, expectedVersion: input.expectedVersion },
        actor.id,
      );
      version = result.version;
    } else if (input.key !== "OPENING_HOUR" && input.key !== "CLOSING_HOUR") {
      version = await this.repository.db.transaction(async (tx) => {
        const before = await this.repository.lock(input.key, tx);
        if (!before) throw new NotFoundError(m.notFound);
        if (before.version !== input.expectedVersion) throw new ConflictError(m.stale);
        const after = await this.repository.save(
          input.key,
          input.value,
          before.version + 1,
          actor.id,
          tx,
        );
        if (!after) throw new NotFoundError(m.notFound);
        await this.repository.audit(
          tx,
          input.key,
          actor.id,
          { value: Number(before.value), version: before.version },
          { value: Number(after.value), version: after.version },
        );
        return after.version;
      });
    } else {
      const keys = ["CLOSING_HOUR", "OPENING_HOUR"] as const;
      const result = await this.repository.db.transaction(async (tx) => {
        const rows = new Map();
        for (const key of keys) {
          const row = await this.repository.lock(key, tx);
          if (!row) throw new NotFoundError(m.notFound);
          rows.set(key, row);
        }
        const before = rows.get(input.key);
        if (before.version !== input.expectedVersion) throw new ConflictError(m.stale);
        const opening =
          input.key === "OPENING_HOUR" ? input.value : Number(rows.get("OPENING_HOUR").value);
        const closing =
          input.key === "CLOSING_HOUR" ? input.value : Number(rows.get("CLOSING_HOUR").value);
        if (opening >= closing) throw new ValidationError(m.invalid);
        const after = await this.repository.save(
          input.key,
          input.value,
          before.version + 1,
          actor.id,
          tx,
        );
        if (!after) throw new NotFoundError(m.notFound);
        await this.repository.audit(
          tx,
          input.key,
          actor.id,
          { value: Number(before.value), version: before.version },
          { value: Number(after.value), version: after.version },
        );
        return after;
      });
      version = result.version;
    }
    return { key: input.key, value: input.value, version };
  }
  async history(
    actor: { role: string | null | undefined },
    key: SystemSettingKeyValue,
    query: SystemSettingHistoryQuery,
  ): Promise<SystemSettingChangeDto[]> {
    this.authorize(actor.role, key);
    return (await this.repository.history(key, query)).map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    }));
  }
  async getOverdueRate(actor: { role: string | null | undefined }) {
    this.authorize(actor.role, "OVERDUE_FEE_RATE");
    const row = await this.repository.find("OVERDUE_FEE_RATE");
    if (!row) throw new NotFoundError(m.notFound);
    return { rate: Number(row.value), version: row.version };
  }
  async configureOverdueRate(
    actor: { id: string; role: string | null | undefined },
    input: { rate: number; expectedVersion: number },
  ) {
    this.authorize(actor.role, "OVERDUE_FEE_RATE");
    const result = await this.update(actor, {
      key: "OVERDUE_FEE_RATE",
      value: input.rate,
      expectedVersion: input.expectedVersion,
    });
    return { rate: result.value, version: result.version };
  }
}
