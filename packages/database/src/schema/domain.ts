export * from "./enums";

export enum SystemSettingKey {
  EXPIRY_REMINDER_DAYS = "EXPIRY_REMINDER_DAYS",
  ABANDONED_REVIEW_DAYS = "ABANDONED_REVIEW_DAYS",
  OVERDUE_FEE_RATE = "OVERDUE_FEE_RATE",
  DEPOSIT_MONTHS = "DEPOSIT_MONTHS",
  OPENING_HOUR = "OPENING_HOUR",
  CLOSING_HOUR = "CLOSING_HOUR",
}
export type SystemSettingKeyValue = SystemSettingKey;

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

export type SystemSettingValue = number | string | boolean;
export interface SystemSettingSnapshot {
  value: SystemSettingValue;
  version: number;
}

export type PricingChangeValues =
  | { depositMonths: number }
  | { unitTypeId: string; monthlyPrice: number }
  | { facilityId: string; unitTypeId: string; priceRangeId: string; monthlyPrice: number | null }
  | {
      priceRangeId: string;
      code: string;
      name: string;
      minMonthlyPrice: number | null;
      maxMonthlyPrice: number | null;
      isActive: boolean;
    };

export interface BookingEmailSnapshot {
  bookingCode: string | null;
  facilityName: string;
  unitTypeName: string;
  paidAt: string;
  kind?: "BOOKING_CONFIRMATION" | "TRACKING_LINK";
  deliveryId?: string;
  linkCreatedAt?: string;
  linkExpiresAt?: string;
}
