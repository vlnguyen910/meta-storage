export const USER_MESSAGES = {
  failedToCreateUser: "Failed to create user",
  emailAlreadyExists: "Email đã được sử dụng",
  phoneAlreadyExists: "Số điện thoại đã được sử dụng",
  adminCreationForbidden: "Không được tạo thêm SYSTEM_ADMIN",
  adminProtected: "Không được khóa hoặc thay đổi vai trò SYSTEM_ADMIN duy nhất",
  userCreated: "Tài khoản nghiệp vụ đã được tạo",
  roleUpdated: "Vai trò đã được cập nhật",
  statusUpdated: "Trạng thái tài khoản đã được cập nhật",
  profileUpdated: "Thông tin cá nhân đã được cập nhật",
  userNotFound: "User này không tồn tại",
  openWorkPreventsChange:
    "Hãy bàn giao hết công việc đang phụ trách trước khi khóa tài khoản hoặc đổi vai trò.",
} as const;
