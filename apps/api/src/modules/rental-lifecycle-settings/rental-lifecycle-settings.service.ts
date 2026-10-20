import {
  type ConfigureRentalLifecycleSetting,
  RENTAL_LIFECYCLE_SETTING_MESSAGES as messages,
  type RentalLifecycleSettingDto,
} from "@metastorage/contracts";
import { ConflictError, ForbiddenError, NotFoundError } from "../../common/errors/app-error";
import type { RentalLifecycleSettingsRepository } from "./rental-lifecycle-settings.repository";

function dto(row: {
  key: RentalLifecycleSettingDto["key"];
  value: number;
  description: string;
  version: number;
  updatedAt: Date;
}): RentalLifecycleSettingDto {
  return { ...row, updatedAt: row.updatedAt.toISOString() };
}

export class RentalLifecycleSettingsService {
  constructor(private readonly repository: RentalLifecycleSettingsRepository) {}

  private authorize(role: string | null | undefined) {
    if (role !== "SYSTEM_ADMIN") throw new ForbiddenError(messages.forbidden);
  }

  async list(actor: { role: string | null | undefined }) {
    this.authorize(actor.role);
    return (await this.repository.list()).map(dto);
  }

  async update(
    actor: { id: string; role: string | null | undefined },
    input: ConfigureRentalLifecycleSetting,
  ) {
    this.authorize(actor.role);
    return this.repository.db.transaction(async (tx) => {
      const before = await this.repository.lock(input.key, tx);
      if (!before) throw new NotFoundError(messages.notFound);
      if (before.version !== input.expectedVersion) throw new ConflictError(messages.stale);
      const after = await this.repository.save(
        input.key,
        input.value,
        before.version + 1,
        actor.id,
        tx,
      );
      if (!after) throw new NotFoundError(messages.notFound);
      await this.repository.audit(tx, actor.id, {
        key: input.key,
        before: { value: before.value, version: before.version },
        after: { value: after.value, version: after.version },
      });
      return dto(after);
    });
  }
}
