import { z } from "zod";
import { SYSTEM_SETTING_MESSAGES as m } from "./system-settings.messages";

export const SystemSettingKey = {
  EXPIRY_REMINDER_DAYS: "EXPIRY_REMINDER_DAYS",
  RENEWAL_NOTICE_DAYS: "RENEWAL_NOTICE_DAYS",
  ABANDONED_REVIEW_DAYS: "ABANDONED_REVIEW_DAYS",
  OVERDUE_FEE_RATE: "OVERDUE_FEE_RATE",
  DEPOSIT_MONTHS: "DEPOSIT_MONTHS",
  OPENING_HOUR: "OPENING_HOUR",
  CLOSING_HOUR: "CLOSING_HOUR",
} as const;
export type SystemSettingKeyValue = (typeof SystemSettingKey)[keyof typeof SystemSettingKey];

// This catalog owns validation and permissions. Admins cannot create arbitrary keys.
export const SYSTEM_SETTING_DEFINITIONS = {
  EXPIRY_REMINDER_DAYS: {
    category: "RENTAL",
    unit: "DAYS",
    valueType: "INTEGER",
    role: "SYSTEM_ADMIN",
    description: "Số ngày trước hạn thuê để nhắc khách.",
    defaultValue: 7,
  },
  ABANDONED_REVIEW_DAYS: {
    category: "RENTAL",
    unit: "DAYS",
    valueType: "INTEGER",
    role: "SYSTEM_ADMIN",
    description: "Số ngày quá hạn đầy đủ trước khi chuyển cho Facility Manager xem xét.",
    defaultValue: 7,
  },
  RENEWAL_NOTICE_DAYS: {
    category: "RENTAL",
    unit: "DAYS",
    valueType: "INTEGER",
    role: "BUSINESS_OPERATION_MANAGER",
    description: "Số ngày trước hạn thuê mà khách không thể gửi yêu cầu gia hạn.",
    defaultValue: 7,
  },
  OVERDUE_FEE_RATE: {
    category: "FINANCE",
    unit: "PERCENT",
    valueType: "INTEGER",
    role: "BUSINESS_OPERATION_MANAGER",
    description: "Tỷ lệ phí quá hạn tính theo phần trăm tiền cọc.",
    defaultValue: 25,
  },
  DEPOSIT_MONTHS: {
    category: "FINANCE",
    unit: "MONTHS",
    valueType: "INTEGER",
    role: "BUSINESS_OPERATION_MANAGER",
    description: "Số tháng tiền thuê dùng để tính tiền cọc.",
    defaultValue: 1,
  },
  OPENING_HOUR: {
    category: "OPERATIONS",
    unit: "HOUR",
    valueType: "INTEGER",
    role: "BUSINESS_OPERATION_MANAGER",
    description: "Giờ mở cửa chung của các cơ sở (giờ Việt Nam).",
    defaultValue: 8,
  },
  CLOSING_HOUR: {
    category: "OPERATIONS",
    unit: "HOUR",
    valueType: "INTEGER",
    role: "BUSINESS_OPERATION_MANAGER",
    description: "Giờ đóng cửa chung của các cơ sở (giờ Việt Nam).",
    defaultValue: 20,
  },
} as const;

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
    key: z.literal(SystemSettingKey.RENEWAL_NOTICE_DAYS),
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

// Compatibility endpoint retained by dev; this does not restore rental return workflows.
export const ConfigureOverdueRateSchema = z.strictObject({
  expectedVersion: version,
  rate: z.number().int().min(0).max(100),
});
export type ConfigureOverdueRate = z.infer<typeof ConfigureOverdueRateSchema>;
