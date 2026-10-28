import type { SystemSettingSnapshot } from "@metastorage/database/schema-domain";
import type { SystemSettingKeyValue } from "./system-settings";

export type {
  SystemSettingSnapshot,
  SystemSettingValue,
} from "@metastorage/database/schema-domain";
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
