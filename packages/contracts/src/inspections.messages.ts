export const INSPECTION_MESSAGES = {
  storageUnavailable:
    "Không thể lưu ảnh lên Cloudinary. Kiểm tra cấu hình hoặc kết nối rồi thử lại; biên bản chưa bị khóa.",
  handoverIncomplete: "Cần khóa biên bản kiểm tra đúng ô kho trước khi bàn giao.",
  handoverInvalid: "Booking, thanh toán hoặc ô kho đã thay đổi. Tải lại hồ sơ trước khi bàn giao.",
  rentalConflict: "Ô kho đang được sử dụng bởi hợp đồng khác; liên hệ FM để xử lý.",
  incomplete: "Cả bốn mục kiểm tra phải đạt PASS trước khi hoàn tất.",
  invalidResults:
    "Kết quả checklist phải gồm các mục hợp lệ, không trùng và chỉ tham chiếu ảnh của hồ sơ.",
  invalidContext:
    "Booking phải được verify và có ô kho đang gán. Nếu đổi kho hoặc verify lại, hãy tạo inspection mới.",
  immutable: "Inspection đã hoàn tất; không thể thay đổi baseline.",
  stale: "Dữ liệu đã thay đổi. Tải lại inspection trước khi tiếp tục.",
  notFound: "Không tìm thấy inspection hoặc ảnh.",
  invalidPhoto: "Ảnh phải là JPEG, PNG hoặc WebP hợp lệ, tối đa 3 MB.",
  photoLimit: "Mỗi inspection lưu tối đa 8 ảnh.",
  notesLimit: "Mô tả hiện trạng tối đa 4000 ký tự.",
  duplicateViolationCode: "Mã phí bị trùng.",
  policyVersionRequired: "Cần gửi phiên bản danh mục phí đang xem.",
} as const;
