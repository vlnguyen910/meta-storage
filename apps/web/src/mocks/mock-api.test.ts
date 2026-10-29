import { createHttpClient, createMetastorageApiClient } from "@metastorage/api-client";
import type { SessionTokens } from "@metastorage/contracts";
import { UserRole } from "@metastorage/database/schema/user-enums";
import { beforeAll, describe, expect, it } from "vitest";
import { resetMockDatabase } from "./database";
import { installMockApi } from "./install-mock-api";

let tokens: SessionTokens | null = null;
const http = createHttpClient({
  baseURL: "/api",
  tokenProvider: {
    getAccessToken: () => tokens?.accessToken ?? null,
    getRefreshToken: () => tokens?.refreshToken ?? null,
    updateTokens: (value) => {
      tokens = value;
    },
    clearSession: () => {
      tokens = null;
    },
  },
});
const client = createMetastorageApiClient(http);

describe("mock reservation API", () => {
  beforeAll(async () => {
    process.env.NEXT_PUBLIC_MOCK_DELAY_MS = "0";
    resetMockDatabase();
    installMockApi(http);
    const session = await client.auth.login({
      email: "customer@metastorage.test",
      password: "12345678",
    });
    tokens = session;
    expect(session.user.assignedFacilityId).toBeNull();
    expect((await client.auth.me()).assignedFacilityId).toBeNull();
  });

  it("reads the existing public facility and unit type API shapes", async () => {
    const facilities = await client.facilities.listActive({ limit: 100, offset: 0 });
    const facility = facilities.find((item) => item.code === "HCM-01");
    expect(facility?.address).toBeTypeOf("string");
    const unitTypes = await client.facilities.listUnitTypes(facility?.id ?? "", {
      limit: 100,
      offset: 0,
    });
    expect(unitTypes.length).toBeGreaterThan(0);
    expect(unitTypes.every((type) => type.monthlyPrice >= 0 && type.lengthM > 0)).toBe(true);
  });

  it("browses the public catalog without using the protected facility API", async () => {
    const facilities = await client.catalog.listFacilities();
    expect(facilities.total).toBeGreaterThan(0);
    const facility = facilities.items.find((item) => item.code === "HCM-01");
    expect(facility?.availableUnits).toBeGreaterThan(0);

    const unitTypes = await client.catalog.listUnitTypes(facility?.id ?? "");
    expect(unitTypes.every((option) => option.facilityId === facility?.id)).toBe(true);
    expect(unitTypes.some((option) => (option.availableCount ?? 0) > 0)).toBe(true);
  });

  it("does not create a reservation when payment fails and can retry successfully", async () => {
    const quote = await client.legacyReservations.quote({
      facilityId: "fac-hcm-central",
      unitTypeId: "00000000-0000-0000-0001-000000000001",
      startDate: "2026-10-01",
      durationMonths: 3,
    });
    expect(quote.depositAmount).toBe(quote.monthlyPrice);
    expect(quote.rentalTotal).toBe(quote.monthlyPrice * 3);

    await expect(
      client.legacyReservations.confirm({
        quoteId: quote.id,
        paymentToken: "tok_fail",
        cardBrand: "Visa",
        cardLast4: "0002",
      }),
    ).rejects.toMatchObject({ response: { status: 402 } });
    expect(await client.legacyReservations.mine()).toHaveLength(0);

    const reservation = await client.legacyReservations.confirm({
      quoteId: quote.id,
      paymentToken: "tok_success",
      cardBrand: "Visa",
      cardLast4: "4242",
    });
    expect(reservation.payment.last4).toBe("4242");
    expect((await client.legacyReservations.mine())[0]?.id).toBe(reservation.id);
  });

  it("allows FM to assign staff and allows Staff to view assigned tasks", async () => {
    // 1. FM logs in and assigns staff to BK-2026-0001
    const fmSession = await client.auth.login({
      email: "manager@metastorage.test",
      password: "12345678",
    });
    tokens = fmSession;

    const staffList = await client.facilities.getStaff("fac-hcm-central");
    expect(staffList.length).toBeGreaterThan(0);
    const targetStaff = staffList[0];
    if (!targetStaff) throw new Error("Staff not found");

    const assignedBooking = await client.legacyBookings.assignStaff(
      "b0000000-0000-0000-0000-000000000001",
      { staffId: targetStaff.id, notes: "Ca sáng" },
    );
    expect(assignedBooking.assignedStaff?.id).toBe(targetStaff.id);

    // 2. Staff logs in and fetches assigned tasks
    const staffSession = await client.auth.login({
      email: "staff@metastorage.test",
      password: "12345678",
    });
    tokens = staffSession;

    const tasks = await client.legacyBookings.listAssignedToMe("fac-hcm-central");
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.some((t) => t.bookingCode === "BK-2026-0001")).toBe(true);
  });

  it("returns the default facility in login/me and scopes single- and multi-facility managers", async () => {
    // 1. Single facility FM login and assignment retrieval
    const fmSession = await client.auth.login({
      email: "manager@metastorage.test",
      password: "12345678",
    });
    tokens = fmSession;
    expect(fmSession.user.assignedFacilityId).toBe("fac-hcm-central");
    expect((await client.auth.me()).assignedFacilityId).toBe("fac-hcm-central");

    const myAssignments = await client.facilities.myAssignments();
    expect(myAssignments).toHaveLength(1);
    expect(myAssignments[0]?.facilityId).toBe("fac-hcm-central");

    const singleDashboard = await client.dashboards.get(
      UserRole.FACILITY_MANAGER,
      "fac-hcm-central",
    );
    expect(singleDashboard.facilityName).toBe("metastorage Sài Gòn Central");
    expect(singleDashboard.kpis.length).toBeGreaterThan(0);

    // FM cannot access unassigned facility
    await expect(
      client.dashboards.get(UserRole.FACILITY_MANAGER, "fac-dn-riverside"),
    ).rejects.toMatchObject({ response: { status: 403 } });

    // 2. Multi-facility manager defaults to the first assignment and can access both.
    const multiSession = await client.auth.login({
      email: "multi-manager@metastorage.test",
      password: "12345678",
    });
    tokens = multiSession;

    const multiAssignments = await client.facilities.myAssignments();
    expect(multiAssignments).toHaveLength(2);
    expect(multiAssignments.map((assignment) => assignment.facilityId)).toEqual([
      "fac-hcm-central",
      "fac-hn-west",
    ]);
    expect(multiSession.user.assignedFacilityId).toBe("fac-hcm-central");
    expect((await client.auth.me()).assignedFacilityId).toBe("fac-hcm-central");
    const hcmDashboard = await client.dashboards.get(UserRole.FACILITY_MANAGER, "fac-hcm-central");
    expect(hcmDashboard.facilityName).toBe("metastorage Sài Gòn Central");
    await expect(
      client.dashboards.get(UserRole.FACILITY_MANAGER, "fac-dn-riverside"),
    ).rejects.toMatchObject({ response: { status: 403 } });

    const hnDashboard = await client.dashboards.get(UserRole.FACILITY_MANAGER, "fac-hn-west");
    expect(hnDashboard.facilityName).toBe("metastorage Hà Nội West");
  });
});
