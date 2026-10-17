# Kế hoạch backend Flow 4 — người thực hiện: bạn

Tiến độ: đã triển khai lát cắt giá chung theo loại kho, chính sách cọc chung lưu
DB, API BOM/version/audit và nối Booking draft. Xem
[API và cách khởi tạo](flow-4-pricing-api.md). Báo cáo backend đã được bổ sung theo
[định nghĩa/API điều hành](flow-4-reports-api.md); phí vẫn chưa triển khai;
các mục dưới đây là kế hoạch tổng thể, không phải danh sách đã nghiệm thu.

Mốc source `b4003a9` ngày 17/10/2026. Đọc
[kiểm kê chung](flow-4-5-backend-audit.md) trước khi code.
Chỉ API, contracts và persistence cần thiết; không sửa web/mobile/API client/mocks.
Các endpoint bên dưới là đề xuất, chưa triển khai và chưa phải business decision.

## Mục tiêu và phạm vi

BOM xem/cập nhật chính sách giá, cọc và phí đã chốt; checkout dùng đúng chính
sách; BOM xem/export báo cáo nhất quán, FM đọc được phần cơ sở được phân quyền.
Không nhận luôn hệ thống kế toán, tự động chuyển tiền hoàn cọc, Flow 6 hoặc Flow 7.

## F4-0 — Chốt contract và policy

- Hoàn thiện #42: giá global/facility, quyền BOM/FM, công thức cọc, thời điểm hiệu
  lực, rounding/currency, cách xử lý draft tồn tại khi đổi cấu hình.
- Hoàn thiện #43: thời điểm ghi nhận doanh thu; tiền thu, tiền thuê, cọc đang giữ,
  cọc mất, khoản chờ hoàn và khoản đã hoàn được biểu diễn thế nào; timezone/kỳ lọc.
- Chốt các fee/waiver cụ thể được phép cấu hình và ai áp dụng trên từng hồ sơ.
  Quyền cấu hình phí không tự cấp quyền duyệt khoản khấu trừ/hoàn cọc.
- Chốt utilization: hiện tại hay theo kỳ, mẫu số có loại MAINTENANCE/INACTIVE không,
  hold chưa gán ô được trình bày riêng thế nào. Thiếu dữ liệu lịch sử thì ghi rõ.

Đầu ra: bảng input/output, actors, rules và test cases. Phần phụ thuộc chưa chốt
ghi TBD; vẫn có thể làm query thô tiền thu và kiểm kê status với nhãn đúng nghĩa.

## F4-1 — Cấu hình giá/cọc/phí và persistence

- Bổ sung feature `business-rules`/`pricing` tối thiểu, schema input Zod theo rule
  cụ thể, DTO/types và messages cạnh feature. Không xây generic config engine.
- Đề xuất GET/PATCH `/api/business-rules/pricing`, GET/PATCH
  `/api/business-rules/fees`; thay đổi pricing chỉ BOM theo #44, quyền khác TBD.
- Tái sử dụng giá gốc `unit_types.monthlyPrice` nếu mô hình global được giữ.
  Không thêm bảng giá thứ hai chứa cùng số tiền. Chỉ thêm override/version khi
  quyết định yêu cầu, phối hợp người Flow 5 tại `facility_unit_types`.
- Lưu được người sửa, thời điểm và phiên bản/lịch sử cần thiết; cập nhật đồng
  thời có conflict control phù hợp, không ghi đè âm thầm.
- Nếu đổi DB: sửa diagram + Drizzle schema cùng nhau, generate migration bằng
  `bun run db:generate`; không sửa SQL migration sinh tự động.

Nghiệm thu: rule invalid bị từ chối; non-BOM không ghi được; dữ liệu vẫn còn sau
restart; concurrent update không làm mất thay đổi đã được chấp nhận.

## F4-2 — Nối chính sách vào Flow 1 hiện hữu

- Mở rộng `BookingsService.createDraft` tại module bookings để đọc nguồn giá/cọc
  đã lưu thay cho công thức trực tiếp hiện tại. Giữ nguyên endpoint tạo draft.
- Trả/lưu monthlyRateSnapshot, rentalFeeAmount, depositAmount, totalAmount như
  contract hiện hành. Lưu tham chiếu policy nếu quyết định yêu cầu.
- Payment/confirmation/refund tiếp tục đọc snapshot đã được chấp nhận. Không đổi
  tiền của payment pending/booking đã trả tiền khi BOM cập nhật giá.
- Không viết lại hold 10 phút, SePay/webhook/reconciliation, cron, guest access
  hoặc API refund; dùng flow hiện có. Draft cũ áp dụng rule nào phải theo F4-0.

Nghiệm thu: draft mới dùng rule mới; checkout cũ giữ số tiền theo policy đã chốt;
payment callback/retry tạo đúng một kết quả; tiền thuê và cọc luôn tách riêng.

## F4-3 — Reports và export dùng DB thật

- Đề xuất GET `/api/reports/revenue`, `/api/reports/utilization`,
  `/api/reports/rentals`; output có thể trả DTO phù hợp từng báo cáo.
- Query filters: thời gian, facility, unitType, rental status khi có nghĩa với
  metric; limit/offset cho danh sách, không áp pagination trước khi tính tổng.
- BOM xem toàn hệ thống; FM chỉ facility có assignment active. Quyền SA/FS xem
  báo cáo tài chính không được suy ra từ việc guard hiện tại cho global scope.
- Query bằng Drizzle select/join/grouping/CTE; chỉ dùng sql fragment khi helper
  chưa đáp ứng và ghi lý do cho full SQL nếu thật sự cần. Giữ tiền decimal/string
  theo contract, tránh JS float làm sai tổng tiền.
- Aggregate tiền theo payment/refund thực tế và snapshot booking, không theo giá
  hiện tại. Tránh nhân bản tiền khi join một booking với nhiều bản ghi liên quan.
- Giai đoạn đầu ưu tiên số liệu hiện tại có bằng chứng; không tự dựng overdue,
  renewal revenue hoặc historical utilization chưa có nguồn dữ liệu.
- Export CSV cùng filter/permission và query với JSON report; có thể dùng GET
  `/api/reports/export?type=...` với allowlist report. Chốt format/giới hạn trước;
  không mặc định thêm Excel/PDF, dependency hoặc export background queue.
  Escape CSV và xử lý ô có thể bị đọc thành công thức spreadsheet.
- Người Flow 5 dùng chung query scoped cho facility summary, không viết công thức
  revenue/utilization lần hai.

## F4-4 — Integration tests và bàn giao

- Dùng `app.inject()` + PostgreSQL cô lập cho persistence/aggregation/snapshot.
  Dữ liệu test gồm ít nhất hai cơ sở, hai loại kho, giao dịch pending/failed/paid,
  refund pending/refunded, hủy/no-show và nhiều kỳ thời gian.
- Kiểm tra unauthorized/cross-facility, input invalid, empty report, biên kỳ theo
  timezone, cọc tách riêng, refund không bị đếm hai lần, callback lặp không tăng tổng.
- Test cấu hình cọc/giá theo các case đã chốt; tái dùng regression Flow 1 hiện có,
  đặc biệt `booking-drafts.test.ts` và `booking-payment-start.test.ts`.
- Test CSV khớp JSON về tổng/filter/phạm vi, không xuất dữ liệu vượt quyền.
- Chạy check-types API/contracts/database, Biome file thay đổi và suite liên quan.
  Không nhận DB integration pass khi test bị skip do thiếu database cô lập.
- Bàn giao Swagger và ví dụ request/response, seed/fixture cô lập, lệnh test và
  script demo: BOM sửa rule → tạo draft qua API cũ → xác nhận giao dịch ở môi
  trường test → đọc report/export và đối chiếu snapshot.

Không tự commit/push hoặc thay backend production trong lúc thực hiện kế hoạch.
