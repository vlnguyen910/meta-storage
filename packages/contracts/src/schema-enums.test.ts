import {
  AppointmentStatus,
  AppointmentType,
  PaymentRefundReason,
  ReservationStatus,
  SupportCategory,
  UserRole,
  UserStatus,
} from "@metastorage/database/schema-domain";
import { describe, expect, it } from "vitest";
import {
  AppointmentQuerySchema,
  CreateAppointmentSchema,
  ReservationQuerySchema,
} from "./appointment-reservation";
import { PaymentRefundReasonSchema } from "./payments";
import { SupportContextQuerySchema } from "./support";
import { BusinessUserRoleSchema, UserRoleSchema, UserStatusSchema } from "./users";

describe("enum schema dùng chung", () => {
  it("xác thực vai trò và trạng thái tài khoản theo enum schema", () => {
    expect(UserRoleSchema.parse(UserRole.STORAGE_CUSTOMER)).toBe("CUSTOMER");
    expect(UserStatusSchema.parse(UserStatus.ACTIVE)).toBe("ACTIVE");
    expect(BusinessUserRoleSchema.safeParse(UserRole.SYSTEM_ADMINISTRATOR).success).toBe(false);
  });

  it("xác thực trạng thái và loại lịch hẹn theo enum schema", () => {
    expect(
      AppointmentQuerySchema.parse({
        type: AppointmentType.SUPPORT,
        status: AppointmentStatus.SCHEDULED,
      }).type,
    ).toBe(AppointmentType.SUPPORT);
    expect(ReservationQuerySchema.parse({ status: ReservationStatus.DRAFT }).status).toBe(
      ReservationStatus.DRAFT,
    );
    expect(ReservationQuerySchema.safeParse({ status: "EXPIRED" }).success).toBe(false);
    expect(
      CreateAppointmentSchema.safeParse({
        appointmentType: AppointmentType.CHECK_IN,
        scheduledDate: "2100-01-01",
        slotId: "b03c6ea1-f246-48db-9c86-f592e314c0a1",
      }).success,
    ).toBe(false);
  });

  it("dùng enum cho loại hỗ trợ và lý do hoàn tiền", () => {
    expect(SupportContextQuerySchema.parse({ category: SupportCategory.UNIT }).category).toBe(
      SupportCategory.UNIT,
    );
    expect(PaymentRefundReasonSchema.parse(PaymentRefundReason.NO_SHOW)).toBe(
      PaymentRefundReason.NO_SHOW,
    );
  });
});
