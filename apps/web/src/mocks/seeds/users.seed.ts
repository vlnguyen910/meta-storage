import { UserRole } from "@metastorage/contracts";
import type { MockUser } from "../types";

export const demoAccounts = [
  { role: UserRole.STORAGE_CUSTOMER, email: "customer@metastorage.test", label: "Khách thuê kho" },
  { role: UserRole.FACILITY_STAFF, email: "staff@metastorage.test", label: "Nhân viên cơ sở" },
  { role: UserRole.FACILITY_MANAGER, email: "manager@metastorage.test", label: "Quản lý cơ sở" },
  {
    role: UserRole.FACILITY_MANAGER,
    email: "multi-manager@metastorage.test",
    label: "Quản lý nhiều cơ sở",
  },
  {
    role: UserRole.BUSINESS_OPERATIONS_MANAGER,
    email: "operations@metastorage.test",
    label: "Quản lý vận hành",
  },
  {
    role: UserRole.SYSTEM_ADMINISTRATOR,
    email: "admin@metastorage.test",
    label: "Quản trị hệ thống",
  },
] as const;

export const userSeeds: MockUser[] = demoAccounts.map((account, index) => ({
  id: `user-${index + 1}`,
  name: [
    "Nguyễn Minh Anh",
    "Trần Quốc Huy",
    "Lê Thu Hà",
    "Ngô Hoàng Long",
    "Phạm Hải Nam",
    "Đỗ An Nhiên",
  ][index] as string,
  email: account.email,
  phone: `090000000${index + 1}`,
  role: account.role,
  status: "ACTIVE",
  emailVerified: true,
  image: null,
  passwordHash: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  assignedFacilityIds:
    account.email === "multi-manager@metastorage.test"
      ? ["fac-hcm-central", "fac-hn-west"]
      : account.role === UserRole.FACILITY_STAFF || account.role === UserRole.FACILITY_MANAGER
        ? ["fac-hcm-central"]
        : [],
  password: "Demo@123",
}));
