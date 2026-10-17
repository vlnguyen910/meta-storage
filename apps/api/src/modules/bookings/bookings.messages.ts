export const BOOKING_MESSAGES = {
  unitAssignmentChanged: "Kho được phân công đã thay đổi.",
  cancellationAccessRequired: "Cần token checkout hoặc đăng nhập tài khoản sở hữu booking để hủy.",
  cancellationClosed: "Chỉ được hủy booking đã thanh toán, chưa bàn giao và chưa hết hạn check-in.",
  cancellationPaymentInvalid: "Không thể xác định khoản thanh toán hợp lệ để hoàn tiền thuê.",
  cancellationSummary: "Cancel a paid booking before check-in handover",
  cancellationDescription:
    "Requires x-booking-access-token from draft checkout or the active booking owner's session. CONFIRMED bookings may be cancelled before the final check-in slot ends, including when verification is VERIFIED but handover is incomplete. Rental fee is queued for manual refund; the deposit is forfeited. Releases capacity and cancels assignments in one transaction. Repeated cancellation returns the persisted result. No money is transferred by this endpoint.",
  cancellationReason: "Khách hủy trước bàn giao kho; hoàn tiền thuê và giữ tiền cọc.",
  noShowReason: "Booking chưa bàn giao khi hết slot cuối ngày; hoàn tiền thuê và giữ tiền cọc.",
  accessInvalid: "Liên kết hoặc phiên tra cứu không hợp lệ hoặc đã hết hạn.",
  accessUnavailable: "Dịch vụ tra cứu tạm thời không khả dụng. Vui lòng thử lại sau.",
  accessRateLimited: "Bạn đã thử quá nhiều lần. Vui lòng thử lại sau một phút.",
  accessOriginRejected: "Nguồn yêu cầu không được phép.",
  exchangeDescription:
    "POST the 64-character token from the email link fragment. Requires an allowed Origin. Returns bookingCode, expiresAt and current customer-facing booking details, and sets metastorage_booking_session (HttpOnly, SameSite=Lax, Secure in production, Path=/api/booking) for 30 minutes. Display the returned booking immediately; use GET tracking for refresh and subsequent updates. Reusable magic links expire after 7 days. Limited to 30 exchanges per minute per IP. No account login required; responses are no-store.",
  trackingDescription:
    "Requires the booking tracking cookie from magic-link exchange. Reads current customer-facing booking and payment details from PostgreSQL; the session can access only its own bookingCode. No account permissions are granted. Session expiry does not slide. Responses are no-store.",
  revokeDescription:
    "Requires an allowed Origin. Deletes the current Redis booking session and clears the cookie. Returns 204, including when no session exists. The original magic link can still be reopened until its expiry.",
  sessionRevoked: "Booking tracking session revoked",
  exchangeSummary: "Exchange an email magic link for a booking-scoped session",
  trackingSummary: "View customer booking details using the booking session cookie",
  revokeSummary: "Revoke the current booking tracking session",

  checkInInPast: "Ngày và giờ nhận kho phải sau thời điểm hiện tại (giờ Việt Nam).",
  checkInTomorrow: "Ngày nhận kho sớm nhất là ngày mai theo giờ Việt Nam.",
  checkInOutsideSlots: "Giờ nhận kho phải nằm trong một ca nhận kho có sẵn.",
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
  draftSummary: "Create a booking draft (guest or signed-in account)",
  draftDescription:
    "Submit checkInDate as YYYY-MM-DD in Asia/Ho_Chi_Minh and an existing checkInSlotId, along with facilityId, unitTypeId and durationMonths. The check-in date must be tomorrow or later in Vietnam calendar time. The server combines that date with the selected slot's start time, within facility operating hours. checkInAt in the response is the resolved UTC timestamp; it is not a request field. Pricing is snapshotted. Contact is submitted at payment; this request does not accept contact or userId. Keep draftAccessToken for subsequent checkout steps. Creating a draft does not hold capacity. Replace example IDs with IDs from your database.",
  facilitySummary: "List operational bookings at a facility",
  facilityDescription:
    "Requires a session and facility manager assignment, or global system admin/business operation manager access. DRAFT bookings are excluded; status is optional. Example IDs must be replaced with IDs from your database.",
  tasksSummary: "List bookings assigned to the signed-in account",
  tasksDescription:
    "Requires a session. Returns non-DRAFT bookings whose assignedStaffId matches the session account, optionally filtered by facilityId.",
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
