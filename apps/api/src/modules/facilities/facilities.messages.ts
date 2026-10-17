export const FACILITY_MESSAGES = {
  facilityUnavailable: "Không tìm thấy cơ sở khả dụng",
  checkInOutsideOperatingHours: (open: string, close: string) =>
    `Giờ nhận kho phải từ ${open.slice(0, 5)} đến ${close.slice(0, 5)} (giờ Việt Nam) tại chi nhánh này.`,
  loginRequired: "Bạn cần đăng nhập để thực hiện thao tác này",
  facilityIdRequired: "Mã định danh cơ sở (facilityId) là bắt buộc",
  facilityListAccessDenied: "Bạn không có quyền xem danh sách cơ sở",
  facilityAccessDenied: "Bạn không có quyền truy cập cơ sở này",
  facilityOperationDenied: "Bạn không có quyền thực hiện thao tác này tại cơ sở",
  facilityCodeAlreadyExists: (code: string) => `Cơ sở với mã "${code}" đã tồn tại`,
  facilityNotFound: (id: string) => `Không tìm thấy cơ sở với id "${id}"`,
  userNotFound: (id: string) => `Không tìm thấy người dùng với id "${id}"`,
  inactiveUserAssignment: "Không thể phân công cho tài khoản đang bị vô hiệu hóa",
  assignmentRoleMismatch: "Vai trò phân công phải trùng với vai trò của tài khoản",
  userAlreadyAssigned:
    "Người dùng đã được phân công tại một cơ sở khác; hãy kết thúc phân công hiện tại trước",
  staffAssignmentNotFound: "Không tìm thấy phân công nhân sự tương ứng",
  failedToCreateFacility: "Failed to create facility",
  failedToUpsertAssignment: "Failed to upsert assignment",
} as const;
