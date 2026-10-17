export const MOCK_MESSAGES = {
  missing: "Không tìm thấy dữ liệu mô phỏng.",
  forbidden: "Vai trò hoặc phân công hiện tại không cho phép thao tác này.",
  capacity: "Loại kho này đã hết chỗ. Vui lòng chọn loại kho khác.",
  hold: "Thời gian giữ chỗ đã hết hoặc không hợp lệ. Vui lòng xem lại đơn thuê.",
  paymentFailed: "Thanh toán mô phỏng bị từ chối. Bạn có thể thử lại.",
  invalid: "Thông tin không hợp lệ. Vui lòng kiểm tra lại các trường.",
  stale: "Dữ liệu đã thay đổi. Tải lại trước khi tiếp tục.",
  locked: "Biên bản đã khóa, không thể sửa nội dung.",
  incomplete: "Cần xác nhận đúng ô kho, ghi tình trạng và thêm ít nhất một ảnh trước khi khóa.",
  notReady:
    "Booking chưa đủ điều kiện: cần thanh toán, phân công Staff, gán ô kho và xác minh trong giờ hẹn.",
  storage: "Bộ nhớ trình duyệt đã đầy. Xóa bớt ảnh hoặc đặt lại dữ liệu mock.",
  registered: "Tài khoản mock đã tạo. Bạn có thể đăng nhập ngay; không gửi email thực tế.",
  registeredTitle: "Đã tạo tài khoản mô phỏng",
  endpoint: "Thao tác này chưa có dữ liệu mock; không gửi request tới backend.",
} as const;
