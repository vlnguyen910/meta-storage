import { type Facility, FacilityStatus } from "@metastorage/contracts";

export const facilitySeeds: Facility[] = [
  {
    id: "fac-hcm-central",
    code: "HCM-01",
    name: "metastorage Sài Gòn Central",
    description:
      "Kho trung tâm thuận tiện cho gia đình và doanh nghiệp nhỏ, có kiểm soát ra vào 24/7.",
    address: {
      line1: "118 Nguyễn Văn Linh",
      ward: "Phường Tân Phong",
      district: "Quận 7",
      city: "TP. Hồ Chí Minh",
    },
    phone: "028 7300 1188",
    openingHours: "06:00 - 22:00 hằng ngày",
    features: ["Camera 24/7", "Thang hàng", "Bãi đỗ xe", "Kiểm soát độ ẩm"],
    status: FacilityStatus.ACTIVE,
    availableUnits: 5,
    totalUnits: 8,
    startingMonthlyPrice: 900_000,
  },
  {
    id: "fac-hn-west",
    code: "HN-01",
    name: "metastorage Hà Nội West",
    description:
      "Không gian lưu trữ sạch, khô thoáng ở phía Tây Hà Nội với nhiều lựa chọn diện tích.",
    address: {
      line1: "42 Lê Quang Đạo",
      ward: "Phường Phú Đô",
      district: "Quận Nam Từ Liêm",
      city: "Hà Nội",
    },
    phone: "024 7300 2242",
    openingHours: "07:00 - 21:00 hằng ngày",
    features: ["Camera 24/7", "Xe đẩy miễn phí", "Bảo vệ tại chỗ", "Mái che bốc dỡ"],
    status: FacilityStatus.ACTIVE,
    availableUnits: 5,
    totalUnits: 8,
    startingMonthlyPrice: 850_000,
  },
  {
    id: "fac-dn-riverside",
    code: "DN-01",
    name: "metastorage Đà Nẵng Riverside",
    description:
      "Cơ sở mới gần trung tâm thành phố, phù hợp lưu trữ đồ cá nhân, hồ sơ và hàng bán lẻ.",
    address: {
      line1: "95 Ngô Quyền",
      ward: "Phường An Hải Bắc",
      district: "Quận Sơn Trà",
      city: "Đà Nẵng",
    },
    phone: "0236 730 3395",
    openingHours: "06:30 - 21:30 hằng ngày",
    features: ["Camera 24/7", "Khóa điện tử", "Phòng cháy tự động", "Khu bốc dỡ"],
    status: FacilityStatus.ACTIVE,
    availableUnits: 6,
    totalUnits: 8,
    startingMonthlyPrice: 750_000,
  },
];
