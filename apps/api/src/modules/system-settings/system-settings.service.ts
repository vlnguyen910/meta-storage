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
import { ForbiddenError } from "../../common/errors/app-error";
import { PricingRepository } from "../pricing/pricing.repository";
import { RentalLifecycleSettingsRepository } from "../rental-lifecycle-settings/rental-lifecycle-settings.repository";
import { RentalLifecycleSettingsService } from "../rental-lifecycle-settings/rental-lifecycle-settings.service";
import { ReturnsRepository } from "../returns/returns.repository";
import { ReturnsService } from "../returns/returns.service";
import type { SystemSettingsRepository } from "./system-settings.repository";

export class SystemSettingsService {
  constructor(private readonly repository: SystemSettingsRepository) {}
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
    } else if (input.key === "OVERDUE_FEE_RATE") {
      const result = await new ReturnsService(
        new ReturnsRepository(this.repository.db),
      ).configureRate(actor, { rate: input.value, expectedVersion: input.expectedVersion });
      version = result.version;
    } else {
      const result = await new RentalLifecycleSettingsService(
        new RentalLifecycleSettingsRepository(this.repository.db),
      ).update(actor, input);
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
}
