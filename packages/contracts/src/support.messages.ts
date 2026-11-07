export const SUPPORT_MESSAGES = {
  notFound: "Không tìm thấy phiếu hỗ trợ hoặc nội dung được phép truy cập.",
  customerOnly: "Chỉ khách hàng đang hoạt động được sử dụng API hỗ trợ này.",
  invalidContext: "Yêu cầu hỗ trợ không thuộc booking hoặc ô kho đã nhận của bạn.",
  handoverRequired: "Bạn chỉ có thể báo vấn đề về kho sau khi nhận kho và trước khi kết thúc thuê.",
  invalidPayment: "Giao dịch không thuộc booking được hỗ trợ.",
  closed: "Phiếu hỗ trợ đã đóng, không thể thêm nội dung hoặc ảnh.",
  versionConflict: "Phiếu hỗ trợ đã thay đổi. Vui lòng tải lại trước khi tiếp tục.",
  idempotencyConflict: "Mã yêu cầu đã được sử dụng cho một nội dung khác.",
  invalidCursor: "Thông tin phân trang không hợp lệ.",
  imageLimit: "Mỗi phiếu hỗ trợ được đính kèm tối đa 10 ảnh.",
  invalidImage: "Ảnh phải là JPEG, PNG hoặc WebP hợp lệ, dung lượng tối đa 5 MiB.",
  storageUnavailable: "Không thể truy cập dịch vụ lưu ảnh. Vui lòng thử lại sau.",
  imageIntegrity: "Không thể đọc ảnh hỗ trợ đã lưu.",
  required: "Vui lòng nhập nội dung bắt buộc.",
  subjectLimit: "Tiêu đề không được vượt quá 200 ký tự.",
  contentLimit: "Nội dung không được vượt quá 5000 ký tự.",
  invalidKey: "Mã yêu cầu phải có 8–128 ký tự chữ, số hoặc . _ : -.",
  filename: "Tên ảnh không hợp lệ hoặc vượt quá 120 ký tự.",
  tag: "Customer Support",
  createSummary: "Gửi phiếu hỗ trợ cho booking của bạn",
  listSummary: "Xem danh sách phiếu hỗ trợ của bạn",
  detailSummary: "Xem phiếu hỗ trợ và trao đổi công khai",
  messagesSummary: "Xem lịch sử trao đổi công khai",
  replySummary: "Gửi thêm nội dung cho phiếu hỗ trợ đang mở",
  uploadSummary: "Đính kèm ảnh vào trao đổi của bạn",
  imageSummary: "Đọc ảnh riêng tư thuộc phiếu hỗ trợ của bạn",
  receivedSubject: "STOREX — Đã tiếp nhận phiếu hỗ trợ",
} as const;

export function supportReceiptBody(ticketId: string, payment: boolean): string {
  return (
    "Cảm ơn bạn đã gửi phiếu hỗ trợ " +
    ticketId +
    ". Chúng tôi đã tiếp nhận yêu cầu và " +
    (payment
      ? "người phụ trách thanh toán sẽ liên hệ, bắt đầu xử lý trong vòng 12 giờ."
      : "sẽ phân công nhân viên đến xử lý trong vòng 12 giờ.")
  );
}
