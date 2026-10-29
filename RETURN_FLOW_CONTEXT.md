# Context triển khai luồng trả kho

Cập nhật: 2026-10-29.

Trạng thái: thiết kế đã thống nhất trong hội thoại, chưa triển khai. File này lưu
context cho lượt implement tiếp theo; việc tạo file không đồng nghĩa schema,
migration, endpoint hoặc UI đã được thay đổi.

## 1. Phạm vi và các quyết định đã chốt

- Customer yêu cầu trả kho bằng appointment loại `CHECK_OUT` (giá trị enum thực tế).
- FM xác nhận lịch và chọn Staff; backend tự tạo task cho appointment.
- Staff bắt đầu task và thực hiện inspection `CHECK_OUT` trên Unit đang thuê.
- Checklist dùng lại các mục của check-in, nhưng ghi kết quả kiểm tra mới.
- BOM cấu hình danh mục vi phạm và mức phí cố định bằng VND trong JSONB của
  `system_settings`, key đề xuất `RETURN_PENALTIES`.
- Khoản phí thực tế áp dụng cho khách được lưu riêng, không phụ thuộc mức phí cấu
  hình về sau. **Tên bảng mới đã được người dùng chốt: `policy_violation_fee`.**
- Bảng `policy_violation_fee` cần dùng được cho nhiều ngữ cảnh phạt, không thiết kế
  thành bảng chỉ dành riêng cho inspection trả kho.
- Khi Staff chốt trả kho: lưu inspection/phí, đóng rental, cập nhật Unit, tạo giao
  dịch hoàn cọc và hoàn tất appointment/task trong cùng transaction.
- Tái sử dụng các endpoint hiện có; chưa cần thêm endpoint cho từng bước đóng
  rental, trả Unit, hoàn tất task hoặc tạo refund độc lập.
- Lượt hiện tại chỉ tạo tài liệu context, không implement nghiệp vụ.

## 2. Hiện trạng đã đọc từ code

| Phần | Hiện trạng |
| --- | --- |
| Customer đặt lịch | `POST /api/appointments` đã hỗ trợ `CHECK_OUT` + `rentalId`; kiểm tra chủ rental và rental `ACTIVE` |
| FM xem yêu cầu | `GET /api/appointments/facilities/:facilityId?appointmentType=CHECK_OUT` đã có |
| FM xác nhận/gán Staff | `PATCH /api/appointments/:id` đã nhận `status: CONFIRMED` và `assignedStaffId` |
| Task tự động | CHECK_OUT tạo task `UNIT_INSPECTION`, `referenceType: APPOINTMENT`, `referenceId: appointment.id` |
| Staff xem/bắt đầu task | `GET /api/facility-tasks/my` và `PATCH /api/facility-tasks/:id` với `IN_PROGRESS` đã có |
| Tạo inspection | Nhánh appointment của `POST /api/inspections` hiện chỉ nhận CHECK_IN, chưa chạy được CHECK_OUT |
| Schema inspection | Đã có loại `CHECK_OUT`, `rentalId`, checklist, condition, notes và evidence |
| Validation checklist | Validator hoàn tất check-in hiện yêu cầu các mục bắt buộc PASS; chưa phù hợp CHECK_OUT có vi phạm |
| Rental | Hiện chỉ có `ACTIVE`/`CLOSED`, chưa có nghiệp vụ chốt trả kho |
| Payment | Chưa có `type` phân biệt giao dịch hoàn cọc; refund hiện là thông tin trên payment thu ban đầu |
| Xác nhận refund | `POST /api/payments/:paymentId/refund/confirm` đã có, dành cho SYSTEM_ADMIN/BUSINESS_OPERATION_MANAGER |
| Cấu hình BOM | Có `system_settings` JSONB, version và bảng lịch sử; hiện chỉ hỗ trợ scalar, code chủ yếu xử lý số |

Nguồn đọc chính:

- `apps/api/src/modules/appointments/appointments.service.ts`
- `apps/api/src/modules/facility-tasks/facility-tasks.service.ts`
- `apps/api/src/modules/inspections/inspections.service.ts`
- `apps/api/src/modules/payments/payments.routes.ts`
- `apps/api/src/modules/payments/payments.repository.ts`
- `apps/api/src/modules/rentals/rentals.service.ts`
- `apps/api/src/modules/system-settings/`
- `packages/database/src/schema/{rentals,inspections,payments,system-settings}.ts`
- `packages/contracts/src/{appointments,inspections,handover-checklist,system-settings}.ts`
- `docs/db-diagram.md`

`docs/returns-api.md` mô tả phiên bản cũ, không phải bằng chứng các API đó còn hoạt
động. `docs/db-diagram.md` ghi nhận phần quyết toán/hoàn tiền rental đã được gỡ để
xây lại. Khi implement phải đối chiếu code hiện tại và route đăng ký trong `app.ts`.

## 3. Luồng nghiệp vụ mục tiêu

### Customer đặt lịch

`POST /api/appointments` với `appointmentType: CHECK_OUT`, `rentalId`,
`scheduledDate`, `slotId`. Customer/facility lấy từ session và rental.

Appointment ở `SCHEDULED`; rental vẫn `ACTIVE`, Unit vẫn `OCCUPIED`.
Giữ kiểm tra chủ rental, giờ hoạt động, slot và một appointment đang mở cho context.

### FM xác nhận và phân công

`PATCH /api/appointments/:id` với `status: CONFIRMED` và `assignedStaffId`.
Giữ workflow tự tạo task `UNIT_INSPECTION` ở `ASSIGNED` trong transaction.
Không yêu cầu FM tạo task thêm bằng API task chung.

### Staff bắt đầu inspection

1. `PATCH /api/facility-tasks/:id` chuyển sang `IN_PROGRESS`.
2. `POST /api/inspections` với `taskId`.
3. Backend suy ra `task.referenceId -> appointment.rentalId -> rental.storageUnitId`.
4. Kiểm tra Staff được giao, phân công cơ sở còn hiệu lực, appointment CONFIRMED,
   đúng lịch và rental ACTIVE. Không lấy Unit từ assignment check-in để thay thế
   Unit thực tế đang nằm trong rental.
5. Tạo inspection CHECK_OUT gắn rental và task; gọi lại không tạo bản ghi trùng.

`GET /api/inspections/:id` cần cung cấp context trả kho: thông tin rental/Unit,
tiền cọc thực thu, danh mục phí được phép chọn, phí đã ghi và inspection check-in
ban đầu để đối chiếu. Việc đọc check-in phải được cấp quyền qua rental/task hiện
tại, kể cả khi Staff nhận kho ban đầu là người khác.

### Staff ghi nhận kết quả và phí

- Dùng `PATCH /api/inspections/:id` để lưu checklist, ảnh, ghi chú và vi phạm.
- Dùng lại định nghĩa các mục check-in, không sao chép kết quả PASS cũ sang CHECK_OUT.
- CHECK_OUT phải ghi đầy đủ các mục nhưng cho phép mục FAIL có giải thích.
- Một mục FAIL có phí không tự đồng nghĩa quy trình nhận lại kho thất bại.
- Với các trạng thái hiện có, đề xuất dùng PASSED cho việc chấp nhận hoàn tất nhận
  lại kho; phải tách validation theo inspectionType, giữ quy tắc CHECK_IN hiện có.
- Frontend gửi code vi phạm; backend lấy mức tiền cấu hình và lưu snapshot.
- Tổng tiền phạt và tiền hoàn do backend tính, không tin số tiền do frontend gửi.

### Staff chốt trả kho

Mở rộng thao tác hoàn tất trong `PATCH /api/inspections/:id`. Service điều phối
trong một transaction, với khóa các bản ghi liên quan:

1. Kiểm tra quyền, trạng thái task/appointment/rental, checklist và các khoản phí.
2. Chốt inspection và phí; không cho sửa sau khi chốt.
3. Đóng rental sang CLOSED và ghi thời điểm trả thực tế.
4. Chuyển Unit sang AVAILABLE nếu đủ điều kiện cho thuê tiếp.
5. Tạo payment hoàn cọc REFUND_PENDING nếu số tiền hoàn lớn hơn 0.
6. Hoàn tất appointment và task sang COMPLETED.

Phải rollback toàn bộ nếu một bước thất bại. Replay trả kết quả đã có; không tạo
hai refund, không đóng nhầm rental khác hoặc giải phóng Unit đang thuộc workflow khác.

### Xác nhận đã hoàn tiền

- Hoàn tất inspection tạo nghĩa vụ hoàn tiền, không chứng minh đã chuyển tiền.
- Dùng lại `/api/payments/:paymentId/refund/confirm` sau khi thực sự chuyển tiền,
  ghi reference, refundedAt và refundedBy; trạng thái thành REFUNDED.
- Lịch sử Customer/FM hiển thị Chờ hoàn cọc hoặc Đã hoàn cọc tương ứng.
- Giữ quyền SYSTEM_ADMIN/BUSINESS_OPERATION_MANAGER hiện có cho đến khi có quyết
  định rõ ràng cấp thêm quyền xác nhận tiền cho Staff.

### Bảng mới: policy_violation_fee

Đây là bảng khoản phí thực tế, không phải danh mục cấu hình. Tên vật lý giữ đúng
`policy_violation_fee` theo yêu cầu người dùng.

Cấu trúc đề xuất để dùng nhiều ngữ cảnh:

| Field | Ý nghĩa |
| --- | --- |
| id | UUID PK |
| referenceType | Loại đối tượng chịu phí; lượt đầu chỉ cần hỗ trợ INSPECTION |
| referenceId | ID đối tượng; với luồng này là inspections.id |
| violationCode | Code vi phạm |
| violationName | Snapshot tên khi áp dụng |
| amount | Snapshot số tiền VND khi áp dụng |
| policyVersion | Phiên bản danh mục nguồn |
| note | Giải thích bổ sung nếu có |

Đề xuất unique `(referenceType, referenceId, violationCode)` để chặn áp trùng cùng
vi phạm. Chưa thêm enum/handler cho các workflow tương lai chưa xác nhận.
Nếu các danh mục sau này có version riêng, phải bổ sung định danh chính sách nguồn
trước khi dùng bảng cho context đó; policyVersion một mình không định danh mọi danh mục.

Lưu ý thiết kế: cặp referenceType/referenceId không có foreign key đa bảng thông
thường. Service phải kiểm tra đối tượng tồn tại, scope và trạng thái trong transaction;
không mở API tạo phí tùy ý từ client. Với INSPECTION, người chốt và thời gian được
truy ra từ inspection. Khi thêm context mới phải xác định rõ audit/quyền cho context đó.

### Các bảng hiện có

- `rentals`: thêm closedAt; giữ endAt là hạn thuê, không ghi đè thành giờ trả thực tế.
- `inspections`: dùng lại CHECK_OUT, rentalId, checklist/condition/evidence; mở rộng
  contract để nhận các lựa chọn vi phạm. Không giấu phí thực tế trong checklist JSON.
- `payments`: thêm type phân biệt khoản thu và DEPOSIT_REFUND, liên kết rental và
  sourcePaymentId tới khoản thu gốc; tạo bản ghi chi riêng, giữ nguyên sự kiện thu.
- Giữ REFUND_PENDING/REFUNDED và các trường xác nhận hiện có nếu phù hợp. Chốt rõ
  mapping totalAmount/refundAmount cho bản ghi chi và DTO trước khi viết migration.
- Các trường checkout/gateway hiện NOT NULL cần có quy tắc phù hợp giao dịch chi;
  không điền hold token/provider transaction giả.
- Ràng buộc chống refund trùng theo lần trả kho; khóa nguồn tiền khi tính số tiền
  được hoàn, không hoàn vượt cọc thực thu còn lại.
- Không cần bảng return_request, bảng task CHECK_OUT riêng hoặc bảng danh mục phí mới.

## 5. Endpoint và các thành phần cần cập nhật

Không bắt buộc thêm URL mới cho happy case; mở rộng những endpoint sau:

| Endpoint | Thay đổi |
| --- | --- |
| POST /api/inspections | Nhánh CHECK_OUT từ task/appointment/rental |
| GET /api/inspections/:id | Context rental, check-in gốc, lựa chọn phí, phí đã ghi và số tiền dự kiến hoàn |
| PATCH /api/inspections/:id | Lưu vi phạm và chốt trả kho trong transaction |
| POST /api/payments/:paymentId/refund | Hỗ trợ bản ghi hoàn cọc riêng, giữ quyền và idempotency |
| API lịch sử payment của rental | Phân biệt khoản thu, hoàn cọc, trạng thái và số tiền |

Phạm vi code triển khai:

- API: appointments, facility-tasks, inspections, rentals, payments, storage-units,
  và reports ở các điểm liên quan.
- Database: schema, exports, migration sinh bằng `bun run db:generate`, database diagram.
- Contracts/API client: schema input/output, context trả kho, phí, payment type, exports.
- Reports: khoản hoàn không được tính là tiền thu; chỉ tính tiền đã chi khi refund
  đã được xác nhận, giữ các giao dịch thu/hoàn trước đây đúng nghĩa.
- Các mocks/fixtures/callers bị ảnh hưởng phải cập nhật cùng hợp đồng mới.

## 6. Giới hạn và quyết định còn mở

- Happy case: tổng phí không vượt cọc và Unit đủ điều kiện cho thuê tiếp.
- Ví dụ: cọc thực thu 1.000.000, phí 100.000 -> hoàn 900.000 REFUND_PENDING;
  xác nhận chuyển tiền -> REFUNDED.
- Nếu tiền hoàn bằng 0: ghi nhận phí/kết quả, không tạo giao dịch chuyển tiền giả.
- Phí vượt cọc: chưa chốt thu thêm/công nợ; không âm thầm bỏ phần vượt cọc hoặc tạo
  debt workflow chưa được yêu cầu. Cần chốt trước khi hỗ trợ tình huống này.
- Unit còn hỏng/chưa sử dụng được: không tự đưa AVAILABLE; cần nhánh MAINTENANCE
  phù hợp trước khi hỗ trợ tình huống này.
- Quyền Staff xác nhận đã chuyển tiền chưa được duyệt; mặc định giữ Admin/BOM.
- Chưa có yêu cầu hoàn tiền thuê do trả sớm, phí tự động quá hạn, hoàn tiền tự động
  qua provider, quyết toán nhiều phiên bản hoặc chỉnh sửa sau khi đã chốt.

## 7. Kiểm chứng khi implement

- Luồng xuyên suốt Customer -> FM -> Staff -> xác nhận hoàn cọc, có/không có phí.
- CHECK_OUT lấy đúng Unit từ rental; không nhận Unit tùy ý từ frontend.
- Chặn sai chủ rental, sai cơ sở, Staff không được giao và task chưa bắt đầu.
- BOM đổi cấu hình không sửa mức phí đã ghi/chốt; chặn code không hợp lệ và giá client giả.
- Checklist CHECK_OUT có thể ghi vi phạm; validation CHECK_IN không bị nới lỏng.
- Chốt trả kho rollback đồng bộ khi lỗi; gọi lặp/đồng thời không tạo refund trùng.
- Chỉ refund được xác nhận mới hiển thị đã hoàn tiền; xác nhận lặp giữ idempotency.
- Rental/Unit/appointment/task và lịch sử payment/report nhất quán sau hoàn tất.
- Migration giữ nguyên dữ liệu và luồng thu/hoàn cũ; không sửa migration sinh sẵn.

Chạy kiểm tra liên quan phù hợp phạm vi thay đổi khi implement. Tài liệu này không
ghi nhận bất kỳ kiểm thử API/DB hay triển khai code nào đã hoàn tất.
