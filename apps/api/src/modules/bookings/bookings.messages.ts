export const BOOKING_MESSAGES = {
  checkInInPast: "Ngày và giờ nhận kho phải sau thời điểm hiện tại (giờ Việt Nam).",
  checkInOutsideSlots: "Giờ nhận kho phải nằm trong một ca nhận kho có sẵn.",
  unitTypeCapacityUnavailable: "Unit Type không còn capacity trong kỳ thuê",
  failedToCreateDraft: "Failed to create booking draft",
  bookingCannotAssignStaff: "Booking draft không thể phân công nhân viên",
  bookingDetailsNotFound: "Không tìm thấy thông tin đơn đặt chỗ (Booking)",
  staffAssignmentClosed: "Chỉ được phân công Staff cho booking đang chờ check-in.",
  bookingNotFound: "Không tìm thấy đơn đặt chỗ",
  physicalUnitNotFound: "Không tìm thấy ô kho vật lý (Physical Unit)",
  invalidBookingStatus: (status: string) =>
    `Đơn đặt chỗ ở trạng thái '${status}', không thể gán ô kho`,
  physicalUnitDoesNotMatchReservation: "Ô kho vật lý không khớp với cơ sở hoặc loại kho đã đặt",
  physicalUnitUnavailable: (status: string) =>
    `Ô kho vật lý đang ở trạng thái không khả dụng ('${status}')`,
  physicalUnitRentalConflict:
    "Ô kho vật lý hiện đang có hợp đồng thuê khác chồng lấn khoảng thời gian này",
  physicalUnitAssignmentConflict:
    "Ô kho vật lý đã được gán cho một đơn đặt chỗ khác trong cùng kỳ thuê",
  physicalUnitAssignmentFailed: "Không thể gán ô kho vật lý",
  failedToCreateUnitAssignment: "Failed to create unit assignment",
} as const;
