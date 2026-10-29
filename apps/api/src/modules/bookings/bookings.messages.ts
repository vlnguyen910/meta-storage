export const BOOKING_MESSAGES = {
  cancellationAccessRequired: "Cần đăng nhập tài khoản sở hữu booking để hủy.",
  cancellationClosed: "Chỉ được hủy booking đã thanh toán, chưa bàn giao và chưa hết hạn check-in.",
  cancellationPaymentInvalid: "Không thể xác định khoản thanh toán hợp lệ để hoàn tiền thuê.",
  cancellationSummary: "Cancel a paid booking before check-in handover",
  cancellationDescription:
    "Requires the active booking owner's CUSTOMER session. CONFIRMED bookings may be cancelled before the final check-in slot ends, including after an inspection starts but before handover. Rental fee is queued for manual refund; the deposit is forfeited. Releases capacity and cancels assignments in one transaction. Repeated cancellation returns the persisted result. No money is transferred by this endpoint.",
  cancellationReason: "Khách hủy trước bàn giao kho; hoàn tiền thuê và giữ tiền cọc.",
  noShowReason: "Booking chưa bàn giao khi hết slot cuối ngày; hoàn tiền thuê và giữ tiền cọc.",
  checkInInPast: "Ngày và giờ nhận kho phải sau thời điểm hiện tại (giờ Việt Nam).",
  checkInTomorrow: "Ngày nhận kho sớm nhất là ngày mai theo giờ Việt Nam.",
  checkInOutsideSlots: "Giờ nhận kho phải nằm trong một ca nhận kho có sẵn.",
  checkInNotReady: (reasons: string[]) => `Không thể bắt đầu nhận kho: ${reasons.join(" ")}`,
  checkInReadinessReasons: {
    INVALID_BOOKING_STATUS: "Booking không ở trạng thái CONFIRMED.",
    PAYMENT_NOT_SUCCEEDED: "Thanh toán booking chưa thành công.",
    UNIT_NOT_ASSIGNED: "Booking chưa được gán ô kho vật lý còn hiệu lực.",
    CHECKIN_SLOT_NOT_CONFIGURED: "Booking thiếu giờ bắt đầu slot nhận kho hợp lệ.",
    TOO_EARLY: "Chưa tới OPENING_HOUR trong ngày nhận kho.",
    DEADLINE_PASSED: "Đã qua CLOSING_HOUR trong ngày nhận kho.",
  },
  invalidCheckInSlot: "Ca nhận kho không tồn tại hoặc có khoảng giờ không hợp lệ.",
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

export const BOOKING_SWAGGER_MESSAGES = {
  tag: "Bookings",
  slotsSummary: "List shared check-in slots",
  slotsDescription:
    "Public endpoint. Returns all shared check-in slot definitions ordered by startTime, endTime and id. Times use HH:mm:ss in Asia/Ho_Chi_Minh; they are time-of-day values without a date or UTC offset. Returns an empty array when no slots are configured. Use an id as checkInSlotId when creating a booking draft. This list does not indicate facility/date availability; draft creation validates the selected schedule.",
  draftSummary: "Create a booking draft (authenticated customer)",
  draftDescription:
    "Submit checkInDate as YYYY-MM-DD in Asia/Ho_Chi_Minh and an existing checkInSlotId, along with facilityId, unitTypeId and durationMonths. The check-in date must be tomorrow or later in Vietnam calendar time. The server combines that date with the selected slot's start time, within facility operating hours. checkInAt in the response is the resolved UTC timestamp; it is not a request field. Pricing is snapshotted. Requires an active CUSTOMER session. The owner is taken from that session. Supply an optional contactPhone at payment, otherwise the profile phone is used; name and email come from the account. Creating a draft does not hold capacity. Replace example IDs with IDs from your database.",
  facilitySummary: "List operational bookings at a facility",
  facilityDescription:
    "Requires a session and facility manager assignment, or global system admin/business operation manager access. DRAFT bookings are excluded; status is optional. Example IDs must be replaced with IDs from your database.",
  tasksSummary: "List bookings assigned to the signed-in account",
  tasksDescription:
    "Requires a session. Returns non-DRAFT bookings whose assignedStaffId matches the session account, optionally filtered by facilityId.",
  customerListSummary: "List the signed-in customer's bookings",
  customerListDescription:
    "Requires a CUSTOMER session. Returns only bookings owned by the session userId, excludes DRAFT bookings, and uses a stable createdAt/id cursor. Contact email is not used for ownership.",
  customerDetailSummary: "Get a booking owned by the signed-in customer",
  customerDetailDescription:
    "Requires a CUSTOMER session. Returns only the booking whose userId matches the session userId. Does not expose access token hashes, QR token hashes, provider details, or staff contact details.",
  detailSummary: "Get an operational booking",
  detailDescription:
    "Requires a session and staff/manager assignment at the booking facility, or global system admin/business operation manager access. DRAFT bookings are not returned by this endpoint.",
  unitsSummary: "List units considered for booking assignment",
  unitsDescription:
    "Requires facility manager or global admin/business operation manager access. Returns AVAILABLE or RESERVED units matching the facility and unit type. Check isAvailableForPeriod: only a free unit or the unit already held by this booking can be assigned. Other live bookings and ACTIVE rentals block assignment regardless of schedule.",
  assignUnitSummary: "Assign or reassign a physical unit",
  assignUnitDescription:
    "Requires facility manager or global admin/business operation manager access and a CONFIRMED booking. Revalidates facility/type, AVAILABLE status or this booking's RESERVED unit, and all live rentals/assignments in a transaction. Atomically marks the selected unit RESERVED and releases an unused prior RESERVED unit. Same-unit retries preserve the assignment.",
  assignStaffSummary: "Assign a staff member to an operational booking",
  assignStaffDescription:
    "Requires facility manager or global admin/business operation manager access. The selected account must be active and have an active FACILITY_STAFF assignment at this facility. DRAFT bookings cannot be assigned. Only staffId is used; notes is currently accepted but not persisted.",
  success: "Successful response",
  failure: "Request failed; error.code equals the HTTP response status",
} as const;
