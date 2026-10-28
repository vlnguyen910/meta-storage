import {
  type CatalogFacility,
  HANDOVER_CHECKLIST_ITEMS,
  type MobileHeldDraft,
  type MobilePaidBooking,
} from "@metastorage/contracts";
import type { DemoDatabase } from "./demo.types";

export const demoId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
// Demo IDs and access tokens are intentionally not production security primitives.
export const newDemoId = () =>
  "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16),
  );
export const addMonths = (value: string, months: number) => {
  const date = new Date(value);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, end));
  return date.toISOString();
};
export function createMobileSeed(now = Date.now()): DemoDatabase {
  const at = (offset: number) => new Date(now + offset).toISOString();
  const facilities: CatalogFacility[] = [
    {
      id: demoId(1),
      code: "HCM-01",
      name: "StoreX Sài Gòn Central",
      address: "118 Nguyễn Văn Linh, Quận 7, TP. Hồ Chí Minh",
      availableUnits: 12,
      totalUnits: 18,
      startingMonthlyPrice: 900000,
      description: null,
      createdAt: at(0),
      updatedAt: at(0),
    },
    {
      id: demoId(2),
      code: "HN-01",
      name: "StoreX Hà Nội West",
      address: "42 Lê Quang Đạo, Hà Nội",
      availableUnits: 0,
      totalUnits: 8,
      startingMonthlyPrice: 850000,
      description: null,
      createdAt: at(0),
      updatedAt: at(0),
    },
    {
      id: demoId(3),
      code: "DN-01",
      name: "StoreX Đà Nẵng Riverside",
      address: "95 Ngô Quyền, Đà Nẵng",
      availableUnits: 6,
      totalUnits: 10,
      startingMonthlyPrice: 750000,
      description: null,
      createdAt: at(0),
      updatedAt: at(0),
    },
  ];
  const unitTypes = facilities.flatMap((facility, index) =>
    [2, 4, 6].map((size, n) => ({
      facilityId: facility.id,
      unitTypeId: demoId(20 + index * 3 + n),
      unitType: "Kho tiêu chuẩn",
      sizeLabel: `${size} m²`,
      sizeSqm: size,
      monthlyPrice: [900000, 1500000, 2100000][n] - index * 50000,
      availableCount: index === 1 ? 0 : 6,
    })),
  );
  const customer = {
    id: demoId(100),
    name: "Nguyễn Minh Anh",
    email: "customer@metastorage.test",
    role: "CUSTOMER" as const,
    facilityIds: [],
    password: "12345678",
    verified: true,
  };
  const staff = {
    id: demoId(101),
    name: "Trần Quốc Huy",
    email: "staff@metastorage.test",
    role: "FACILITY_STAFF" as const,
    facilityIds: [demoId(1)],
    password: "12345678",
    verified: true,
  };
  const other = {
    ...customer,
    id: demoId(102),
    name: "Khách khác",
    email: "other@metastorage.test",
  };
  const makeBooking = (
    n: number,
    start: string,
    status: "CONFIRMED" | "CHECKED_IN",
    ownerId = customer.id,
  ): MobilePaidBooking => ({
    id: demoId(200 + n),
    bookingCode: `BK-2026-000${n}`,
    facilityId: demoId(1),
    facilityName: facilities[0].name,
    unitTypeId: demoId(20),
    unitTypeName: "Kho tiêu chuẩn",
    unitTypeSizeLabel: "2 m²",
    ownerId,
    contactName: customer.name,
    contactEmail: customer.email,
    contactPhone: "+84901234567",
    checkInSlotStart: start,
    checkInSlotEnd: new Date(Date.parse(start) + 7200000).toISOString(),
    rentalEndAt: addMonths(start, 1),
    requestedMonths: 1,
    totalAmount: 1800000,
    rentalAmount: 900000,
    depositAmount: 900000,
    status,
    paidAt: at(-3600000),
    createdAt: at(-7200000),
    rescheduleCount: 0,
    history: [],
    assignedUnit:
      n === 2
        ? null
        : {
            id: demoId(300 + n),
            bookingId: demoId(200 + n),
            physicalUnitId: demoId(400 + n),
            physicalUnitCode: `HCM-01-00${n}`,
            assignedBy: demoId(103),
            assignerName: "FM (dữ liệu mẫu)",
            status: "ACTIVE",
            assignedAt: at(-3600000),
            endedAt: null,
            reason: null,
          },
    assignedStaff:
      n === 2
        ? null
        : {
            id: staff.id,
            name: staff.name,
            email: staff.email,
            phone: "+84900000002",
            role: "FACILITY_STAFF",
            isActive: true,
          },
    handoverStage: status === "CHECKED_IN" ? "HANDED_OVER" : "WAITING_CUSTOMER",
  });
  const heldDraft = (n: number, expired: boolean): MobileHeldDraft => ({
    id: demoId(900 + n),
    ownerId: customer.id,
    facilityId: demoId(1),
    unitTypeId: demoId(21),
    checkInAt: at(2 * 86400000),
    rentalEndAt: addMonths(at(2 * 86400000), 1),
    durationMonths: 1,
    contact: { fullName: customer.name, email: customer.email, phone: "+84901234567" },
    draftAccessToken: `demo-${demoId(900 + n)}`,
    status: "DRAFT",
    pricingStatus: "PRICED",
    pricing: {
      monthlyRateSnapshot: "1500000",
      rentalFeeAmount: "1500000",
      depositAmount: "1500000",
      totalAmount: "3000000",
      currency: "VND",
    },
    hold: {
      holdId: demoId(950 + n),
      holdToken: `demo-${demoId(950 + n)}`,
      unitTypeId: demoId(21),
      startsAt: at(2 * 86400000),
      endsAt: addMonths(at(2 * 86400000), 1),
      expiresAt: at(expired ? -60000 : 600000),
      status: "ACTIVE",
    },
  });
  return {
    version: 1,
    guestId: newDemoId(),
    sessionId: null,
    accounts: [customer, staff, other],
    facilities,
    unitTypes,
    bookings: [
      makeBooking(1, at(-1800000), "CONFIRMED"),
      makeBooking(2, at(3 * 86400000), "CONFIRMED"),
      makeBooking(3, at(-2 * 86400000), "CHECKED_IN"),
      makeBooking(4, at(86400000), "CONFIRMED", other.id),
    ],
    drafts: [heldDraft(1, false), heldDraft(2, true)],
    inspections: [
      {
        id: demoId(700),
        bookingId: demoId(203),
        staffId: staff.id,
        version: 2,
        status: "HANDED_OVER",
        checklist: HANDOVER_CHECKLIST_ITEMS.map((item) => ({
          itemCode: item.code,
          resultType: "PASS_FAIL",
          result: "PASS",
          note: null,
          photos: [],
        })),
        notes: "Biên bản mẫu đã hoàn tất trước bàn giao kho đang thuê.",
        photos: [],
      },
    ],
    rentals: [
      {
        id: demoId(500),
        bookingId: demoId(203),
        ownerId: customer.id,
        status: "ACTIVE",
        startedAt: at(-2 * 86400000),
      },
    ],
    requests: [
      {
        id: demoId(600),
        rentalId: demoId(500),
        ownerId: customer.id,
        type: "RETURN",
        reason: "Yêu cầu trả kho mẫu đã được FM phân công.",
        preferredAt: at(3600000),
        status: "ASSIGNED",
        assignedStaffId: staff.id,
        report: null,
      },
    ],
  };
}
