import type { RentalLifecycleSettingKey } from "./rental-lifecycle-settings";

export interface RentalLifecycleSettingDto {
  key: (typeof RentalLifecycleSettingKey)[keyof typeof RentalLifecycleSettingKey];
  value: number;
  description: string;
  version: number;
  updatedAt: string;
}
