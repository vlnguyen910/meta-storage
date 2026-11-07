import { describe, expect, it } from "vitest";
import { ReservationQuoteSchema, SessionSchema, UserRole } from "./index";

describe("shared contracts", () => {
  it("accepts a valid authenticated session", () => {
    const parsed = SessionSchema.safeParse({
      user: {
        id: "user-1",
        name: "Nguyễn Minh Anh",
        email: "customer@storex.vn",
        role: UserRole.STORAGE_CUSTOMER,
        permissions: [],
        assignedFacilityIds: [],
      },
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresAt: "2026-09-19T00:00:00.000Z",
    });
    expect(parsed.success).toBe(true);
  });

  it("uses the same role values as the database authorization model", () => {
    expect(UserRole.STORAGE_CUSTOMER).toBe("CUSTOMER");
    expect(UserRole.BUSINESS_OPERATIONS_MANAGER).toBe("BUSINESS_OPERATION_MANAGER");
    expect(UserRole.SYSTEM_ADMINISTRATOR).toBe("SYSTEM_ADMIN");
  });

  it("rejects quote durations outside the MVP policy", () => {
    const parsed = ReservationQuoteSchema.safeParse({
      id: "quote-1",
      facilityId: "facility-1",
      unitType: "Kho tiêu chuẩn",
      sizeLabel: "2 m²",
      startDate: "2026-10-01",
      durationMonths: 13,
      monthlyPrice: 900_000,
      rentalTotal: 11_700_000,
      depositAmount: 900_000,
      totalEstimated: 12_600_000,
      expiresAt: "2026-09-19T00:15:00.000Z",
    });
    expect(parsed.success).toBe(false);
  });
});
