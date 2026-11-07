export const STORAGE_UNIT_MESSAGES = {
  createSummary: "Tạo ô kho vật lý trong cơ sở",
  updateSummary: "Cập nhật thông tin ô kho vật lý",
  unitCreated: "Đã tạo ô kho.",
  unitUpdated: "Đã cập nhật thông tin ô kho.",
  maintenanceTransitionSummary: "Chuyển trạng thái bảo trì ô kho",
  unitCodeAlreadyExists: "Mã ô kho đã được sử dụng.",
  unitTypeUnavailable: "Loại kho không khả dụng tại cơ sở này.",
  unitHasOperations: "Không thể đổi loại ô kho khi đang có booking hoặc hợp đồng thuê.",
  persistenceFailed: "Không thể lưu thay đổi ô kho.",
  unitNotFound: "Không tìm thấy ô kho vật lý.",
  facilityNotFound: "Không tìm thấy cơ sở.",
  scopeUnavailable: "Không thể xác định phạm vi truy cập ô kho.",
  inventorySummary: "Liệt kê ô kho trong phạm vi cơ sở được phân công",
  detailSummary: "Xem chi tiết ô kho trong phạm vi cơ sở được phân công",
  cannotPutOccupiedUnitInMaintenance:
    "Không thể đưa ô kho đang có khách thuê (OCCUPIED) vào bảo trì; phải tiến hành bàn giao trả kho hoặc đổi kho trước.",
  cannotPutReservedUnitInMaintenance:
    "Không thể đưa ô kho đã gán cho đơn đặt (RESERVED) vào bảo trì; hãy đổi ô kho khác cho đơn đặt trước.",
  cannotPutInactiveUnitInMaintenance:
    "Không thể đưa ô kho đang ngưng hoạt động (INACTIVE) vào bảo trì.",
  unitAlreadyInMaintenance: "Ô kho hiện tại đã ở trạng thái bảo trì (MAINTENANCE).",
  unitAlreadyAvailable: "Ô kho hiện tại đã ở trạng thái sẵn sàng (AVAILABLE).",
  invalidStatusTransition: (from: string, to: string) =>
    `Không hỗ trợ chuyển trạng thái ô kho từ '${from}' sang '${to}'.`,
  unitHasActiveRental: "Ô kho đang có hợp đồng thuê hoạt động, không thể chuyển sang bảo trì.",
  unitHasActiveAssignment:
    "Ô kho đang được gán cho một đơn đặt chỗ chờ nhận kho, không thể chuyển sang bảo trì.",
  unitMaintenanceSuccess: "Cập nhật trạng thái bảo trì ô kho thành công.",
  unitRestoreSuccess: "Khôi phục ô kho về trạng thái sẵn sàng thành công.",
} as const;
