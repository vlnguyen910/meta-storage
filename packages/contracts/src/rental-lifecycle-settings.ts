import { z } from "zod";

export const RentalLifecycleSettingKey = {
  EXPIRY_REMINDER_DAYS: "EXPIRY_REMINDER_DAYS",
  ABANDONED_REVIEW_DAYS: "ABANDONED_REVIEW_DAYS",
} as const;
export type RentalLifecycleSettingKeyValue =
  (typeof RentalLifecycleSettingKey)[keyof typeof RentalLifecycleSettingKey];

export const ConfigureRentalLifecycleSettingSchema = z.strictObject({
  key: z.enum(RentalLifecycleSettingKey),
  value: z.number().int().nonnegative().max(2147483647),
  expectedVersion: z.number().int().nonnegative().max(2147483646),
});

export type ConfigureRentalLifecycleSetting = z.infer<typeof ConfigureRentalLifecycleSettingSchema>;
