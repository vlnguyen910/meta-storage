# Kế hoạch hoàn thiện Flow 2 — backend

Ngày: 2026-10-17. Trạng thái: triển khai backend theo các quyết định đã chốt; xem chi tiết và verification bên dưới.
Phạm vi: API, worker, contract backend dùng chung, database và test backend.
Không tạo task cho web/mobile/API client. Implementation chỉ thay đổi backend và contract liên quan.

## 1. Hiện trạng và nguyên nhân

- Các endpoint đọc booking, chọn kho/staff, phân công, lookup/confirm check-in,
  inspection CRUD/ảnh/complete và handover đã có; không cần dựng lại CRUD.
- `POST /api/bookings/:id/assign-unit` tạo lịch sử assignment trong transaction,
  kiểm tra cùng cơ sở/loại kho và xung đột thời gian; không cập nhật kho thành RESERVED.
  Assignment theo lịch và trạng thái vật lý là hai mô hình chưa được thống nhất trong mô tả flow.
- `POST /api/bookings/:id/assign-staff` lưu nhân viên và vô hiệu hóa verification khi đổi
  người; chưa có side effect gửi thông báo. Danh sách assigned-to-me đã hoạt động ở mức code.
- Email booking hiện được enqueue sau payment commit, chứa link tracking/check-in mang token;
  không gửi sau assignment và không nhúng ảnh QR. Có khoảng trống mất job nếu tiến trình
  dừng giữa DB commit và enqueue.
- Checklist có hai định nghĩa mâu thuẫn: tài liệu H6 yêu cầu 4 mục PASS, ảnh/ghi chú tùy chọn;
  code completion yêu cầu correctUnit + ghi chú + ảnh. Schema chỉ lưu mô hình thứ hai,
  dù cùng dùng tên H6_V1; validator checklist 4 mục chưa được nối vào inspection.
- Handover đã atomic/idempotent: tạo một rental ACTIVE/booking, booking CHECKED_IN,
  unit OCCUPIED, consume verification, lưu actor/time. Rental dùng kỳ hạn đã đăng ký.
- Đổi kho trực tiếp cùng loại/cơ sở đã có; yêu cầu đổi/từ chối của khách và xử lý tài chính
  chưa có chính sách. Không coi endpoint cancel hiện có là thay thế chính sách từ chối kho.

Đã đọc code và quyết định local liên quan #18, #23, #24, #25, #92, #113;
chưa kiểm tra nội dung issue hiện tại trên GitHub hoặc trạng thái migration DB đang chạy.
GitNexus MCP không có trong phiên, `.gitnexus/run.cjs` và index local không có;
không xác nhận được độ mới index, callers/processes/risk. Đây là giới hạn phân tích,
không phải kết luận blast radius thấp.

## 2. File và pattern tái sử dụng

| Khu vực | File/pattern |
| --- | --- |
| Phân công | `apps/api/src/modules/bookings/bookings.{routes,service,repository}.ts` |
| Check-in | `apps/api/src/modules/check-ins/check-ins.{routes,service,repository,policy}.ts` |
| Inspection/bàn giao | `apps/api/src/modules/inspections/inspections.{routes,service,repository,policy}.ts`, `handover.policy.ts` |
| Contract | `packages/contracts/src/bookings.ts`, `inspections.ts`, `handover-checklist.ts` |
| Database | `packages/database/src/schema/{bookings,unit-assignments,checkin-verifications,handover-inspections,rentals,storage-units}.ts`, `docs/db-diagram.md` |
| Mail | `apps/worker/src/mail/{mail.job,mail.service,resend.adapter}.ts`, `packages/shared/src/mail.ts`, `mail.types.ts` |
| Regression | `apps/api/tests/integration/{inspections.integration,handover.integration,booking-email-access}.test.ts`, `tests/fixtures/inspection-fixture.ts` |
| Chính sách | `docs/handover-checklist-policy.md`, `docs/booking-cancellation-policy.md`, `docs/booking-tracking.md` |

Giữ Route → Service → Repository, Drizzle query builder, row locks, version chống stale,
guard facility/assigned Staff, response/error helpers, BullMQ và mail adapter hiện có.
Messages đặt ở file feature-scoped; interface mới đặt trong `*.types.ts`.

## 3. Quy tắc, bất biến và quyết định cần chốt

Đã có: FM chuẩn bị/phân công; chỉ Staff được giao thực hiện verification/inspection/handover.
Booking CONFIRMED và payment SUCCEEDED mới đủ điều kiện check-in; kiểm tra thời gian theo
slot và deadline hiện có. Completed inspection bất biến; verification/assignment cũ không
được dùng bàn giao. Một booking chỉ có một rental; retry không sửa audit ban đầu.
Không kích hoạt rental khi chỉ confirm hoặc complete inspection.

Đã chốt theo yêu cầu người dùng:

1. **Checklist chuyển sang bộ 4 PASS và lưu kết quả**: ASSIGNED_UNIT, DOOR_LOCK,
   UNIT_CONDITION, EXISTING_INVENTORY. Draft được thiếu mục; complete yêu cầu đủ bốn
   kết quả PASS. Dùng validator hiện có; lưu kết quả từng mục vào inspection.
   Theo chính sách 4 PASS đã mô tả, ảnh/ghi chú/chữ ký là tùy chọn.
   Không xây checklist engine. Lưu results JSONB cùng version/snapshot định nghĩa trên inspection.
2. **Kho chuyển RESERVED ngay khi FM assign kho thành công cho khách đặt lịch**.
   Ghi assignment và đổi trạng thái kho trong cùng transaction; rollback cả hai nếu thất bại.
   Bàn giao thành công chuyển RESERVED → OCCUPIED. Enum hiện có, không thêm trạng thái mới.
3. **Thông báo nhiệm vụ cho Staff dùng notification qua WebSocket**, không dùng email staff.
   Backend phải xác thực kết nối và chỉ gửi sự kiện đến đúng người có quyền nhận;
   chỉ phát sự kiện sau khi transaction assignment commit thành công.
4. **Không gửi email cho customer khi FM assign kho thành công**.
   Loại bỏ task thêm mail sau assignment; email xác nhận sau thanh toán hiện tại giữ nguyên.
   Thay đổi ảnh QR hoặc độ tin cậy pipeline mail hiện tại nằm ngoài đợt này.

Chi tiết đã chốt bổ sung trước implementation:

- Checklist: request thêm `results` optional để draft cũ vẫn lưu được; complete bắt buộc
  đủ 4 PASS. Lưu results + definition snapshot và `checklistVersion = H6_4PASS_V1`.
  Ba cột nullable phân biệt hồ sơ cũ, không backfill hoặc tự gán PASS. Draft cũ chỉ nhận
  metadata mới khi Staff gửi results; completed cũ giữ lịch sử/điều kiện bàn giao đã có.
  Giữ các trường DTO cũ và bổ sung results/checklistVersion/checklistDefinition.
  Client cũ chưa gửi results không thể complete mới: đây là thay đổi nghiệp vụ đã được xác nhận.
- RESERVED: chỉ assign kho AVAILABLE hoặc chính kho booking đang giữ; chặn mọi booking
  khác, kể cả không overlap lịch. Đổi/hủy/no-show trả AVAILABLE nếu không còn assignment
  hợp lệ khác hoặc ACTIVE rental. Không ghi đè MAINTENANCE/OCCUPIED và các trạng thái khác.
  Retry cùng kho giữ nguyên assignment và verification.
- Notification: người dùng đã chọn realtime tối thiểu, phát khi assign/đổi Staff thành công;
  retry cùng Staff không phát lại. Chỉ phục vụ Staff online, một API instance; không lịch sử,
  replay, read/unread, persistence, outbox, Redis fan-out hoặc email sau assignment.
  Staff offline xem nhiệm vụ qua assigned-to-me. Endpoint mới `GET /api/notifications/ws`
  dùng WebSocket upgrade, auth session và trusted Origin; event `STAFF_TASK_ASSIGNED`
  có id/recipientId/bookingId/occurredAt. Kiểm tra lại session, account, facility và assignment
  trước gửi; lỗi phát sự kiện không rollback assignment đã commit.
  Thêm `@fastify/websocket` vì Fastify hiện chưa có transport WebSocket.
- Đổi/từ chối: giữ TBD, chưa triển khai yêu cầu/phê duyệt/hoàn tiền riêng trong đợt này.

Ca biên: staff ngoài cơ sở/không active, khách guest, request lặp, hai FM phân công đồng thời,
booking terminal, đổi assignment sau verification, version cũ, FAIL/thiếu/trùng checklist,
ảnh không hợp lệ, bàn giao đồng thời, deadline vừa hết, WebSocket mất kết nối/reconnect,
kết nối không xác thực, nhiều tab, event trùng và đổi người nhận trong lúc phát sự kiện,
booking tương lai không overlap, kho cũ còn assignment hợp lệ khác.

## 4. Task nhỏ và phụ thuộc

| ID | Công việc backend | Phụ thuộc | Kiểm chứng độc lập |
| --- | --- | --- | --- |
| T0 | Chốt các quyết định ở mục 3 và đối chiếu issue liên quan; khôi phục GitNexus, chạy impact từng symbol sẽ sửa, báo HIGH/CRITICAL/UNKNOWN và callers/processes | Không | Bảng quyết định không còn TBD cho nhánh được chọn; báo cáo impact có đủ dữ liệu |
| T1 | Cập nhật diagram + schema kết quả 4 PASS và metadata lịch sử đã chốt và generate migration; giữ lịch sử đúng policy | T0 | Migration chạy trên DB test; round-trip dữ liệu và hồ sơ cũ |
| T2 | Mở rộng contract/save/detail lưu kết quả 4 PASS; dùng validator 4 mục trong complete theo rollout đã chốt | T1 | Integration draft thiếu mục được lưu; complete thiếu/FAIL bị từ chối; đủ PASS được khóa; stale/unauthorized không ghi |
| T3 | Chuyển kho RESERVED khi assign-unit thành công; chỉnh assign-unit và các đường giải phóng liên quan trong transaction, giữ kiểm tra lịch | T0 | Integration concurrent assignment, đổi kho, cancel/no-show và booking tương lai đúng trạng thái/lịch |
| T4a | Chốt event contract và bổ sung WebSocket authentication/routing theo recipient; chỉ thêm persistence/API đọc nếu policy offline yêu cầu | T0 | Kết nối hợp lệ nhận đúng event; anonymous và người khác không nhận dữ liệu; cleanup khi disconnect |
| T4b | Nối assignment service với notification sau commit, xử lý retry/dedupe/reassignment theo policy; không gửi email staff/customer khi assignment | T4a; T3 nếu trigger theo assign-unit | Assignment thất bại không phát event; sự kiện đúng người và thời điểm; delivery lỗi không đảo assignment |
| T5 | Kiểm thử WebSocket thực tế trên server cổng tạm: auth, recipient isolation, disconnect/reconnect và nhiều kết nối theo policy | T4b | Không chỉ dùng app.inject/mock để kết luận transport WebSocket hoạt động |
| T6 | Chạy regression luồng đầy đủ qua app.inject trên PostgreSQL riêng; cập nhật tài liệu backend theo hành vi cuối cùng | T2, T3, T5 | Các tiêu chí mục 5 đạt; không có implementation FE/API client thay đổi |

Viết integration test nghiệp vụ trước thay đổi mỗi nhánh. Chỉ thêm unit test nếu policy có
nhiều nhánh; không thêm test pass-through. T2/T3/T4a có thể kiểm chứng riêng sau dependency tương ứng;
T4b tích hợp trigger đã chốt. Không cần endpoint handover/activate mới.

## 5. Acceptance criteria và verification

- Các endpoint đã có vẫn giữ method/path, auth, envelope; error cases assert status và
  không có side effect: unauthenticated 401, forbidden 403, missing record 404,
  stale/concurrent conflict 409; validation theo convention hiện có, chốt trong test T0.
- Complete chỉ thành công khi đủ 4 PASS; results được lưu và đọc lại chính xác;
  FAIL/thiếu/trùng mục bị từ chối. Ảnh và ghi chú không còn là điều kiện bắt buộc.
- Assign-unit thành công cập nhật assignment và RESERVED atomic; handover chuyển OCCUPIED.
- Policy thống nhất contract, persisted data, completion và tài liệu.
- Check-in/complete không tạo rental; handover retry chỉ có một rental và audit ban đầu;
  rollback không để booking/unit/verification lệch trạng thái.
- Kiểm tra facility và assigned Staff, reassign/terminal/deadline và concurrency bằng DB thật.
- WebSocket gửi đúng Staff, chỉ sau commit; kiểm tra authentication, recipient isolation
  và disconnect/reconnect theo policy. Không thêm mail customer/staff từ assignment.
  Mock adapter external khi phù hợp, không mock transaction/constraint PostgreSQL.
- Không tính suite skipped là pass; không thay implementation frontend/mobile/API client.

Chạy từ repo root. Chuẩn bị PostgreSQL riêng đã tạo tên `metastorage_inspection_test_flow2`,
Redis test riêng, env API test hợp lệ. Các biến URL dưới đây lấy từ môi trường test,
không dùng URL production/dev dùng chung. Fixture hiện tại ghi dữ liệu vào database.

```bash
# Bắt buộc cung cấp FLOW2_TEST_DATABASE_URL trỏ đúng DB isolated nêu trên.
export DATABASE_URL="${FLOW2_TEST_DATABASE_URL:?Set isolated Flow 2 test database URL}"
export REDIS_TEST_URL="${FLOW2_TEST_REDIS_URL:?Set isolated Redis test URL}"
export REDIS_URL="$REDIS_TEST_URL"
export RUN_INSPECTION_DB_TESTS=1
export PAYMENT_PROVIDER=mock
export LOG_LEVEL=silent

# Chỉ khi schema thay đổi; đọc generated SQL, không sửa migration bằng tay.
bun run db:generate
bun run --filter @metastorage/database db:migrate

# Mỗi suite DB chạy trong process riêng: app.close() đóng pool DB toàn cục hiện có.
bun test --preload ./apps/api/tests/setup.ts apps/api/tests/integration/inspections.integration.test.ts
bun test --preload ./apps/api/tests/setup.ts apps/api/tests/integration/handover.integration.test.ts
bun test --preload ./apps/api/tests/setup.ts apps/api/tests/integration/booking-email-access.test.ts
bun test --preload ./apps/api/tests/setup.ts apps/api/tests/units/inspections.policy.test.ts apps/api/tests/units/inspections.cloudinary.test.ts
bun run --filter @metastorage/contracts test
bun run --filter api check-types
bun run --filter api lint
bun run --filter @metastorage/contracts check-types
bun run --filter @metastorage/database check-types
# Dự kiến file test mới cho T3/T4; chạy sau khi thêm các file này.
bun test --preload ./apps/api/tests/setup.ts apps/api/tests/integration/flow2-assignment.integration.test.ts
# Test WebSocket mới của T5 dùng server cổng tạm, không gửi thông báo thật.
bun test --preload ./apps/api/tests/setup.ts apps/api/tests/integration/flow2-websocket.integration.test.ts

git diff --check
git diff --name-only
# Sau khi khôi phục runner/index; trước commit, không chấp nhận partial/truncated.
node .gitnexus/run.cjs detect-changes --scope all --repo .
```

Biome: chạy `bunx biome check` với danh sách file TS thực sự sửa từ `git diff --name-only`;
không chạy auto-fix toàn repo để tránh thay đổi ngoài phạm vi. Kết quả thực thi được báo trong phần bàn giao; không tính suite skipped là pass. Integration qua app.inject là xác minh backend; không tuyên bố
đã kiểm chứng UI hay tương thích runtime của frontend chỉ dựa trên các test này.

## 6. Rủi ro và non-goals

Rủi ro chính: policy H6 trùng tên nhưng khác nghĩa; status vật lý không biểu diễn được lịch;
required contract mới làm caller cũ không complete được; race giữa phân công và delivery;
DB commit/WebSocket publish không atomic; offline mất event nếu không có persistence/replay;
fan-out nhiều instance và session hết hạn; fixtures/test có thể skip nếu thiếu env.
Không đổi ngày tính thuê sang thời điểm bàn giao khi chưa có quyết định nghiệp vụ.

Non-goals: frontend/mobile/API client, dashboard thông báo, mobile push/SMS, notification admin CRUD tổng quát,
email sau assignment,
workflow phê duyệt đổi/từ chối/hoàn tiền mới, hợp đồng pháp lý/chữ ký, PIN/NFC/IoT,
generic checklist engine, microservices, dependency mới không cần thiết, refactor unrelated,
deploy, chạy migration DB thật, commit hoặc push.

## 7. Kết quả kiểm chứng implementation (2026-10-17)

- Generate migration `0035_greedy_callisto.sql` bằng `bun run db:generate`; đã đọc SQL
  (chỉ thêm ba cột nullable). Migrate thành công trên DB riêng `metastorage_inspection_test_flow2`.
- Các suite chạy process riêng: inspection 1, handover 1, assignment 1, WebSocket qua TCP thật 1,
  booking-email-access với Redis test 1, bookings-swagger 11: tổng 16 tests đạt, không skip.
- Inspection policy + Cloudinary regression: 11 tests đạt. Contracts: 12 tests đạt.
- Typecheck api/contracts/database đạt; API lint đạt (102 source files), Biome trên 26 file
  TS/JSON thay đổi đạt; `git diff --check` đạt. Đã tự rà diff và generated migration.
- GitNexus đã được bootstrap/index tại repo metastorage, commit index ban đầu 8506d8b.
  Impact báo CRITICAL cho closure/inspection-get và HIGH cho booking service factory;
  đã đối chiếu source/test các caller liên quan. Detect-changes chạy với scope all và
  limit 1000, báo critical (46 symbols/40 processes). Index có flow-budget truncation và
  một số receiver không resolve; không coi đây là chứng nhận graph đầy đủ hoặc all-clear.
- Chưa chạy full monorepo test/build, browser/UI hay deploy; không thay frontend/API client.
  Frontend cũ cần gửi results khi được tích hợp sau này; không tự suy ra bốn PASS từ payload cũ.
- WebSocket chủ ý không lưu/replay và chỉ một API instance. Kho có legacy assignment chồng lấn
  được bảo vệ khi giải phóng; không tự sửa lịch sử hoặc tự xử lý xung đột dữ liệu cũ.
