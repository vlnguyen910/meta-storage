# Báo cáo Postman CLI — gia hạn kho

## Kết quả thực tế

- Postman CLI **1.82.0**; API Fastify thật, PostgreSQL thật, session/auth thật; server loopback port động.
- Mỗi lần chạy tạo database `metastorage_inspection_test_renewal_<uuid>`, áp dụng **19 migrations**, tạo fixture rồi xóa database và file chứa credentials trong `finally`. Không dùng database ứng dụng và không chạy server cron production.
- Luồng chính: **54 request, 79 assertion, 0 lỗi, exit code 0**.
- Hồi quy capacity: **2 request, 2 assertion, 1 lỗi, exit code 1**.
- Tổng: **56 request, 80/81 assertion đạt**. Runner trả exit code 1 để không che lỗi capacity.
- SePay dùng credentials test. Checkout được ký bằng adapter thật; IPN được mô phỏng và đi qua bộ xác minh webhook thật. `retrievePayment` được thay bằng `null` trong fixture sẵn có: **không có chuyển tiền, gọi order API hay hoàn tiền ngân hàng thật**. API refund/confirm ghi nhận bằng chứng hoàn tiền do operator xác nhận.
- Chạy local với `--no-report-events`. Thông báo yêu cầu `postman login` chỉ liên quan xuất bản cloud; collection local vẫn chạy và có assertion/exit code như trên.

Chạy lại từ repository root, khi Docker PostgreSQL đang mở cổng 5433:

```sh
bun apps/api/tests/run-rental-renewal-postman.ts
```

Runner tự tạo environment file tạm và gọi:

```sh
postman collection run apps/api/tests/postman/rental-renewal-capacity.postman_collection.json -e <temporary-environment> --no-report-events --timeout-request 10000
postman collection run apps/api/tests/postman/rental-renewal.postman_collection.json -e <temporary-environment> --no-report-events --timeout-request 10000
```

## Lỗi tìm được: kiểm tra capacity bỏ qua chính kho đang thuê

Điều kiện tái hiện: rental ACTIVE, còn trước cutoff, không có lịch trả hay cam kết cạnh tranh; tất cả kho AVAILABLE cùng loại được chuyển sang MAINTENANCE trong database fixture. Kho đang thuê vẫn OCCUPIED và phải được tính là nguồn có thể tiếp tục gia hạn.

`POST /api/rentals/:rentalId/renewals` mong đợi **201**, thực tế **409**. Luồng chính qua được vì fixture vẫn có một kho AVAILABLE khác. Không được diễn giải 79 assertion của luồng chính là đã chứng minh capacity đúng trong mọi trường hợp.

Đọc source giải thích kết quả: `RentalRenewalsService.quote/startPayment/processEvent` gọi `StorageUnitsService.getAvailableCapacity` bằng bốn tham số. Repository mặc định chỉ đưa kho AVAILABLE vào inventory; tùy chọn `renewal.physicalUnitId` để tính kho OCCUPIED hiện có không được service truyền xuống. Hướng sửa cần xét cả rental có bookingId và reservationId, đồng thời loại trừ cam kết của chính rental, không chỉ thêm kho OCCUPIED vào tổng.

Lần này chỉ thêm kiểm thử và báo cáo; lỗi nghiệp vụ trên **chưa sửa**.

## Thứ tự API, kỳ vọng và thực tế

`{{api}}` là origin + `/api`; `rentalId`, `renewalId`, `paymentId` được lấy từ fixture/response trước. Mọi hàng PASS dưới đây đều có assertion thực chạy, không chỉ dựa vào HTTP trả về.

### A. Capacity — chạy trước

| Thứ tự | Tình huống | API | Mong đợi | Thực tế |
|---|---|---|---|---|
| 1 | Login customer | `POST /api/auth/sign-in/email` | HTTP 200 | HTTP 200 — PASS |
| 2 | Own occupied unit is renewable without spare inventory | `POST /api/rentals/{{rentalId}}/renewals` | HTTP 201 | HTTP 409 — **FAIL** |

### B. Luồng chính — chạy sau khi khôi phục inventory fixture

| Thứ tự | Tình huống | API | Mong đợi | Thực tế |
|---|---|---|---|---|
| 1 | 01 Unauthenticated history | `GET /api/rentals/{{rentalId}}/renewals` | HTTP 401 | HTTP 401 — PASS |
| 2 | Login other | `POST /api/auth/sign-in/email` | HTTP 200 | HTTP 200 — PASS |
| 3 | 02 Other customer cannot see rental | `GET /api/rentals/{{rentalId}}/renewals` | HTTP 404 | HTTP 404 — PASS |
| 4 | Login manager | `POST /api/auth/sign-in/email` | HTTP 200 | HTTP 200 — PASS |
| 5 | 03 Manager cannot create quote | `POST /api/rentals/{{rentalId}}/renewals` | HTTP 403 | HTTP 403 — PASS |
| 6 | Login customer | `POST /api/auth/sign-in/email` | HTTP 200 | HTTP 200 — PASS |
| 7 | 04 Current rental snapshot | `GET /api/rentals/{{rentalId}}` | HTTP 200 | HTTP 200 — PASS |
| 8 | 05 Invalid months | `POST /api/rentals/{{rentalId}}/renewals` | HTTP 400 | HTTP 400 — PASS |
| 9 | 06 Reject client supplied price | `POST /api/rentals/{{rentalId}}/renewals` | HTTP 400 | HTTP 400 — PASS |
| 10 | 07 Invalid UUID | `GET /api/rentals/not-uuid/renewals` | HTTP 400 | HTTP 400 — PASS |
| 11 | 08 Closed rental rejected | `POST /api/rentals/{{closedRentalId}}/renewals` | HTTP 409 | HTTP 409 — PASS |
| 12 | 09 Create quote | `POST /api/rentals/{{rentalId}}/renewals` | HTTP 201 | HTTP 201 — PASS |
| 13 | 10 Quote same key replay | `POST /api/rentals/{{rentalId}}/renewals` | HTTP 201 | HTTP 201 — PASS |
| 14 | 11 Quote key different payload | `POST /api/rentals/{{rentalId}}/renewals` | HTTP 409 | HTTP 409 — PASS |
| 15 | 12 Paginated history | `GET /api/rentals/{{rentalId}}/renewals?limit=1&offset=0` | HTTP 200 | HTTP 200 — PASS |
| 16 | 13 Quote detail | `GET /api/rentals/{{rentalId}}/renewals/{{renewalId}}` | HTTP 200 | HTTP 200 — PASS |
| 17 | 14 Start checkout | `POST /api/rentals/{{rentalId}}/renewals/{{renewalId}}/payments` | HTTP 201 | HTTP 201 — PASS |
| 18 | 15 Checkout retry | `POST /api/rentals/{{rentalId}}/renewals/{{renewalId}}/payments` | HTTP 201 | HTTP 201 — PASS |
| 19 | 15b Checkout different key rejected | `POST /api/rentals/{{rentalId}}/renewals/{{renewalId}}/payments` | HTTP 409 | HTTP 409 — PASS |
| 20 | 15c Return blocked during pending renewal | `POST /api/appointments` | HTTP 409 | HTTP 409 — PASS |
| 21 | 16 Payment status pending | `GET /api/payments/{{paymentId}}/status` | HTTP 200 | HTTP 200 — PASS |
| 22 | 16b Other customer cannot poll payment | `GET /api/payments/{{paymentId}}/status` | HTTP 404 | HTTP 404 — PASS |
| 23 | 17 Forged webhook denied | `POST /api/payments/webhooks/sepay` | HTTP 401 | HTTP 401 — PASS |
| 24 | 18 Wrong amount ignored | `POST /api/payments/webhooks/sepay` | HTTP 200 | HTTP 200 — PASS |
| 25 | 19 Wrong amount did not extend rental | `GET /api/rentals/{{rentalId}}` | HTTP 200 | HTTP 200 — PASS |
| 26 | 20 Verified successful webhook | `POST /api/payments/webhooks/sepay` | HTTP 200 | HTTP 200 — PASS |
| 27 | 21 Renewal applied | `GET /api/rentals/{{rentalId}}/renewals/{{renewalId}}` | HTTP 200 | HTTP 200 — PASS |
| 28 | 22 Rental new expiry | `GET /api/rentals/{{rentalId}}` | HTTP 200 | HTTP 200 — PASS |
| 29 | 23 Replay successful webhook | `POST /api/payments/webhooks/sepay` | HTTP 200 | HTTP 200 — PASS |
| 30 | 24 Replay does not extend twice | `GET /api/rentals/{{rentalId}}` | HTTP 200 | HTTP 200 — PASS |
| 31 | 25 Payment succeeded | `GET /api/payments/{{paymentId}}/status` | HTTP 200 | HTTP 200 — PASS |
| 32 | 26 Payment in rental history | `GET /api/rentals/{{rentalId}}/payments` | HTTP 200 | HTTP 200 — PASS |
| 33 | 27 Second term quote | `POST /api/rentals/{{rentalId}}/renewals` | HTTP 201 | HTTP 201 — PASS |
| 34 | 28 Second checkout | `POST /api/rentals/{{rentalId}}/renewals/{{renewalId}}/payments` | HTTP 201 | HTTP 201 — PASS |
| 35 | 29 Provider reports money after deadline | `POST /api/payments/webhooks/sepay` | HTTP 200 | HTTP 200 — PASS |
| 36 | 30 Renewal requires refund | `GET /api/rentals/{{rentalId}}/renewals/{{renewalId}}` | HTTP 200 | HTTP 200 — PASS |
| 37 | 31 Payment refund pending | `GET /api/payments/{{paymentId}}/status` | HTTP 200 | HTTP 200 — PASS |
| 38 | 32 Late payment did not extend | `GET /api/rentals/{{rentalId}}` | HTTP 200 | HTTP 200 — PASS |
| 39 | 33 Cutoff window closed | `POST /api/rentals/{{cutoffRentalId}}/renewals` | HTTP 409 | HTTP 409 — PASS |
| 40 | 34 Capture snapshot cutoff | `GET /api/rentals/{{rentalId}}/renewals/{{renewalId}}` | HTTP 200 | HTTP 200 — PASS |
| 41 | Login bom | `POST /api/auth/sign-in/email` | HTTP 200 | HTTP 200 — PASS |
| 42 | 35 BOM reads settings | `GET /api/system-settings` | HTTP 200 | HTTP 200 — PASS |
| 43 | 36 Customer cannot change settings | `PUT /api/system-settings` | HTTP 403 | HTTP 403 — PASS |
| 44 | 37 BOM updates notice | `PUT /api/system-settings` | HTTP 200 | HTTP 200 — PASS |
| 45 | 38 Stale setting update denied | `PUT /api/system-settings` | HTTP 409 | HTTP 409 — PASS |
| 46 | 39 Settings audit | `GET /api/system-settings/RENEWAL_NOTICE_DAYS/history` | HTTP 200 | HTTP 200 — PASS |
| 47 | 40 Existing quote keeps cutoff | `GET /api/rentals/{{rentalId}}/renewals/{{renewalId}}` | HTTP 200 | HTTP 200 — PASS |
| 48 | 41 New quote uses changed notice | `POST /api/rentals/{{rentalId}}/renewals` | HTTP 201 | HTTP 201 — PASS |
| 49 | 42 BOM refund queue | `GET /api/payments/refunds` | HTTP 200 | HTTP 200 — PASS |
| 50 | 43 Confirm controlled refund | `POST /api/payments/{{paymentId}}/refund/confirm` | HTTP 200 | HTTP 200 — PASS |
| 51 | 44 Refund confirmation replay | `POST /api/payments/{{paymentId}}/refund/confirm` | HTTP 200 | HTTP 200 — PASS |
| 52 | 45 Customer sees refunded | `GET /api/payments/{{paymentId}}/status` | HTTP 200 | HTTP 200 — PASS |
| 53 | 46 Open return appointment | `POST /api/appointments` | HTTP 201 | HTTP 201 — PASS |
| 54 | 47 Open return blocks quote | `POST /api/rentals/{{rentalId}}/renewals` | HTTP 409 | HTTP 409 — PASS |

Các assertion nội dung xác nhận thêm: một tháng = 30 ngày, amount = 1.000.000 VND (chỉ tiền thuê), quote retry trả cùng renewal, checkout retry trả cùng payment, sai amount không đổi hạn, APPLIED có appliedAt/paymentId, webhook replay không cộng kỳ hai lần, giao dịch gia hạn xuất hiện trong lịch sử rental, khoản thu muộn giữ nguyên hạn và chuyển REFUND_REQUIRED/REFUND_PENDING, hoàn tiền có kiểm soát chuyển REFUNDED, setting version tăng và có audit, snapshot cũ giữ cutoff và quote mới dùng 8 ngày.

## Mã giả mô tả tính năng

```text
CREATE_QUOTE(session, rentalId, months, key):
  yêu cầu CUSTOMER ACTIVE; validate months=1..12 và key
  transaction:
    lock rental; kiểm tra rental.userId == session.userId
    nếu đã có (rentalId, key):
      khác months -> 409; cùng months -> trả snapshot đã lưu
    đọc giá hiện hành và setting RENEWAL_NOTICE_DAYS
    cutoff = rental.endAt - noticeDays * 24 giờ
    yêu cầu ACTIVE và rental.startAt <= now < cutoff
    từ chối lịch CHECK_OUT hoặc inspection trả kho đang mở
    newEnd = oldEnd + months * 30 ngày
    kiểm tra capacity [oldEnd, newEnd)  // hiện còn lỗi bỏ qua kho OCCUPIED của chính rental
    lưu QUOTED với rate, amount, oldEnd, newEnd, cutoff,
        noticeDays/version và expires=min(now+10 phút, cutoff)
  trả 201; chưa tạo payment/hold, chưa đổi endAt

START_CHECKOUT(session, rentalId, renewalId, key):
  yêu cầu provider được cấu hình
  transaction:
    lock rental, renewal; kiểm tra owner
    hết quote -> 409
    retry cùng phiên/key còn hạn -> trả payment hiện có
    chặn payment gia hạn khác còn hạn trên rental
    kiểm tra term/kho/status không đổi, không có return đang mở
    lock offering/kho; kiểm tra lại capacity
    tạo CHARGE PENDING, source=renewalId, amount lấy từ snapshot
    tạo capacity HOLD [oldEnd, newEnd), deadline trùng payment
    renewal -> PENDING_PAYMENT
  tạo checkout qua adapter sau commit; retry không kéo dài deadline

ON_VERIFIED_SEPAY_EVENT(event):
  adapter xác minh credentials và cấu trúc provider event
  tìm payment bằng paymentCode; dispatch nguồn renewal
  transaction:
    lock rental -> renewal -> payment -> offering/kho -> hold
    payment đã xử lý -> trả duplicate
    sai success/amount/currency/transferType -> không apply
    ghi payment_provider_events theo event ID duy nhất
    kiểm tra deadline, trạng thái và oldEnd/kho snapshot
    nếu hold hết: kiểm tra lại capacity
    nếu hợp lệ:
      payment -> SUCCEEDED; lưu paidAt/provider transaction
      hold -> allocation BOOKING không expiry (hoặc tạo allocation mới)
      rental.endAt = renewal.newEndAt
      renewal -> APPLIED, appliedAt = now
    nếu không áp dụng được:
      payment -> REFUND_PENDING; refundAmount = totalAmount
      renewal -> REFUND_REQUIRED; lưu failureReason
      giải phóng hold; giữ nguyên rental.endAt

CONFIRM_MANUAL_REFUND(BOM hoặc SA, paymentId, reference):
  lock payment; yêu cầu REFUND_PENDING
  lưu reference/refundedAt/refundedBy; payment -> REFUNDED
  retry cùng reference trả kết quả cũ
  // đây là ghi nhận operator đã hoàn tiền, không gọi ngân hàng tự động
```

## Module, service và entity theo từng bước

| Bước | Module / service tham gia | Entity đọc | Entity ghi / trạng thái thay đổi |
|---|---|---|---|
| Login/quyền | Auth / Better Auth, requireRole | users, accounts | sessions; các API gia hạn suy ra customer từ session |
| Xem rental | RentalsService, RentalsRepository | rentals, booking/reservation snapshot, unit, customer | Không thay dữ liệu nghiệp vụ |
| Báo giá | RentalRenewalsService.quote, StorageUnitsService/Repository | rentals, storage_units, unit_types, system_settings, appointments, inspections, capacity_allocations | rental_renewals mới: QUOTED, snapshot giá/kỳ/deadline/setting version |
| Đọc lịch sử/chi tiết | RentalRenewalsService.list/get | rental_renewals, rentals, payments | Không ghi; EXPIRED được suy ra khi deadline qua |
| Checkout | RentalRenewalsService.startPayment, SepayPaymentGateway | rental/quote và capacity đã khóa | payments CHARGE/PENDING có renewalId; capacity_allocations HOLD; renewal PENDING_PAYMENT |
| Theo dõi payment | PaymentsService.getStatus/reconcilePayment, PaymentsRepository, SepayPaymentGateway | payment + owner + hold | Có thể cập nhật lease updatedAt và xử lý provider event; lần test này lookup trả null |
| Callback thành công | PaymentsService.handleSepayWebhook -> RentalRenewalsService.processEvent | payment, rental, renewal, unit/offering, hold | payment_provider_events PROCESSED; payment SUCCEEDED; allocation BOOKING; rental.endAt mới; renewal APPLIED |
| Thu tiền không apply | Cùng processor callback | snapshot và deadline/trạng thái/capacity | payment REFUND_PENDING + refundAmount/reason; renewal REFUND_REQUIRED + failureReason; hold RELEASED; rental không đổi |
| Hoàn tiền có kiểm soát | PaymentsService.listManualRefunds/confirmManualRefund, PaymentsRepository | payment, renewal -> rental -> customer | payment REFUNDED + reference/refundedAt/refundedBy; renewal giữ REFUND_REQUIRED để lưu kết quả gia hạn không áp dụng |
| Mở trả kho | AppointmentsService.scheduleAppointment -> RentalsService.requireAppointmentContext/requireNoPendingRenewalPayment | rental khóa, payment gia hạn còn hạn | Có payment đang chờ -> 409; không có -> appointments CHECK_OUT/SCHEDULED; quote tiếp theo bị chặn |
| BOM chỉnh cutoff | SystemSettingsService/Repository | setting + expectedVersion | system_settings.value/version/updatedBy; system_setting_changes audit; quote đã lưu không bị viết lại |
| FM phân công kho | StorageUnitsRepository.lockAvailableForHandover | rental và renewal HOLD theo storageUnitId | Bổ sung guard HOLD; không có assertion assignment cạnh tranh trong lần chạy này |

Schema liên quan đã thay trong đợt implementation trước: thêm rental_renewals (status enum, snapshot và unique idempotency/applied-term); payments.renewalId và constraint nguồn CHARGE; refund reason RENEWAL_NOT_APPLIED; setting RENEWAL_NOTICE_DAYS cùng seed/catalog/quyền BOM. Migrations 0017/0018. Lần test này chỉ mở rộng test fixture với settings routes/BOM email và thêm runner/collection/report.

## Phạm vi chưa được chứng minh

- Chưa chạy đồng thời nhiều checkout/webhook/cron/assignment để chứng minh lock/race.
- Chưa kiểm tra đúng millisecond tại cutoff, quote/hold hết hạn tự nhiên, callback đúng hạn đến muộn và callback thiếu paidAt sau deadline.
- Chưa kiểm tra provider order reconciliation thật, mất mạng, provider checkout lỗi sau DB commit, giao dịch chuyển thừa khác event ID.
- Chưa có assertion trực tiếp về hold, allocation, unique constraint, booking/PDF/cọc bất biến, notification, availability sau apply hoặc ownership trên cả hai nguồn booking/reservation. Fixture rental chính đã được chuyển sang reservation qua hàm migration sẵn có.
- Chưa chứng minh update setting khi quote còn QUOTED/PENDING_PAYMENT vẫn checkout thành công: case snapshot hiện tại kiểm tra record đã REFUND_REQUIRED sau khi đổi setting.
- Refund confirm chỉ xác nhận lifecycle DB/API, không chứng minh tiền đã về tài khoản khách.

## Bằng chứng

- [Transcript luồng chính](rental-renewal-test-evidence-main.txt).
- [Transcript lỗi capacity](rental-renewal-test-evidence-capacity.txt).
- [Collection chính](../apps/api/tests/postman/rental-renewal.postman_collection.json).
- [Collection hồi quy capacity](../apps/api/tests/postman/rental-renewal-capacity.postman_collection.json).
- [Runner tạo môi trường test riêng](../apps/api/tests/run-rental-renewal-postman.ts).
