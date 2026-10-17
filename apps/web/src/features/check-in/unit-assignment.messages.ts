export const UNIT_ASSIGNMENT_MESSAGES = {
  unitRequired: "Vui lòng chọn một ô kho vật lý hợp lệ từ danh sách.",
  assignmentSucceeded: (bookingCode: string) =>
    `Đã gán ô kho vật lý cho đơn đặt chỗ ${bookingCode}.`,
  assignmentFailed: "Không thể gán ô kho vật lý. Vui lòng kiểm tra lại.",
} as const;
