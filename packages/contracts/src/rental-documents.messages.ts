export const RENTAL_DOCUMENT_MESSAGES = {
  notFound: "Không tìm thấy hợp đồng.",
  forbidden: "Bạn không có quyền truy cập hợp đồng này.",
  invalidPdf: "Hợp đồng phải là PDF đọc được, không mã hóa, có trang hợp lệ và không quá 20 MB.",
  incomplete:
    "Chưa đủ thông tin khách, cơ sở, loại kho, giá thuê, tiền cọc, thời hạn thuê hoặc booking.",
  paymentRequired: "Chỉ phát hành hợp đồng sau khi thanh toán đã xác nhận thành công.",
  conflict: "Hợp đồng hoặc booking đã thay đổi trạng thái.",
  issuedRequired: "Cần hợp đồng PDF hợp lệ đã phát hành trước khi bàn giao kho.",
  unavailable: "Kho lưu trữ hợp đồng chưa sẵn sàng.",
} as const;
