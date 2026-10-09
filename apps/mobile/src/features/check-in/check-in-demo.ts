export type CheckInReadiness = "READY" | "TOO_EARLY" | "NO_SHOW";

export type DemoBooking = {
  code: string;
  scenario: string;
  status: "CONFIRMED" | "NO_SHOW";
  readiness: CheckInReadiness;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  unitCode: string | null;
  unitType: string;
  unitSize: string;
  facility: string;
  startAt: Date;
  slotEndAt: Date;
  graceEndsAt: Date;
  rentalEndAt: Date;
  paidAt: Date;
  totalAmount: number;
  depositAmount: number;
  reasons: string[];
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export function buildDemoBookings(now = Date.now()): DemoBooking[] {
  const makeDate = (offset: number) => new Date(now + offset);

  return [
    {
      code: "BK-2026-0001",
      scenario: "Khách đã đến trong khung giờ",
      status: "CONFIRMED",
      readiness: "READY",
      customerName: "Lê Thị Mai Linh",
      customerPhone: "0900000001",
      customerEmail: "customer@metastorage.test",
      unitCode: "HCM-01-002",
      unitType: "Kho tiêu chuẩn",
      unitSize: "2 m²",
      facility: "metastorage Sài Gòn Central",
      startAt: makeDate(-30 * 60 * 1000),
      slotEndAt: makeDate(90 * 60 * 1000),
      graceEndsAt: makeDate(210 * 60 * 1000),
      rentalEndAt: makeDate(30 * DAY_MS),
      paidAt: makeDate(-2 * HOUR_MS),
      totalAmount: 1_800_000,
      depositAmount: 900_000,
      reasons: [],
    },
    {
      code: "BK-2026-0002",
      scenario: "Booking đã chuẩn bị cho ngày mai",
      status: "CONFIRMED",
      readiness: "TOO_EARLY",
      customerName: "Trần Minh Đức",
      customerPhone: "0988776655",
      customerEmail: "duc.tran@example.com",
      unitCode: "HCM-01-004",
      unitType: "Kho tiêu chuẩn",
      unitSize: "4 m²",
      facility: "metastorage Sài Gòn Central",
      startAt: makeDate(DAY_MS),
      slotEndAt: makeDate(DAY_MS + 2 * HOUR_MS),
      graceEndsAt: makeDate(DAY_MS + 4 * HOUR_MS),
      rentalEndAt: makeDate(DAY_MS + 90 * DAY_MS),
      paidAt: makeDate(-6 * HOUR_MS),
      totalAmount: 6_000_000,
      depositAmount: 1_500_000,
      reasons: ["Chưa tới thời gian bắt đầu check-in"],
    },
    {
      code: "BK-2026-0003",
      scenario: "Khách đã bỏ lỡ cả slot và grace period",
      status: "NO_SHOW",
      readiness: "NO_SHOW",
      customerName: "Công ty SmartLog (Anh Tuấn)",
      customerPhone: "0903112233",
      customerEmail: "contact@smartlog.vn",
      unitCode: null,
      unitType: "Kho tiêu chuẩn",
      unitSize: "6 m²",
      facility: "metastorage Sài Gòn Central",
      startAt: makeDate(-6 * HOUR_MS),
      slotEndAt: makeDate(-4 * HOUR_MS),
      graceEndsAt: makeDate(-2 * HOUR_MS),
      rentalEndAt: makeDate(180 * DAY_MS),
      paidAt: makeDate(-24 * HOUR_MS),
      totalAmount: 14_700_000,
      depositAmount: 2_100_000,
      reasons: ["Booking đã chuyển NO_SHOW", "Không được tiếp tục handover"],
    },
  ];
}

export function findDemoBooking(value: string, bookings: DemoBooking[]): DemoBooking | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;

  return bookings.find((booking) => booking.code.toLowerCase() === normalized) ?? null;
}
