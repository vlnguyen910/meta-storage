import { SystemSettingKey } from "@metastorage/database/schema-domain";
import { z } from "zod";
import { SYSTEM_SETTING_MESSAGES as m } from "./system-settings.messages";

export type { SystemSettingKeyValue } from "@metastorage/database/schema-domain";
export { SYSTEM_SETTING_DEFINITIONS, SystemSettingKey } from "@metastorage/database/schema-domain";

const integer = z
  .number({ error: m.invalid })
  .int(m.invalid)
  .nonnegative(m.invalid)
  .max(2147483647, m.invalid);
const version = z
  .number({ error: m.invalid })
  .int(m.invalid)
  .nonnegative(m.invalid)
  .max(2147483646, m.invalid);
export const ConfigureSystemSettingSchema = z.discriminatedUnion("key", [
  z.strictObject({
    key: z.literal(SystemSettingKey.EXPIRY_REMINDER_DAYS),
    value: integer,
    expectedVersion: version,
  }),
  z.strictObject({
    key: z.literal(SystemSettingKey.ABANDONED_REVIEW_DAYS),
    value: integer,
    expectedVersion: version,
  }),
  z.strictObject({
    key: z.literal(SystemSettingKey.OVERDUE_FEE_RATE),
    value: integer.max(100, m.invalid),
    expectedVersion: version,
  }),
  z.strictObject({
    key: z.literal(SystemSettingKey.DEPOSIT_MONTHS),
    value: integer.positive(m.invalid),
    expectedVersion: version.positive(m.invalid),
  }),
  z.strictObject({
    key: z.literal(SystemSettingKey.OPENING_HOUR),
    value: integer.max(23, m.invalid),
    expectedVersion: version,
  }),
  z.strictObject({
    key: z.literal(SystemSettingKey.CLOSING_HOUR),
    value: integer.min(1, m.invalid).max(24, m.invalid),
    expectedVersion: version,
  }),
]);
export const SystemSettingParamsSchema = z.strictObject({ key: z.enum(SystemSettingKey) });
export const SystemSettingHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});
export type ConfigureSystemSetting = z.infer<typeof ConfigureSystemSettingSchema>;
export type SystemSettingHistoryQuery = z.infer<typeof SystemSettingHistoryQuerySchema>;
export { SYSTEM_SETTING_MESSAGES } from "./system-settings.messages";
export type * from "./system-settings.types";
