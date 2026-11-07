import { describe, expect, it } from "vitest";
import type { Session } from "./index";
import { ReservationDraftInputSchema, UserRole } from "./index";

describe("shared contracts", () => {
  it("keeps the authenticated session shape aligned with the shared user contract", () => {
    const session: Session = {
      user: {
        id: "user-1",
        name: "Nguyễn Minh Anh",
        email: "customer@storex.vn",
        emailVerified: true,
        image: null,
        phone: null,
        role: UserRole.STORAGE_CUSTOMER,
        status: "ACTIVE",
        createdAt: "2026-09-18T00:00:00.000Z",
        updatedAt: "2026-09-18T00:00:00.000Z",
        assignedFacilityId: null,
      },
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresAt: "2026-09-19T00:00:00.000Z",
    };
    expect(session.user.assignedFacilityId).toBeNull();
  });

  it("uses the same role values as the database authorization model", () => {
    expect(UserRole.STORAGE_CUSTOMER).toBe("CUSTOMER");
    expect(UserRole.BUSINESS_OPERATIONS_MANAGER).toBe("BUSINESS_OPERATION_MANAGER");
    expect(UserRole.SYSTEM_ADMINISTRATOR).toBe("SYSTEM_ADMIN");
  });

  it("rejects reservation draft durations outside the shared contract", () => {
    const parsed = ReservationDraftInputSchema.safeParse({
      facilityId: "00000000-0000-4000-8000-000000000001",
      unitTypeId: "00000000-0000-4000-8000-000000000002",
      checkInSlotId: "00000000-0000-4000-8000-000000000003",
      checkInDate: "2026-10-01",
      durationMonths: 13,
    });
    expect(parsed.success).toBe(false);
  });
});
