export const REPORTING_MESSAGES = {
  facilityRevenueHeadings: [
    "Cơ sở",
    "Thực thu (gồm cọc)",
    "Tiền thuê đã thu",
    "Cọc đã thu",
    "Đã hoàn",
    "Dòng tiền ròng",
    "Cọc đang giữ (hiện tại)",
    "Cọc mất (hiện tại)",
  ],
  financialTitle: "Dòng tiền trong kỳ",
  financialHelp:
    "Thực thu gồm tiền thuê và cọc. Dòng tiền ròng = thực thu − đã hoàn, không phải lợi nhuận.",
  received: "Thực thu",
  refunded: "Đã hoàn",
  net: "Dòng tiền ròng",
  rental: "Tiền thuê đã thu",
  deposit: "Tiền cọc đã thu",
  held: "Cọc đang giữ",
  pending: "Chờ hoàn tiền",
  current: "Số dư hiện tại, không phải tổng của kỳ thu",
  monthlyTitle: "Tiền thuê và dòng tiền theo tháng",
  monthlyHelp:
    "Thu theo ngày thanh toán; hoàn theo ngày hoàn thực tế, giờ Việt Nam. Tháng đầu/cuối chỉ gồm ngày trong bộ lọc; đây không phải doanh thu kế toán phân bổ theo kỳ thuê.",
  monthlyCsv: "CSV theo tháng",
  facilityCsv: "CSV theo cơ sở",
  monthlyHeadings: [
    "Tháng",
    "Tiền thuê đã thu",
    "Cọc đã thu",
    "Thực thu",
    "Đã hoàn",
    "Dòng tiền ròng",
  ],
  cashMode: "Thực thu / Đã hoàn",
  rentalMode: "Tiền thuê",
  exactData: "Xem bảng số liệu",
  unknown: "Cần đối chiếu",
  empty: "Chưa có dữ liệu trong phạm vi này.",
  month: "Tháng",
  million: "triệu đồng",
  facilityChart: "So sánh tiền thu giữa các cơ sở",
  facilityPreview: "Tiền thuê theo cơ sở",
  utilization: "Tỷ lệ khai thác theo cơ sở",
  utilizationHelp:
    "Số ô đã bàn giao đang sử dụng / số ô khai thác. Đây là hiện trạng, không phải số lượt ra vào.",
  capacityHeadings: ["Cơ sở", "Ô khai thác", "Ô đang thuê", "Tỷ lệ khai thác"],
  rentalTitle: "Tình hình thuê kho",
  rentalHelp:
    "Các lượt thuê sau bàn giao, khác với booking đã thanh toán nhưng chưa nhận kho. Đây không phải danh sách tài liệu hợp đồng.",
  rentalEmpty:
    "Chưa có lượt thuê phù hợp. Cơ sở vẫn có thể có booking đã thanh toán đang chờ bàn giao; hãy đổi bộ lọc để tra cứu.",
  rentalStatus: "Trạng thái lượt thuê",
  allStatuses: "Tất cả trạng thái",
  policySource:
    "Nội dung tham khảo: docs/flow-4-pricing-api.md và docs/booking-cancellation-policy.md; không phải form cấu hình các quy tắc này.",
  policyRules: [
    {
      group: "Đặt kho",
      name: "Giữ chỗ thanh toán",
      value:
        "Giữ chỗ 10 phút từ khi bắt đầu thanh toán. Hết hạn chưa đồng nghĩa đã hủy mọi giao dịch đang chờ đối chiếu.",
      status: "Theo luồng thanh toán",
      isTbd: false,
    },
    {
      group: "Thời hạn thuê",
      name: "Thời hạn thuê",
      value: "Từ 1 đến 12 tháng theo lịch; không quy đổi cố định một tháng thành 30 ngày.",
      status: "Theo quy tắc đặt kho",
      isTbd: false,
    },
    {
      group: "Đặt kho",
      name: "Hủy trước check-in",
      value:
        "Khách hủy: hoàn tiền thuê và mất cọc theo policy. Không tự áp dụng cho trường hợp cơ sở không cung cấp được kho.",
      status: "Theo policy hủy booking",
      isTbd: false,
    },
    {
      group: "Trả kho",
      name: "Phí và quyết toán",
      value:
        "Quyền xử lý phí, miễn giảm và quyết toán trả kho chưa đầy đủ; không tự tính hoặc tự duyệt hoàn cọc.",
      status: "TBD",
      isTbd: true,
    },
  ],
  applyVersion: "Áp dụng phiên bản mới, giữ bản nháp",
  compareVersion: "Cấu hình mới đã tải. Đối chiếu với bản nháp trước khi lưu; không tự gửi lại.",
  latestDeposit: (value: number, version: number) =>
    `Cọc hiện tại trên máy chủ: ${value} tháng · phiên bản v${version}`,
  latestPrice: (price: string, version: number) =>
    `Giá hiện tại trên máy chủ: ${price} · phiên bản v${version}`,
  reloadError: "Không thể tải cấu hình mới. Bản nháp vẫn được giữ; vui lòng thử lại.",
  mutationError: "Không thể lưu thay đổi. Vui lòng thử lại; nội dung đã nhập được giữ nguyên.",
  versionMissing: "Chưa tải được phiên bản cấu hình để lưu.",
  referenceLimit: "Mã tham chiếu tối đa 128 ký tự.",
  priceInteger: "Giá thuê phải là số nguyên trong giới hạn hệ thống.",
  depositInteger: "Hệ số cọc phải là số nguyên dương trong giới hạn hệ thống.",
  historyMore: "Tải thêm lịch sử",
  activeFacilities: "Cơ sở đang hoạt động",
  rentalStatuses: {
    ACTIVE: "Đang thuê",
    ENDED: "Đã kết thúc",
    TERMINATED: "Đã chấm dứt",
    RETURN_PENDING: "Chờ trả kho",
    OVERDUE: "Quá hạn",
    EXPIRING: "Sắp hết hạn",
  } as Record<string, string>,
  currentScope: "Hiện trạng khai thác trong phạm vi đã chọn",
  excludedCurrency:
    "Có giao dịch ngoại tệ chưa được cộng vào số liệu VND. Xem đối chiếu giao dịch.",
  zeroInventory: "Chưa có ô khai thác",
  chartHelp:
    "Có thể chạm vào cột hoặc dùng bàn phím để xem tooltip. Bảng số liệu bên dưới cung cấp giá trị chính xác.",
};
