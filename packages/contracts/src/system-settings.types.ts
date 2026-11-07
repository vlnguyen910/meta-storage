import type { SystemSettingKeyValue } from "./system-settings";

export type SystemSettingValue = number | string | boolean;
export interface SystemSettingSnapshot {
  value: SystemSettingValue;
  version: number;
}
export interface SystemSettingDto extends SystemSettingSnapshot {
  key: SystemSettingKeyValue;
  description: string;
  category: "RENTAL" | "FINANCE" | "OPERATIONS";
  valueType: "INTEGER";
  unit: "DAYS" | "PERCENT" | "MONTHS" | "HOUR";
  updatedBy: string | null;
  updatedAt: string;
}

export interface SystemSettingUpdateResult extends SystemSettingSnapshot {
  key: SystemSettingKeyValue;
}
export interface SystemSettingChangeDto {
  id: string;
  key: SystemSettingKeyValue;
  before: SystemSettingSnapshot;
  after: SystemSettingSnapshot;
  actorId: string;
  source: string;
  createdAt: string;
}
