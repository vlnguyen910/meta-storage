import { FacilityStatus } from "@metastorage/contracts";
import type { OperationsMockData, OperationsTypeMetrics } from "./operations.types";

export const operationsMockData: OperationsMockData = {
  facilities: [
    {
      id: "SGC",
      name: "StoreX Sài Gòn Central",
      address: "Quận 7, TP. Hồ Chí Minh",
      status: FacilityStatus.ACTIVE,
      total: 120,
      occupied: 94,
      available: 16,
      reserved: 4,
      maintenance: 6,
      rentalCollected: 120_000_000,
      depositHeld: 70_000_000,
    },
    {
      id: "BTL",
      name: "StoreX Bình Thạnh",
      address: "Bình Thạnh, TP. Hồ Chí Minh",
      status: FacilityStatus.ACTIVE,
      total: 100,
      occupied: 76,
      available: 14,
      reserved: 6,
      maintenance: 4,
      rentalCollected: 96_000_000,
      depositHeld: 50_000_000,
    },
    {
      id: "CG",
      name: "StoreX Cầu Giấy",
      address: "Cầu Giấy, Hà Nội",
      status: FacilityStatus.ACTIVE,
      total: 80,
      occupied: 60,
      available: 10,
      reserved: 6,
      maintenance: 4,
      rentalCollected: 72_000_000,
      depositHeld: 40_000_000,
    },
    {
      id: "NSG",
      name: "StoreX Nam Sài Gòn",
      address: "Nhà Bè, TP. Hồ Chí Minh",
      status: FacilityStatus.ACTIVE,
      total: 60,
      occupied: 42,
      available: 10,
      reserved: 4,
      maintenance: 4,
      rentalCollected: 48_000_000,
      depositHeld: 30_000_000,
    },
  ],
  prices: [
    { id: "mini", name: "Mini", area: 2, monthlyPrice: 900_000 },
    { id: "standard", name: "Tiêu chuẩn", area: 4, monthlyPrice: 1_500_000 },
    { id: "large", name: "Lớn", area: 6, monthlyPrice: 2_100_000 },
  ],
};

export const operationsRentalSamples = [
  {
    id: "RNT-001",
    facilityId: "SGC",
    unitTypeId: "mini",
    expiresAt: "2026-12-07",
    status: "active",
  },
  {
    id: "RNT-002",
    facilityId: "BTL",
    unitTypeId: "standard",
    expiresAt: "2026-10-10",
    status: "expiring",
  },
  {
    id: "RNT-003",
    facilityId: "CG",
    unitTypeId: "large",
    expiresAt: "2026-10-05",
    status: "overdue",
  },
  {
    id: "RNT-004",
    facilityId: "NSG",
    unitTypeId: "mini",
    expiresAt: "2026-11-07",
    status: "active",
  },
] as const;

export const operationsTypeMetrics: Readonly<
  Record<string, Readonly<Record<string, OperationsTypeMetrics>>>
> = {
  SGC: {
    mini: {
      total: 40,
      occupied: 30,
      available: 6,
      reserved: 2,
      maintenance: 2,
      rentalCollected: 30_000_000,
      depositHeld: 20_000_000,
    },
    standard: {
      total: 50,
      occupied: 42,
      available: 5,
      reserved: 1,
      maintenance: 2,
      rentalCollected: 54_000_000,
      depositHeld: 30_000_000,
    },
    large: {
      total: 30,
      occupied: 22,
      available: 5,
      reserved: 1,
      maintenance: 2,
      rentalCollected: 36_000_000,
      depositHeld: 20_000_000,
    },
  },
  BTL: {
    mini: {
      total: 30,
      occupied: 22,
      available: 4,
      reserved: 2,
      maintenance: 2,
      rentalCollected: 24_000_000,
      depositHeld: 15_000_000,
    },
    standard: {
      total: 40,
      occupied: 32,
      available: 5,
      reserved: 2,
      maintenance: 1,
      rentalCollected: 42_000_000,
      depositHeld: 20_000_000,
    },
    large: {
      total: 30,
      occupied: 22,
      available: 5,
      reserved: 2,
      maintenance: 1,
      rentalCollected: 30_000_000,
      depositHeld: 15_000_000,
    },
  },
  CG: {
    mini: {
      total: 20,
      occupied: 15,
      available: 3,
      reserved: 1,
      maintenance: 1,
      rentalCollected: 18_000_000,
      depositHeld: 10_000_000,
    },
    standard: {
      total: 35,
      occupied: 27,
      available: 4,
      reserved: 2,
      maintenance: 2,
      rentalCollected: 30_000_000,
      depositHeld: 18_000_000,
    },
    large: {
      total: 25,
      occupied: 18,
      available: 3,
      reserved: 3,
      maintenance: 1,
      rentalCollected: 24_000_000,
      depositHeld: 12_000_000,
    },
  },
  NSG: {
    mini: {
      total: 20,
      occupied: 14,
      available: 3,
      reserved: 1,
      maintenance: 2,
      rentalCollected: 12_000_000,
      depositHeld: 8_000_000,
    },
    standard: {
      total: 25,
      occupied: 18,
      available: 4,
      reserved: 2,
      maintenance: 1,
      rentalCollected: 18_000_000,
      depositHeld: 12_000_000,
    },
    large: {
      total: 15,
      occupied: 10,
      available: 3,
      reserved: 1,
      maintenance: 1,
      rentalCollected: 18_000_000,
      depositHeld: 10_000_000,
    },
  },
};

export const operationsRules = [
  {
    group: "Đặt kho",
    name: "Giữ capacity",
    value: "Giữ capacity của Unit Type trên toàn bộ kỳ thuê; chưa giữ sẵn một ô kho vật lý.",
    confirmed: true,
  },
  {
    group: "Đặt kho",
    name: "Đặt trước",
    value: "Ngày check-in tối đa 30 ngày kể từ thời điểm đặt.",
    confirmed: true,
  },
  {
    group: "Đặt kho",
    name: "Khách hủy trước check-in",
    value:
      "Hoàn tiền thuê đã thanh toán và mất deposit. Không tự áp dụng cho trường hợp cơ sở không cung cấp được kho.",
    confirmed: true,
  },
  {
    group: "Đặt kho",
    name: "Đổi lịch",
    value:
      "Ít nhất 24 giờ trước slot; tối đa 2 lần; giữ cơ sở, loại kho, thời hạn và kiểm tra lại capacity.",
    confirmed: true,
  },
  {
    group: "Nhận kho",
    name: "No-show",
    value:
      "Grace period kết thúc 2 giờ sau check-in slot; hoàn tiền thuê và mất deposit theo policy đã chốt.",
    confirmed: true,
  },
  {
    group: "Nhận kho",
    name: "Bắt đầu rental",
    value: "Chỉ bắt đầu sau khi FS xác nhận bàn giao và checklist bắt buộc đạt yêu cầu.",
    confirmed: true,
  },
  {
    group: "Trả kho",
    name: "Quyết toán và hoàn cọc",
    value: "Quyền xác nhận phí, miễn giảm và phương thức hoàn cọc chưa được chốt.",
    confirmed: false,
  },
] as const;
