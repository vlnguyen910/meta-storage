# Kế hoạch hoàn thiện My Storage / vòng đời thuê kho

Ngày lập: 2026-10-18; cập nhật implementation: 2026-10-20. Baseline: `dev`, commit `98ccada`.
Phạm vi: Flow 3 My Storage; chỉ backend, database, shared API contracts, test và docs.
Không sửa Web/Mobile/API client. Các quyết định mới nhất trong hội thoại được ưu tiên.

Tiến độ thực tế: T1/T2 đã có API đọc; đã thêm persistence và API return request,
lịch trả kho, checklist Admin-configurable/versioned, inspection nhiều lần, phân công
FS bởi FM, physical receipt, correction được FM duyệt, settlement/refund thủ công,
BOM rate config và audit. Đã bổ sung job overdue theo timezone cơ sở, cờ manual
review sau đủ bảy ngày overdue, outbox/inbox có retry/dedupe, reminder trước hạn
30 ngày, giữ nghĩa vụ tài sản qua inspection FAILED và thêm refund vào payment
history. PENDING chưa giữ chỗ; CONFIRMED mới reserve capacity/buffer.
Xem `docs/returns-api.md` cho endpoint, giới hạn và kiểm chứng.
T4 đã bổ sung upload/issue PDF private S3-compatible và handover gate theo quyết định
không thêm CCCD/hộ chiếu. Xem `docs/rental-contracts-api.md` cho phiên bản, quyền,
điều kiện issue, migration 0040 và kiểm thử. Job overdue và outbox đã triển khai;
báo cáo hiện hữu đã tính return refund/settlement revision theo kế hoạch review fixes;
không xây hệ thống kế toán hoặc dashboard mới. Đây chưa phải kết luận toàn bộ
Flow 3 hoàn tất. Không có renewal/upgrade trong MVP.

## 1. Hiện trạng và nguyên nhân

- Có `GET /api/rentals/mine` và `GET /api/rentals/:rentalId`, đăng ký trong `app.ts`.
  Role CUSTOMER; ownership lấy qua `bookings.userId`. Danh sách chưa lọc trạng thái;
  DTO có cơ sở/địa chỉ, loại kho, mã ô kho, ngày thuê/hết hạn, trạng thái. Chi tiết
  thêm tiền cọc và timeline tổng hợp, chưa phải lịch sử sự kiện thực tế.
- `actions` cố định `canCancel=false`, `canReschedule=false`. Chưa có API lịch sử
  thanh toán rental, hợp đồng điện tử, yêu cầu nâng cấp/trả kho/gia hạn hoặc xử lý yêu cầu.
- DB có rental duy nhất theo booking, payment gắn booking, assignment và capacity.
  Chưa có bảng yêu cầu hoặc hợp đồng. Rental được tạo khi staff bàn giao, không phải
  ngay khi thanh toán. Việc cập nhật nội dung hiển thị thuộc task frontend riêng.
- Mobile gửi CHANGE/RETURN qua `/demo/rentals/:id/requests`. Hàm `renew` trong hook
  customer tạo lại checkout hold cho draft, không gia hạn rental.
- Nguyên nhân: backend mới hoàn thiện checkout và bàn giao cùng phần đọc rental;
  chưa mô hình hóa nghiệp vụ sau bàn giao. Không thể chỉ thêm route vào UI demo.
- Ràng buộc tích hợp: payment/đối soát hiện dựa trên booking DRAFT; báo cáo tài chính
  giả định payment bằng rental fee + deposit của booking gốc. Tiền gia hạn/nâng cấp
  cần phân loại và snapshot riêng, không ghi đè giá gốc hoặc gọi lại checkout cũ.

Đã đối chiếu code, diagram, booking-payment/cancellation policy và kế hoạch Flow 2.
Chưa có issue cụ thể được cung cấp; chưa kiểm tra issue hiện tại trên GitHub hoặc DB
đang triển khai. T0 phải đối chiếu issue liên quan trước implementation.
GitNexus repo `metastorage` đã cập nhật theo baseline: `RentalsService` LOW, callers
`rentalsRoutes` → app/index; `financialRules` HIGH, callers `ReportsRepository.read`
và `reconciliation`, ảnh hưởng overview/revenue/export. Đây không phải đánh giá
toàn bộ thay đổi tương lai; chạy impact cho từng symbol trước khi sửa.

## 2. File và pattern cần tái sử dụng

| Phần | File/pattern hiện có |
| --- | --- |
| Rental | `apps/api/src/modules/rentals/rentals.{routes,service,repository,messages}.ts`; `packages/contracts/src/rentals.ts` |
| Auth/response | `modules/auth/auth.guard.ts`; `modules/facilities/facilities.access.ts`, `facility-assignments.repository.ts`; `common/response/api-response.ts`, `common/errors/*` |
| Nghiệp vụ liên quan | `modules/inspections/{inspections.service,inspections.repository,handover.policy}.ts`; `modules/bookings/bookings.repository.ts` |
| Tài chính | `modules/payments/payments.{service,repository,routes,types}.ts`, `sepay.gateway.ts`; `modules/pricing/*`; `modules/reports/reports.repository.ts` |
| DB | `docs/db-diagram.md`; `packages/database/src/schema/{rentals,payments,bookings,unit-assignments,capacity-allocations,storage-units}.ts` |
| Consumer chỉ đọc | `packages/api-client/src/{index,mobile-workflows}.ts`; `apps/web/src/features/rentals/hooks.ts`; `apps/mobile/src/features/customer/use-mobile-customer.ts` |
| Test backend | `apps/api/tests/integration/{booking-identity,booking-payment-start,handover.integration,reports-postgres}.test.ts`; `apps/api/tests/fixtures/inspection-fixture.ts` |

Giữ Route → Service → Repository, Drizzle query builder, DTO allowlist, error/envelope
hiện có. Contract input Zod dùng chung; interface mới đặt trong `*.types.ts`, message
trong `*.messages.ts`. Thêm policy thuần chỉ cho transition/tính phí cần kiểm chứng.
Mở rộng module rentals với file feature tương ứng; không tạo generic workflow engine.
Giữ tương thích API/DTO hiện có; ghi rõ endpoint/contract mới trong tài liệu bàn giao
để frontend tích hợp ở task riêng.

## 3. Quy tắc, bất biến và edge cases

**Giữ nguyên các quyết định đã có:**

- Ownership qua booking, không qua email hoặc user ID do client gửi. Guest chưa claim
  booking không tự xuất hiện trong My Storage. Không tự bổ sung claim/OTP.
- CHECKED_IN có rental không được dùng endpoint hủy booking trước nhận kho để trả kho.
  Một booking chỉ có một rental; snapshot giá booking và chứng từ lịch sử được bảo toàn.
- Backend kiểm tra quyền và trạng thái ở mỗi lần ghi; action flags chỉ hỗ trợ UI.
  Request ID, payment ID và contract ID đều phải thuộc đúng rental/phạm vi được phép.
- Các cập nhật nhất quán phải atomic: rental, trạng thái ô kho, assignment, capacity,
  tài chính và audit liên quan. Không giải phóng ô kho chỉ vì khách gửi yêu cầu.
- Dùng transition rõ ràng, row lock/version và idempotency cho thao tác quan trọng.
  Retry không thu/hoàn tiền hoặc hoàn tất yêu cầu hai lần; không giữ transaction khi gọi provider.
  Thông báo chỉ gửi sau commit theo mức bảo đảm được chốt.

**Quyết định đã chốt trong hội thoại, thay thế mô tả cũ nếu khác nhau:**

- Rental status: ACTIVE, RETURN_PENDING, OVERDUE, CLOSED. Default My Storage gồm
  ACTIVE, RETURN_PENDING **và OVERDUE** (quyết định mới nhất), nearest-expiry first,
  phân trang ổn định; CLOSED thuộc history. Chỉ có rental sau handover.
- Return-request có status riêng. Overdue bắt đầu 00:00 ngày sau ngày hết hạn theo
  timezone cơ sở; không tự đóng rental hoặc xóa workflow trả kho.
- Dùng lại `check_in_slots` (start/end time có sẵn) cho return appointment, không tự
  tạo bộ duration riêng. System Administrator quản lý cấu hình lịch/slot. Slot phải
  nằm trong operating hours, không rơi vào holiday; thiếu cấu hình phải từ chối.
  Notice ít nhất 24 giờ; edit PENDING phải validate lại notice và slot.
  Slot **90 phút**, không chia nhỏ trong MVP; capacity **1 cuộc hẹn/slot**,
  buffer **15 phút sau slot**, slot kế tiếp chỉ mở khi đủ buffer.
  Chỉ CONFIRMED/INSPECTING/FAILED giữ slot; PENDING không giữ capacity.
  Hai PENDING cùng chọn slot: FS nào confirm thành công trước giữ chỗ;
  xác nhận còn lại bị conflict và cần khách sửa khi vẫn PENDING. Seed hiện có slot
  liền nhau; không tự dời giờ seed, phải kiểm tra khoảng đệm khi công bố/nhận lịch.
  Khi Admin đổi lịch,
  giữ appointment đã xác nhận và snapshot giờ hẹn, đánh dấu cần xử lý thủ công;
  không tự đổi giờ hoặc hủy.
- Return inspection có checklist riêng. Có hư hỏng, tài sản còn lại hoặc vấn đề cần
  xử lý thì bắt buộc ảnh bằng chứng; tối đa **5 ảnh tổng cộng mỗi inspection**.
  Tài sản còn lại không tự động FAIL; phải ghi nhận và xử lý theo quy trình được chốt.
  Checklist trả kho gồm tài sản còn lại, tình trạng unit, vệ sinh/an toàn và bằng chứng;
  Lỗi nghiêm trọng → FAIL; lỗi nhẹ → PASS kèm ghi nhận. Admin được cấu hình checklist
  item và đánh dấu item nghiêm trọng; không hard-code danh mục lỗi chưa được xác nhận.
  Snapshot definition/severity theo phiên bản khi tạo inspection để chỉnh cấu hình
  không làm thay đổi lịch sử. Phạm vi cấu hình chỉ RETURN trong MVP;
  giữ chính sách check-in 4 PASS hiện có.
  Tài sản còn lại phải xử lý xong hoặc bàn giao bộ phận lưu giữ trước khi đóng rental.
  FS được phân công xác nhận bàn giao, lưu người nhận/thời gian/bằng chứng.
  Sau FAILED tạo inspection mới; không ghi đè inspection cũ.
  FS làm inspection/evidence; FM duyệt phí hư hỏng và ngoại lệ trong quyền được cấp.
- Chỉ đóng rental sau physical return, inspection hoàn tất và nghĩa vụ tài chính
  được xác định. AVAILABLE chỉ khi điều kiện trả kho/đóng rental nhất quán; inspection
  FAIL thì MAINTENANCE. Closure không phải chờ refund hoàn tất.
- Contract gắn booking trước handover; PDF private, hợp lệ/readable/unencrypted,
  tối đa 20 MB. FM upload, không đồng nghĩa issue hoặc signed. Chỉ handover khi có
  contract ISSUED hợp lệ. Giữ phiên bản, không e-signature trong MVP.
  FM issue thủ công sau payment success và đủ dữ liệu; handover dùng bản ISSUED hiện
  hành. PDF lưu private S3-compatible bucket, truy cập qua backend xác thực hoặc URL
  ngắn hạn. Snapshot/link đúng phiên bản được dùng khi handover để giữ audit.
  Dữ liệu bắt buộc để FM issue: họ tên/email/số điện thoại trên booking (không thêm
  CCCD/hộ chiếu hoặc schema định danh trong MVP), facility, unit type,
  giá thuê, cọc, thời hạn thuê và booking liên quan; backend validate payment success
  cùng các dữ liệu này trước issue.
- Overdue fee duy nhất mỗi rental, default rate seed 25%, BOM cấu hình 0–100% có audit.
  Rate là phần trăm **số nguyên**, rounding **half-up** đến VND nguyên; eligibility phí
  theo thời điểm trả thực tế, không theo thời điểm đóng hồ sơ. Snapshot deposit/rate/fee
  lúc assessment, tự khấu trừ cọc atomic,
  idempotent. Tách rent/deposit/fees/refunds; không dùng floating-point money.
  Nghĩa vụ được duyệt vượt cọc tạo customer debt; refund không âm, không tự coi cọc là revenue.
  Customer debt chỉ ghi sổ, không tự thu. FM duyệt ngoại lệ hoàn unused rent theo từng
  trường hợp. Lưu actual_return_at, người nhập/sửa, thời điểm cập nhật, lý do. Nhập muộn
  vẫn tính theo thời điểm trả đã xác nhận. Nếu sửa sau assessment: audit và adjustment
  fee/deposit/refund tương ứng; giữ snapshot/assessment gốc, không ghi đè lịch sử.
  Refund: dùng API tạo/tra cứu nếu provider tích hợp hỗ trợ; nếu chưa có thì thủ công,
  bắt buộc actor/reference/evidence, không coi submit là đã hoàn tiền thành công.
- Customer chỉ edit/cancel request PENDING; chống duplicate open request cùng loại
  dưới concurrency. FS/FM theo facility. Không cấp BOM/Admin quyền tài chính/vận hành
  toàn cục mặc định; FM xác nhận settlement/initiate refund trong quyền được cấp.
  Return transitions: PENDING → CONFIRMED → INSPECTING → COMPLETED;
  nhánh INSPECTING → FAILED, inspection mới sau FAILED. Chỉ FS được phân công thao tác;
  FM đổi FS, duyệt phí và ngoại lệ. Edit/cancel của khách chỉ khi PENDING.
- Email MVP: payment, booking, upcoming expiry, overdue, return scheduling,
  inspection/fees, refunds. Event/outbox durable, retry/dedupe; delivery lỗi không
  rollback business transaction. Không hứa exactly-once delivery.
  Khách nhận sự kiện liên quan booking/rental; FM nhận công việc của cơ sở có quyền.
  Upcoming-expiry reminder trước **7 ngày**, lúc **09:00 theo timezone cơ sở**;
  Admin được cấu hình giờ gửi. Rental tạo khi còn dưới 7 ngày gửi ngay sau khi tạo;
  dùng cùng logical-event dedupe để scheduler/retry không tạo thông báo trùng.
  Email giao dịch ưu tiên contact lưu trên booking/rental, không bắt buộc có account.
- Abandoned property: FS lưu thông tin tài sản, bằng chứng và lịch sử liên hệ;
  FM giám sát/quyết định bước tiếp theo. MVP chỉ flag/chuyển xử lý thủ công, không
  tự thanh lý/vứt bỏ. Trước production bắt buộc legal review về final notice,
  thời hạn lưu giữ, phí và quyền xử lý tài sản; không tự hiện thực quy trình chưa chốt.
- Upgrade và renewal hoàn toàn ngoài MVP: không API/schema/jobs/quote/capacity-hold.
  Quy tắc tương lai trong hội thoại chỉ lưu làm yêu cầu deferred.

**Các đề xuất đã được người dùng đồng ý để implementation:**

- FAILED → INSPECTING chỉ khi tạo inspection attempt mới, giữ lịch sử cũ.
- FM phân công/đổi FS; chỉ FS đang được phân công đề xuất sửa giờ trả, kèm lý do/
  bằng chứng. FM cơ sở duyệt. Sau settlement/refund thì append financial revision,
  giữ rate/deposit gốc và lịch sử refund, không ghi đè hoặc tự thu nợ.
- SLA refund: ba ngày làm việc tiếp theo kể từ FM duyệt settlement, bỏ cuối tuần
  và ngày nghỉ cấu hình của cơ sở; snapshot lịch khi duyệt.
- Checklist cấu hình chỉ RETURN; không đổi check-in.
- PENDING không reserve; confirm phải kiểm tra capacity/buffer trong transaction.

**Context còn cần cho các nhánh chưa triển khai:**

| Chủ đề | Phần còn lại |
| --- | --- |
| Contract | Đã chốt thông tin khách là contactName/contactEmail/contactPhone; không CCCD/hộ chiếu. Upload/issue/version/access/handover gate đã implement. Chỉ cấu hình và kiểm chứng bucket S3 thật còn cần môi trường; revoke/chữ ký/gia hạn/chuyển kho ngoài implementation này |
| Refund provider | Adapter hiện tại chưa có create/status refund; cần xác minh merchant/account/auth cho SePay API khác trước bật tự động. MVP đang dùng xác nhận transfer thủ công có reference/evidence |
| Thông báo | Cần xác định vận hành delivery-unknown sau cửa sổ idempotency provider khi xây durable dispatcher; không hứa exactly-once |
| Abandoned/legal | Final notice/lawful handling và legal review trước production; chỉ làm flag/manual review, không tự xử lý tài sản |

Ca biên bắt buộc đưa vào test sau khi chốt kết quả mong đợi: người khác/cơ sở khác,
rental closed/overdue, thiếu hợp đồng, legacy payment không gắn booking, hai người
xử lý cùng yêu cầu, double submit, callback lặp/đến trễ, đổi giá sau báo giá, mất capacity,
ngày cuối tháng/năm nhuận/múi giờ, lỗi provider, rollback và request dùng version cũ.

## 4. Task nhỏ và phụ thuộc

Mỗi task backend gồm contract → integration test thất bại đúng lý do → repository/service/route
→ test thành công. Chỉ thêm unit test cho policy nhiều nhánh. Các endpoint dưới đây là đề xuất
để chốt ở T0; không phải endpoint đã có hoặc quyết định nghiệp vụ mặc định.

| ID | Công việc độc lập | Phụ thuộc | Kết quả kiểm chứng |
| --- | --- | --- | --- |
| T0 | Chốt bảng TBD, rà issue liên quan; thống nhất actor, input/output, status/error và ma trận test cho từng nhánh | — | Quy tắc được xác nhận; các nhánh chưa chốt giữ TBD và chưa triển khai |
| T1 | GET mine/detail/history: default ACTIVE/RETURN_PENDING/OVERDUE, expiry sort/phân trang ổn định, action eligibility; giữ tương thích DTO cũ | T0 phần đọc | Đúng danh sách/quyền, không trùng rental, không lộ dữ liệu nội bộ |
| T2 | `GET /api/rentals/:rentalId/payments` qua booking hiện có; DTO lịch sử tối thiểu, không gọi provider cho từng dòng | T0 phần lịch sử | Đọc đúng payment/refund, rỗng hợp lệ, không trả token/hash |
| T3 | Thiết kế persistence tối thiểu cho request, audit/version và liên kết kỳ thuê/tài chính theo policy; cập nhật diagram + schema, generate migration | T0 phần lifecycle | Migration áp dụng DB container local; constraint/relation có integration test |
| T4a | Chốt nguồn phát hành; thêm persistence contract/version và cách lưu private document; diagram/schema nếu cần | T0 phần hợp đồng | Có tài liệu thật từ nguồn được chốt, giữ được phiên bản lịch sử |
| T4b | API xem metadata/tải contract thuộc rental; mở rộng adapter storage hiện có chỉ nếu phù hợp định dạng/quyền | T4a | Owner xem/tải được; outsider bị chặn; missing document có trạng thái rõ |
| T5 | API return request theo loại đã chốt; reuse check-in slots, schedule/holiday do Admin quản lý, validate notice/edit/cancel và duplicate | T3, T0 lịch/request | Đúng giờ/lịch/24h, edit/cancel chỉ PENDING; chưa tự giải phóng unit |
| T6 | Danh sách/chi tiết xử lý theo facility và các action duyệt/từ chối đã chốt; route đặt dưới rental-requests | T5 | Đúng role/scope/version, lịch sử quyết định; chưa giả lập completed |
| T7 | Overdue lifecycle, rate config/audit, fee snapshot/khấu trừ một lần; settlement/refund/debt độc lập | T3, T0 tài chính/timezone | Retry không thu hai lần; refund không âm, nghĩa vụ/cọc được ghi đúng, snapshot gốc không đổi. Đã có overdue/manual-review sweep; báo cáo tổng hợp còn lại |
| T8a | Hoàn tất RETURN: kiểm tra điều kiện/kiểm kê, ghi ngày trả/đóng, xử lý cọc và giải phóng inventory đúng policy | T6, T7 | Transaction rollback đầy đủ; không trả kho/hoàn cọc hai lần |
| T9 | Durable outbox cùng business transaction, dispatch email/in-app theo worker hiện có và policy đã chốt | T6, T7, T8a; T0 recipient/trigger | Đã triển khai email/in-app, retry/dedupe và local expiry reminder; verify worker/provider ở deployment |
| T10 | Bàn giao tài liệu API: method/path, quyền, input/output, status/error, transition và ví dụ; kiểm tra tương thích consumer bằng đọc code | Các endpoint đã hoàn tất | Tài liệu khớp API thật; nêu việc frontend cần tích hợp riêng, không sửa API client/UI |
| T11 | Regression backend liên flow qua app.inject trên PostgreSQL local: owner tạo → operator xử lý → owner đọc kết quả; chuẩn bị fixture local trước suite liên quan | Các nhánh đã hoàn tất; chuẩn bị fixture trước test từng nhánh | Đạt tiêu chí mục 5; không có thay đổi frontend/API client, không tính suite skipped là pass |

T1/T2 có thể giao trước phần mutation. T4a–b độc lập với request sau khi policy hợp đồng
được chốt. T8a chỉ RETURN; không tạo task implementation RENEWAL/UPGRADE trong MVP.
Chỉ trả action eligibility cho nhánh đã hoàn thành toàn bộ backend liên quan.

## 5. Acceptance criteria và lệnh xác minh

- Customer xem đủ dữ liệu của mình; anonymous 401, sai role 403, rental không tồn tại/
  không thuộc owner 404; input sai 400, stale/transition conflict 409 theo contract đã chốt.
- Default list gồm ACTIVE/RETURN_PENDING/OVERDUE, không gồm CLOSED hoặc booking chưa
  handover. Return slot reuse check-in slots, Admin-only configuration, validate lại
  24h khi sửa PENDING. Issue bắt buộc evidence; ảnh thứ 6 bị từ chối. Remaining property
  không tự FAIL; không tự đóng rental hoặc release unit khi chưa đủ điều kiện.
- Capacity slot 1 dưới concurrency; đổi lịch giữ appointment confirmed và đánh dấu
  manual review. Chỉ FS được giao thực hiện. Tài sản chưa xử lý/chưa bàn giao lưu giữ
  chặn closure. Half-up/rate nguyên và actual-return timestamp quyết định phí; đóng
  hồ sơ trễ không tự tạo phí. Customer debt không kích hoạt thu tiền tự động.
- Mỗi nhánh được kiểm tra happy path, từ chối đúng quyền/trạng thái và không có side effect
  khi thất bại; concurrency kiểm tra bằng PostgreSQL thật, không mock transaction.
- Payment lịch sử, tài liệu và audit được lưu và đọc lại đúng qua API; backend không tin
  trạng thái paid do client gửi.
  Tiền/occupancy/thời hạn/contract nhất quán khi hoàn tất hoặc rollback.
- Checkout, handover, cancellation trước nhận kho và báo cáo cũ vẫn đúng. Kiểm tra API
  validation, phân quyền, double submit/retry, tải tài liệu và đọc kết quả sau xử lý.
- Chỉ thay đổi file backend, database, shared contracts phục vụ API và tài liệu/test
  liên quan. Không dùng test UI/mock làm bằng chứng đã hoàn thiện backend.

Chạy từ repo root **khi triển khai**, không chạy test/migration trong task lập kế hoạch.
Theo xác nhận của người dùng: dùng database và Redis đang chạy trong container local,
không tạo database hoặc Redis riêng. Lấy URL/port thực tế từ cấu hình container local.
Fixture dùng UUID/prefix riêng từng lượt chạy, chỉ cleanup bản ghi/key/job do lượt đó
tạo; không truncate bảng, reset seed, FLUSHDB hoặc FLUSHALL. Giữ dữ liệu local có sẵn.

Trước khi chạy regression backend, bổ sung bước chuẩn bị test trong T11 (và trước test của
từng task): sửa guard tên DB riêng trong `inspection-fixture.ts`
thành kiểm tra URL khớp container local được cấu hình; sửa `reports-postgres.test.ts`
để scope fixture theo facility/ID thay vì yêu cầu DB trống. Assertion aggregate toàn
cục phải so với baseline hoặc tập fixture xác định, không giả định toàn DB chỉ có test.
Rà cleanup của từng suite, cô lập queue/job theo lượt chạy và chặn cron/worker test xử lý
dữ liệu ngoài fixture. Không chỉ bỏ guard rồi chạy suite cũ trên dữ liệu local.
Test mới bên dưới là tên file dự kiến, được tạo tại task tương ứng.

```bash
export DATABASE_URL="${MY_STORAGE_LOCAL_DATABASE_URL:?Set existing local container DB URL}"
export BOOKING_TEST_DATABASE_URL="$DATABASE_URL"
export REPORTS_TEST_DATABASE_URL="$DATABASE_URL"
export REDIS_URL="${MY_STORAGE_LOCAL_REDIS_URL:?Set existing local container Redis URL}"
export RUN_INSPECTION_DB_TESTS=1
export NODE_ENV=test LOG_LEVEL=silent PAYMENT_PROVIDER=mock

# T3/T4a/T7: chỉ khi schema thực sự thay đổi; không sửa generated migration.
bun run db:generate
bun run --filter @metastorage/database db:migrate

# Suite mới; mỗi file chạy process riêng để tránh pool bị đóng giữa suite.
bun test --preload ./apps/api/tests/setup.ts apps/api/tests/integration/rentals-read.test.ts
bun test --preload ./apps/api/tests/setup.ts apps/api/tests/integration/rental-contracts.test.ts
bun test --preload ./apps/api/tests/setup.ts apps/api/tests/integration/rental-requests.test.ts
bun test --preload ./apps/api/tests/setup.ts apps/api/tests/integration/rental-payments.test.ts
bun test --preload ./apps/api/tests/setup.ts apps/api/tests/integration/rental-return.test.ts

# Regression sau khi điều chỉnh fixture/guard/scope như trên.
bun test --preload ./apps/api/tests/setup.ts apps/api/tests/integration/booking-identity.test.ts
bun test --preload ./apps/api/tests/setup.ts apps/api/tests/integration/booking-payment-start.test.ts
bun test --preload ./apps/api/tests/setup.ts apps/api/tests/integration/handover.integration.test.ts
bun test --preload ./apps/api/tests/setup.ts apps/api/tests/integration/reports-postgres.test.ts

bun run --filter api check-types
bun run --filter @metastorage/contracts check-types
bun run --filter @metastorage/database check-types
bun run --filter api lint
bun run --filter @metastorage/contracts lint
bun run --filter @metastorage/database lint
git diff --check
git diff --name-only
node .gitnexus/run.cjs detect-changes --scope all --repo metastorage
```

Không chấp nhận graph partial/truncated là clean; tăng giới hạn/phạm vi rồi kiểm tra lại.
Trước sửa từng symbol chạy `node .gitnexus/run.cjs impact SYMBOL --direction upstream --repo metastorage`;
UNKNOWN cần xác minh thêm bằng text search, HIGH/CRITICAL phải báo trước sửa.

T11 kiểm chứng chuỗi owner → operator → kết quả trong các suite integration backend
của từng nhánh nêu trên, dùng session xác thực và PostgreSQL local thật. Mock provider
ở ranh giới adapter/HTTP trong fixture backend; không mock DB, không gọi SePay hoặc gửi
mail thật. Không tạo Playwright spec, sửa server fixture phục vụ frontend E2E hoặc chạy
Web/Expo trong phạm vi này. Kết quả bàn giao xác nhận API/database; kiểm chứng UI thuộc
task tích hợp frontend riêng.

## 6. Rủi ro và non-goals

- HIGH: mở rộng tài chính có thể làm sai báo cáo/đối soát hoặc xác nhận lại booking.
  T7 bắt buộc kiểm thử tương thích cùng request-specific payment và báo cáo.
- Renewal/upgrade phải đồng bộ calendar capacity và trạng thái vật lý; chỉ cập nhật
  `rentals.expectedEndAt` hoặc `physicalUnitId` là chưa đủ. Đặc biệt DTO hiện lấy unitType
  từ booking gốc, dễ trả sai sau nâng cấp.
- Diagram có ghi chú lịch sử mâu thuẫn với quyết định pricing mới ở đầu file; T0 đối
  chiếu policy/code/issue, không áp dụng mặc định “cọc một tháng” cho nghiệp vụ mới.
- Consumer Web/Mobile có thể chưa dùng endpoint mới; triển khai backend không đồng nghĩa
  flow UI đã hoạt động. Ghi rõ yêu cầu tích hợp riêng trong T10.
- Chưa có nguồn contract và bảo đảm notification; không thêm dependency/storage/outbox
  trước khi chốt yêu cầu. Không tuyên bố notification bền vững từ WebSocket hiện tại.

Non-goals: thiết kế lại checkout/check-in, claim guest/OTP, chữ ký số/nhà cung cấp ký
điện tử (trừ khi được chốt thành scope mới), IoT/PIN/NFC, tự động gia hạn định kỳ,
generic approval engine, kiến trúc mới, refactor toàn repo, mọi thay đổi Web/Mobile/UI,
API client, frontend mocks và test UI; deploy, migration DB ngoài container local đã xác
định, commit/push. Chỉ điều chỉnh truy vấn/nghiệp vụ báo cáo backend liên quan để giữ
tính đúng; không xây dashboard hoặc hệ thống kế toán mới.
