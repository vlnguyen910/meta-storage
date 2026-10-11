export const BOOKING_MESSAGES = {
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
  draftSummary: "Create a booking draft (guest or signed-in account)",
  draftDescription:
    "Submit checkInDate as YYYY-MM-DD in Asia/Ho_Chi_Minh and an existing checkInSlotId, along with facilityId, unitTypeId and durationMonths. The server combines that date with the selected slot's start time, which must be in the future and within facility operating hours. checkInAt in the response is the resolved UTC timestamp; it is not a request field. Pricing is snapshotted. Contact is submitted at payment; this request does not accept contact or userId. Keep draftAccessToken for subsequent checkout steps. Creating a draft does not hold capacity. Replace example IDs with IDs from your database.",
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
    "Requires facility manager or global admin/business operation manager access. Returns units matching the facility and unit type, excluding INACTIVE, LOCKED, MAINTENANCE and INSPECTION. Check isAvailableForPeriod: the result can include units with overlapping rentals or assignments.",
  assignUnitSummary: "Assign or reassign a physical unit",
  assignUnitDescription:
    "Requires facility manager or global admin/business operation manager access and a CONFIRMED booking. Revalidates unit status, facility/type and overlapping rentals/assignments in a transaction. Replaces the previous active assignment.",
  assignStaffSummary: "Assign a staff member to an operational booking",
  assignStaffDescription:
    "Requires facility manager or global admin/business operation manager access. The selected account must be active and have an active FACILITY_STAFF assignment at this facility. DRAFT bookings cannot be assigned. Only staffId is used; notes is currently accepted but not persisted.",
  success: "Successful response",
  failure: "Request failed; error.code equals the HTTP response status",
} as const;
