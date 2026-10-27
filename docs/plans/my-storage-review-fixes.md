# Kế hoạch khắc phục review Flow 3

Ngày: 2026-10-20. Baseline: `8e5bd9c`, sau `1747e39` và `ee01cb7`.
Đối chiếu `docs/plans/my-storage-lifecycle.md` và bốn finding trong review.
Trạng thái: đã triển khai R1–R4 theo quyết định tài chính được xác nhận trong hội thoại; xem kết quả kiểm chứng cuối tài liệu.
Phạm vi: backend, worker, database, shared contracts, test và tài liệu liên quan.

## 1. Hiện trạng và nguyên nhân

| ID | Vấn đề | Nguyên nhân | Kết quả cần đạt |
| --- | --- | --- | --- |
| R1 — P1 | Báo cáo không ghi nhận refund trả kho; tiền cọc đang giữ bị sai | Report chỉ đọc payment booking, không đọc `return_refunds`/`return_settlements` | Overview/export/reconciliation phản ánh đúng tiền đã hoàn, nghĩa vụ hoàn còn lại và tiền cọc; không cộng trùng revision |
| R2 — P2 | Không ghi được ảnh bàn giao tài sản sau inspection FAIL | Upload giới hạn ở attempt hiện hành DRAFT/PASS; disposition của attempt cũ chỉ nhận ảnh của attempt đó | FS ghi bằng chứng bàn giao phát sinh sau FAIL và giải quyết nghĩa vụ cũ, giữ lịch sử inspection |
| R3 — P2 | Hủy request sau expiry làm mất notification overdue | `cancel()` đổi trạng thái trực tiếp; sweep chỉ phát event khi trạng thái chưa OVERDUE | Mọi đường chuyển overdue tạo cùng logical event, atomic và deduplicated |
| R4 — P2 | Email booking chứa link truy cập có thể mất sau payment commit | Outbox booking chỉ gửi FM; email khách enqueue BullMQ sau transaction | Payment commit lưu bền vững ý định gửi booking email cho khách; restart/retry vẫn gửi được |

## 2. Quy tắc và quyết định thiết kế

- Giữ Route → Service → Repository, shared Zod contracts, messages/types theo feature.
- Giữ quyền customer/FS/FM, facility scope, FS đang được phân công và optimistic version.
- Không ghi đè payment gốc, settlement revision, checklist/results PASS/FAIL hoặc refund cũ.
- Tiền dùng integer VND/BigInt; PENDING không phải tiền đã thu/hoàn.
- Dùng transaction và lock hiện hữu; không gọi Redis, storage hoặc email provider trong
  transaction thanh toán. Lỗi delivery không rollback payment đã thành công.
- Mỗi inspection vẫn tối đa 5 ảnh. Không bổ sung loại service request hoặc sửa checklist check-in.
- Dùng DB/Redis container local hiện có; fixture/queue/job có ID riêng, cleanup đúng fixture.
  Không tạo DB riêng, truncate, reset seed, flush Redis hoặc gửi email thật.

### Quyết định R1 đã được xác nhận trong hội thoại

FM ghi rõ phần cọc và tiền thuê khi refund gồm cả hai nguồn; backend kiểm tra tổng
và hạn mức. Trường hợp một nguồn thì suy ra được. `depositHeld` là cọc còn phải hoàn
sau phí đã duyệt và cọc đã hoàn, tối thiểu 0. Lịch sử không phân bổ được đánh dấu
chưa phân loại; không tự gộp phí overdue/damage vào revenue/forfeiture.

## 3. Task triển khai và cách kiểm chứng

### R1. Giữ báo cáo tài chính tương thích với return settlement/refund

File: `modules/reports/reports.repository.ts`, `reports.service.ts`,
`reports.calculation.ts`, `modules/returns/returns.service.ts`, schema/contracts return
nếu cần phân bổ refund; `tests/integration/reports-postgres.test.ts`.

1. Chuẩn bị fixture report chạy an toàn trên DB local có sẵn dữ liệu: dùng facility/ID
   riêng và baseline cho aggregate toàn cục; rà guard/cleanup trước khi chạy suite.
2. Thêm regression: thu cọc 1.000.000, trả đúng hạn, hoàn đủ cọc; report phải ghi
   cash refunded 1.000.000 và cọc còn giữ 0. Kiểm tra refund từng phần và khác kỳ.
3. Aggregate refund theo `confirmedAt`/as-of; cộng dữ liệu cũ và return refund mà
   không join nhiều refund với nhiều revision gây nhân số tiền.
4. Lấy settlement revision mới nhất có hiệu lực tại as-of, giữ số liệu lịch sử trước
   correction. Áp dụng phân bổ cọc/tiền thuê sau khi quyết định trên được xác nhận.
5. Đồng bộ overview/export/reconciliation dùng cùng phép tính; giữ quyền scope và
   API cũ. Không coi debt là tiền đã thu; không coi toàn bộ cọc là doanh thu.

Acceptance: refund chưa xác nhận không tăng cash refunded; correction không cộng
hai settlement; báo cáo trước ngày refund không nhìn thấy khoản hoàn tương lai;
khác facility bị chặn; dữ liệu booking cancellation cũ không bị cộng trùng.

### R2. Ghi bằng chứng disposition sau inspection thất bại

File: `modules/returns/returns.service.ts`, repository hiện có,
`tests/integration/returns.integration.test.ts`, `docs/returns-api.md`.

1. Thêm case FAIL có tài sản chưa xử lý, tạo attempt mới, chụp ảnh bàn giao mới
   sau FAIL và dùng ảnh đó giải quyết disposition của attempt cũ.
2. Cho disposition tham chiếu ảnh inspection thuộc cùng return request, thay vì
   chỉ cùng attempt. Reuse truy vấn inspection/photos và kiểm tra linkage hiện có.
   Ảnh vẫn thuộc attempt nơi upload; không chuyển ảnh hoặc tạo bản sao.
3. Giữ upload vào attempt hiện hành theo luồng retry hiện có; giữ giới hạn 5 ảnh
   mỗi attempt. Ghi audit inspection nguồn của bằng chứng khi cập nhật disposition.
4. Giữ closure kiểm tra mọi attempt. Không sửa kết quả FAIL cũ hoặc xóa nghĩa vụ
   chỉ vì attempt mới PASS.

Acceptance: ảnh mới ở attempt retry được chấp nhận cho disposition cũ; ảnh request
khác bị từ chối; FS cũ/sai cơ sở bị chặn; stale version bị conflict; ảnh thứ sáu
vẫn bị từ chối; chưa có disposition hợp lệ vẫn không đóng rental.
Không dự kiến thay đổi schema: `propertyEvidencePhotoIds` hiện đã là danh sách ID.

### R3. Bảo đảm notification overdue khi cancel và sweep chạy cạnh tranh

File: `modules/returns/returns.service.ts`,
`modules/rentals/rental-lifecycle.{service,repository}.ts`,
`modules/notifications/lifecycle-notifications.repository.ts`,
`tests/integration/returns.integration.test.ts`.

1. Thêm regression cancel PENDING sau midnight facility-local nhưng trước sweep:
   customer và FM phải có đúng một logical event overdue cho mỗi recipient.
2. Khi cancel tạo trạng thái OVERDUE, ghi event trong cùng transaction với cùng
   key `rental:{id}:overdue` mà sweep sử dụng. Chỉ tách helper nhỏ nếu được dùng
   thực sự bởi cả hai đường; không tạo state-machine framework mới.
3. Cho sweep phát hiện OVERDUE thiếu event và bổ sung theo key hiện có, bao gồm
   dữ liệu đã bị bỏ sót trước bản sửa. Không thay đổi actual-return-on-time rule.
4. Kiểm tra xử lý theo batch không lặp vô hạn/chặn các rental sau khi không có
   recipient hợp lệ; không dùng số dòng email làm bằng chứng chuyển trạng thái.

Acceptance: cạnh tranh cancel/sweep và retry không tạo duplicate; rollback không
để lại event; trước midnight không overdue; return workflow không bị mất;
rental đã trả đúng hạn không bị phát thông báo overdue.

### R4. Lưu bền vững email booking có tracking link

File: `modules/payments/payments.repository.ts`, `payments.service.ts`,
`modules/bookings/bookings.service.ts`, notification outbox repository/schema,
`apps/worker/src/notifications/*`, `apps/worker/src/mail/*`,
shared booking-link/mail helpers và `tests/integration/booking-email-access.test.ts`.

1. Thêm test crash sau payment commit, trước enqueue; khởi động dispatcher lại
   phải tạo email booking cho contact email, gồm tracking link và QR hiện có.
2. Lưu intent cho email booking khách trong transaction payment, reuse outbox
   và khóa dedupe hiện hữu. Không chỉ bật `customer: true` rồi gửi email text
   chung vì email đó thiếu tracking link/QR.
3. Dispatcher xử lý intent bằng flow tạo link/encrypt/BullMQ hiện có ngoài DB
   transaction. Giữ job ID/delivery ID, email template, guest access và TTL tính
   từ `paidAt`. Không gia hạn link vì retry.
4. Tách trạng thái enqueue với provider-confirmed delivery: enqueue thành công
   không đồng nghĩa SENT. Chỉ bổ sung metadata/trạng thái tối thiểu vào outbox
   hiện hữu; không tạo bảng hoặc queue notification song song.
5. Loại bỏ việc phụ thuộc vào callback/client retry để enqueue; các đường gọi
   cũ phải dùng cùng intent/delivery ID để tránh gửi hai email booking.
6. Giữ payload/link chứa token được mã hóa và không lộ qua inbox/log.
   Bao phủ queue job cũ đang tồn tại lúc rollout; không replay hàng loạt booking
   lịch sử hoặc gửi lại email đã thành công. Bản ghi có kết quả delivery không
   rõ sau cửa sổ idempotency chuyển xử lý thủ công.

Acceptance: crash trước/sau enqueue, queue unavailable, provider timeout và
lost acknowledgement không mất intent hoặc tạo logical email thứ hai; chỉ
provider success mới báo SENT; link hết hạn không được cấp lại tự động.
Giữ `emailStatus` API hiện có và mapping tương thích.

## 4. Thứ tự và migration

- R1 bước chuẩn bị fixture/cash refunded, R2 và R3 độc lập.
- R1 số dư/phân bổ phụ thuộc quyết định tài chính ở mục 2.
- R4 transaction intent → dispatcher/queue bridge → trạng thái delivery và
  compatibility → regression. Hoàn tất cả chuỗi trước bật delivery mới.
- R2/R3 dự kiến không cần schema mới. R1/R4 chỉ thêm field/constraint cần thiết
  sau khi xác nhận mô hình; cập nhật `docs/db-diagram.md` và Drizzle cùng nhau,
  generate migration bằng `bun run db:generate`, không sửa migration sinh ra.
- Không backfill số liệu tài chính thiếu căn cứ. Kiểm tra lịch sử migration
  container local trước apply; không reset DB để giải quyết divergence.
- Trước sửa function/method: GitNexus impact và kiểm chứng caller khi UNKNOWN.
  Index hiện chậm ba commit; cần cập nhật trước implementation, không coi graph
  cũ hoặc listing bị cắt là bằng chứng không có ảnh hưởng.

## 5. Lệnh xác minh khi triển khai

Lệnh triển khai và tái kiểm chứng. Dùng URL container local thực tế;
chạy mỗi suite riêng và chỉ sau khi fixture/queue đã được kiểm tra an toàn.

```bash
export DATABASE_URL="${MY_STORAGE_LOCAL_DATABASE_URL:?Set existing local DB URL}"
export BOOKING_TEST_DATABASE_URL="$DATABASE_URL"
export REPORTS_TEST_DATABASE_URL="$DATABASE_URL"
export REDIS_URL="${MY_STORAGE_LOCAL_REDIS_URL:?Set existing local Redis URL}"
export REDIS_TEST_URL="$REDIS_URL"
export RUN_INSPECTION_DB_TESTS=1
export NODE_ENV=test LOG_LEVEL=silent PAYMENT_PROVIDER=mock

bun test --preload ./apps/api/tests/setup.ts apps/api/tests/integration/reports-postgres.test.ts
bun test --preload ./apps/api/tests/setup.ts apps/api/tests/integration/returns.integration.test.ts
bun test --preload ./apps/api/tests/setup.ts apps/api/tests/integration/booking-email-access.test.ts
# Chỉ nhóm liên quan; không chạy global cron trên DB local có sẵn dữ liệu.
bun test --preload ./apps/api/tests/setup.ts apps/api/tests/integration/booking-payment-start.test.ts -t 'authorized status verifies SePay|unauthorized status never|starts SePay checkout|concurrent same-key|full API flow'
bun test --preload ./apps/api/tests/setup.ts apps/api/tests/integration/rentals-read.test.ts

bun run --filter api check-types
bun run --filter worker check-types
bun run --filter @metastorage/contracts check-types
bun run --filter @metastorage/database check-types
bun run --filter api lint
bun run --filter worker lint
bun run --filter @metastorage/contracts lint
bun run --filter @metastorage/database lint
bun run --filter api build
bun run --filter worker build
git diff --check
node .gitnexus/run.cjs detect-changes --scope all --repo .
```

Không tính suite skipped là pass. Báo kết quả thực chạy, migration đã/chưa áp dụng
và giới hạn kiểm chứng provider; cập nhật tài liệu API liên quan.

## 6. Rủi ro và non-goals

Rủi ro chính: phân bổ refund sai, join nhân số liệu, chuyển email tạo duplicate
trong rollout và lộ token qua outbox/inbox. Test phải bao phủ rollback, concurrency,
as-of history, delivery retry và dữ liệu booking cũ.

Không frontend/API client, không dashboard/kế toán mới, không renewal/upgrade,
không refund provider tự động, không sửa chính sách pháp lý/tài sản, không tăng
giới hạn ảnh. Không commit/push/deploy trong task lập kế hoạch.

## 7. Kết quả implementation

- R1: refund cọc/tiền thuê có constraint tổng, validation/lock và audit; report dùng
  latest effective revision cùng aggregate transfer trước join, không cộng trùng.
  Historical ambiguous splits vào reconciliation; không đoán hoặc backfill.
- R2: bằng chứng property từ attempt khác trong cùng request được chấp nhận và lưu
  source attempt trong audit; không đổi FAIL cũ, không tăng giới hạn ảnh.
- R3: cancel/sweep dùng cùng overdue event; sửa event thiếu và phân trang batch
  bằng UUID để bản ghi không recipient không chặn các rental phía sau.
- R4: customer intent/snapshot trong payment transaction; encrypted payload frozen,
  worker enqueue và provider acknowledgement độc lập; giữ job/delivery ID, TTL,
  template và legacy fallback; không replay email lịch sử.
- Migration 0042 generate/apply thành công vào container local. Bổ sung schema
  pricing bị thiếu bằng SQL additive 0035 hiện có, không sửa file generated/journal cũ.
- PostgreSQL/Redis local: returns 25 pass (320 assertions), reports 11 (60), checkout
  regression chọn lọc 5 (80), rental reads 5 (67), booking-link retries 1 (9).
  API/worker/contracts/database/shared typecheck + lint và API/worker build pass.
- Không chạy 78 checkout cases đã filter hoặc global cron trên shared DB; không
  tính chúng là pass. Chưa kiểm chứng Resend/S3 thật. Không frontend/commit/push/deploy.
