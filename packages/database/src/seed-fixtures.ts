// Stable local fixtures only. Keep IDs unchanged when adding or reordering seed data.
export const SEED_IDS = {
  facilities: {
    "HCM-01": "30000000-0000-4000-8000-000000000001",
    "HCM-02": "30000000-0000-4000-8000-000000000002",
    "HCM-03": "30000000-0000-4000-8000-000000000003",
    "HCM-04": "30000000-0000-4000-8000-000000000004",
    "HCM-05": "30000000-0000-4000-8000-000000000005",
    "HCM-06": "30000000-0000-4000-8000-000000000006",
    "HCM-07": "30000000-0000-4000-8000-000000000007",
    "HCM-08": "30000000-0000-4000-8000-000000000008",
    "HCM-09": "30000000-0000-4000-8000-000000000009",
    "HCM-10": "30000000-0000-4000-8000-000000000010",
  },
  unitTypes: {
    "UT-2M": "60000000-0000-4000-8000-000000000001",
    "UT-4M": "60000000-0000-4000-8000-000000000002",
    "UT-6M": "60000000-0000-4000-8000-000000000003",
    "UT-AC-4M": "60000000-0000-4000-8000-000000000004",
    "UT-1M": "60000000-0000-4000-8000-000000000005",
    "UT-8M": "60000000-0000-4000-8000-000000000006",
    "UT-10M": "60000000-0000-4000-8000-000000000007",
    "UT-15M": "60000000-0000-4000-8000-000000000008",
  },
  checkInSlots: [
    "20000000-0000-4000-8000-000000000001",
    "20000000-0000-4000-8000-000000000002",
    "20000000-0000-4000-8000-000000000003",
    "20000000-0000-4000-8000-000000000004",
  ],
  storageUnits: {
    "HCM-01-001": "70000000-0000-4000-8000-000000000001",
    "HCM-01-002": "70000000-0000-4000-8000-000000000002",
    "HCM-01-003": "70000000-0000-4000-8000-000000000003",
    "HCM-01-004": "70000000-0000-4000-8000-000000000004",
    "HCM-01-005": "70000000-0000-4000-8000-000000000005",
    "HCM-01-006": "70000000-0000-4000-8000-000000000006",
    "HCM-01-007": "70000000-0000-4000-8000-000000000007",
    "HCM-01-008": "70000000-0000-4000-8000-000000000008",
  },
  bookings: {
    "BK-2026-0001": "80000000-0000-4000-8000-000000000001",
    "BK-2026-0002": "80000000-0000-4000-8000-000000000002",
    "BK-2026-0003": "80000000-0000-4000-8000-000000000003",
  },
} as const;

export const SEED_USERS = [
  {
    id: "40000000-0000-4000-8000-000000000001",
    role: "CUSTOMER",
    email: "customer@metastorage.vn",
    name: "Lê Thị Mai Linh",
    phone: "0900000001",
  },
  {
    id: "40000000-0000-4000-8000-000000000002",
    role: "FACILITY_STAFF",
    email: "staff@metastorage.vn",
    name: "Trần Quốc Huy",
    phone: "0900000002",
  },
  {
    id: "40000000-0000-4000-8000-000000000003",
    role: "FACILITY_MANAGER",
    email: "manager@metastorage.vn",
    name: "Lê Thu Hà",
    phone: "0900000003",
  },
  {
    id: "40000000-0000-4000-8000-000000000004",
    role: "BUSINESS_OPERATION_MANAGER",
    email: "bom@metastorage.vn",
    name: "Business Operation Manager",
    phone: "0900000004",
  },
  {
    id: "40000000-0000-4000-8000-000000000005",
    role: "SYSTEM_ADMIN",
    email: "admin@metastorage.vn",
    name: "Quản trị viên demo",
    phone: "0900000005",
  },
] as const;

export const SEED_DEMO_USERS = [
  ...Array.from({ length: 6 }, (_, index) => ({
    id: `40000000-0000-4000-8000-${String(101 + index).padStart(12, "0")}`,
    role: "CUSTOMER" as const,
    email: `customer${index + 1}@metastorage.test`,
    name:
      [
        "Nguyễn Minh An",
        "Trần Ngọc Anh",
        "Lê Hoàng Nam",
        "Phạm Thảo Vy",
        "Võ Thanh Tâm",
        "Đặng Hải Yến",
      ][index] ?? "Khách demo",
    phone: `090100000${index + 1}`,
  })),
  ...Array.from({ length: 9 }, (_, index) => ({
    id: `40000000-0000-4000-8000-${String(202 + index).padStart(12, "0")}`,
    role: "FACILITY_MANAGER" as const,
    email: `manager.hcm${String(index + 2).padStart(2, "0")}@metastorage.test`,
    name: `Quản lý demo HCM-${String(index + 2).padStart(2, "0")}`,
    phone: `09020000${String(index + 2).padStart(2, "0")}`,
  })),
  ...Array.from({ length: 9 }, (_, index) => ({
    id: `40000000-0000-4000-8000-${String(302 + index).padStart(12, "0")}`,
    role: "FACILITY_STAFF" as const,
    email: `staff.hcm${String(index + 2).padStart(2, "0")}@metastorage.test`,
    name: `Nhân viên demo HCM-${String(index + 2).padStart(2, "0")}`,
    phone: `09030000${String(index + 2).padStart(2, "0")}`,
  })),
];
