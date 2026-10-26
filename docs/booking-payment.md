# Bắt đầu thanh toán booking

`POST /api/bookings/:bookingId/pay` tạo phiên SePay Payment Gateway cho booking
`DRAFT` hiện có. Endpoint yêu cầu session của CUSTOMER đang ACTIVE và booking
phải thuộc tài khoản này. Không chấp nhận token guest làm quyền truy cập.

```json
{
  "idempotencyKey": "<16–128 ký tự, giữ nguyên khi retry>",
  "contactPhone": "+84901234567"
}
```

`contactPhone` là tùy chọn nếu profile đã có số điện thoại hợp lệ. Nếu profile chưa có,
customer phải nhập số tại bước booking/thanh toán. Số được lưu riêng cho booking và
không cập nhật `users.phone`. Tên/email lấy từ tài khoản; booking không có cột tên/email.
Đăng ký tài khoản vẫn không bắt buộc phone. Draft luôn có owner và không trả bearer token.

Trả HTTP 201 với envelope chuẩn, `data` gồm `bookingId`, `paymentId`, `status: PENDING`,
`provider: sepay`, `paymentCode`, `checkoutUrl`, `checkoutFormFields`, `expiresAt`.
Form fields được ký bởi SDK SePay; không có request gọi provider hoặc gửi mail ở bước này.
Return URL cho booking mới là `${WEB_URL}/bookings/payment-result` với `status`,
`paymentId` và `bookingId`. Return URL không xác nhận payment.
Gateway chỉ nhận `bookingId`, không tạo URL checkout reservation. Các method tạo
phiên SePay từ reservation (`startSepayPayment`, `pendingResponse`) đã được bỏ.
API trạng thái đối soát payment booking qua API SePay có xác thực và chỉ tạo lại
form checkout khi payment còn PENDING và hold hợp lệ;
payment reservation cũ không còn được tạo form checkout qua gateway này.

## Quyền đọc trạng thái payment

Từ #163, booking draft mới tính một tháng thuê bằng 30 × 24 giờ, thay cho tháng
lịch. Snapshot ngày hết hạn/giá của booking đã lưu được giữ nguyên. Gia hạn cộng
từ `rentals.expected_end_at`, thu tiền thuê riêng và không thu thêm cọc; xem
[API gia hạn](./rental-renewal-api.md).

`GET /api/payments/:paymentId/status` yêu cầu cookie đăng nhập của CUSTOMER ACTIVE
có `bookings.user_id` khớp session. Thiếu session trả 401; sai role hoặc inactive trả 403;
booking/payment không thuộc customer hoặc không tồn tại trả 404. Header
`x-booking-access-token` và cookie tracking cũ không cấp quyền.
Response có `Cache-Control: no-store` và `Referrer-Policy: no-referrer`.
Hold hết hạn không thu hồi quyền đọc trạng thái qua tài khoản.
Email xác nhận dẫn tới `/customer/reservations/:bookingId`, không cấp magic link.
Các endpoint `/booking/magic-link/exchange`, `/booking/access-link`, `/booking/tracking/*`
và `/booking/session/revoke` đã bị xóa. Web/mobile/API client cần cập nhật riêng.

## Đối soát bằng API SePay, không cần IPN

API status kiểm tra quyền trước, sau đó tra cứu
`GET https://pgapi-sandbox.sepay.vn/v1/order/detail/{paymentCode}` bằng Basic Auth
merchant/secret ở backend. Chỉ đơn `CAPTURED` có đúng invoice, số tiền snapshot,
currency VND và order ID hợp lệ mới tạo sự kiện xác minh cho transaction payment
hiện có. Sandbox có thể trả `transactions: []`; trạng thái đơn CAPTURED là căn cứ
theo [API SePay](https://developer.sepay.vn/vi/cong-thanh-toan/API/don-hang/chi-tiet-don-hang).

Sự kiện `ORDER:<order_id>` ổn định qua retry/restart. Row lock và trạng thái payment
bảo đảm polling, cron và IPN tùy chọn không xác nhận booking/allocation/email hai lần.
Chỉ lưu metadata đơn cần cho đối soát, không lưu thông tin thẻ hoặc raw response.
Status SUCCEEDED có thể enqueue mail bị bỏ lỡ sau commit; job ID theo booking
giữ nguyên để không tạo thêm job.

Mỗi payment được claim bằng update có điều kiện trên `payments.updated_at`, cách
nhau ít nhất 15 giây giữa các instance; không giữ transaction trong lúc gọi HTTP.
Request provider timeout sau 5 giây. Lỗi kết nối tạm thời như ECONNRESET được thử
lại một lần trong cùng deadline 5 giây; không tăng gấp đôi thời gian chờ. Lỗi
mạng/auth/provider hoặc dữ liệu không khớp
trả 503, giữ PENDING để thử lại; 404 (chưa submit form), đơn chưa CAPTURED hoặc hủy
không tự xác nhận hay kết luận giao dịch đã nhận tiền. Không tự tạo payment khác.
Request trong thời gian chờ claim đọc trạng thái DB hiện tại.

Cron hiện có chạy lúc khởi động và mỗi 30 giây, đối soát tối đa 10 payment booking
SePay PENDING, ưu tiên lâu chưa kiểm tra. Dòng đã kiểm tra được đưa về cuối lượt để
không chặn các đơn mới bởi đơn cũ chưa trả tiền. Đóng tab không dừng đối soát.
Backend ngủ/tắt thì lượt khởi động hoặc request status tiếp theo tiếp tục xử lý.
Timer yêu cầu API server Node chạy lâu dài; không được bảo đảm trên serverless/edge.

Payment config: `PAYMENT_PROVIDER=sepay`, `SEPAY_ENV=sandbox`,
`SEPAY_MERCHANT_ID`, `SEPAY_SECRET_KEY`. Giữ sandbox cả khi `NODE_ENV=production`
trên môi trường demo. Deploy đặt `WEB_URL` về frontend công khai, cùng CORS/session
origin và `PUBLIC_APP_URL` cho QR/email. Không cần IPN, `PUBLIC_API_URL`, bank account
hay webhook key cho checkout này. Database, Redis và worker/email có cấu hình riêng.
Không thay đổi schema và không cần migration mới cho phần đối soát.

Backend chỉ hỗ trợ SePay Payment Gateway: khi `PAYMENT_PROVIDER=sepay`, thiếu merchant
ID hoặc secret key sẽ dừng startup. Bank webhook cũ (`id`, `code`, `transferAmount`)
và xác thực `Authorization: Apikey ...` bị từ chối. PG IPN và tra cứu order API vẫn
hoạt động; URL `/api/payments/webhooks/sepay` và `/api/sepay/ipn` được giữ nguyên.
Các biến `SEPAY_WEBHOOK_API_KEY`, `PUBLIC_API_URL`, `SEPAY_TEST_MODE` đã được bỏ.
`SEPAY_BANK_*` chỉ còn là thông tin hiển thị tùy chọn trong `transferInstructions`.
Trước khi triển khai, kiểm tra dashboard không còn gửi bank webhook cũ và xử lý các
giao dịch đang chờ theo luồng cũ; bản refactor này không chuyển đổi dữ liệu giao dịch.

Endpoint `confirm-sandbox` đã được bỏ: trình duyệt không được tự xác nhận đã trả tiền.

## Quy tắc

- Ngày nhận kho của draft và payment mới phải sau ngày hiện tại tại
  `Asia/Ho_Chi_Minh` (ngày lịch, không yêu cầu đủ 24 giờ). Retry cùng key với hold
  còn hạn vẫn trả phiên cũ khi qua nửa đêm; không gia hạn hold.
- Transaction khóa booking và offering của cặp facility/unit type, kiểm tra capacity
  trên toàn kỳ thuê, lưu contactPhone, tạo hold 10 phút và payment PENDING cùng lúc.
- Draft và payment dùng chung cách tính sức chứa: chỉ xét kho hiện đang `AVAILABLE`
  và không có lịch gán kho ACTIVE giao với khoảng thuê. Booking đã gán kho được tính
  qua kho vật lý, không trừ lại allocation của booking đó. Với booking chưa gán kho
  và hold còn hạn, trừ số chỗ bị chiếm đồng thời cao nhất trong khoảng thuê.
  Kho đang thuê hoặc chưa sẵn sàng không được tính dựa trên ngày trả dự kiến.
- Truy vấn sức chứa dùng Drizzle query builder cho filter, join, CTE, union và group;
  `sql` chỉ biểu diễn chuyển múi giờ, chặn khoảng thời gian, window function và các
  phép tính cần thiết. Toàn bộ chạy trong một statement, cùng snapshot và chỉ trả
  số chỗ còn nhận được về ứng dụng.
- Khoảng thuê dùng `[bắt đầu, kết thúc)`: hai lượt kết thúc/bắt đầu cùng thời điểm
  không chồng lấn khi tính sức chứa. Kho thực tế vẫn phải được nhân viên xác nhận
  `AVAILABLE` sau khi kiểm tra; phép tính này không tự đổi trạng thái kho.
- Giữ nguyên booking ID, account owner, lịch và giá snapshot; không tạo booking khác,
  QR hoặc email. `payments.booking_id` được ghi ngay và hold reference dùng booking ID.
- Server tạo mã ngẫu nhiên nội bộ để đối chiếu hold và payment; mã này không được
  trả cho client và không dùng thay session để cấp quyền.
- Cùng key và booking trả cùng payment/thời hạn. Không gia hạn hold.
  Đổi contactPhone hoặc dùng key cho booking khác trả 409.
- Một payment PENDING chặn attempt mới, kể cả khi hold hết hạn: giao dịch có thể
  vẫn đến sau hạn và cần đối soát. Retry cùng key sau khi hold hết hạn cũng trả 409.
- Thiếu SePay PG merchant ID/secret hoặc provider chưa chọn SePay trả 503 trước khi
  ghi contactPhone/hold/payment. Mock và bank webhook cũ không dùng để bắt đầu endpoint này.

HTTP 400: input không hợp lệ; 401: chưa đăng nhập; 403: sai role/inactive; 404: booking không thuộc tài khoản; 409: booking không
còn DRAFT, lịch/offering/capacity không còn hợp lệ hoặc conflict checkout; 503: SePay PG
chưa được cấu hình. `error.code` dùng mã HTTP theo convention hiện tại.

## Phạm vi hiện tại

Webhook `POST /api/payments/webhooks/sepay` (alias `/api/sepay/ipn`) giữ tương thích
cho consumer cũ, không cần cấu hình cho flow mới. IPN cần xác thực, transaction ID ổn định,
`ORDER_PAID`, order `CAPTURED`, transaction `APPROVED`/`PAYMENT`, số tiền khớp và
currency VND. Sự kiện hủy/chưa thành công hoặc sai số tiền/currency được ghi IGNORED.
Xem [đặc tả IPN SePay](https://developer.sepay.vn/vi/cong-thanh-toan/IPN).

Transaction khóa theo thứ tự booking → payment → offering → hold, chuyển cùng
booking `DRAFT → CONFIRMED`, payment `PENDING → SUCCEEDED`, hold `HOLD → BOOKING`
và provider event sang PROCESSED. Không tạo booking mới, không gán kho vật lý.
Email được enqueue sau commit. Webhook lặp không tạo thêm booking/QR/allocation hoặc
enqueue lại email. Lỗi database rollback toàn bộ, event có thể được gửi lại.

Tiền đến sau hold hết hạn được kiểm tra lại sức chứa dưới cùng khóa offering với
payment mới. Còn chỗ thì tái sử dụng allocation hết hạn (hoặc tạo allocation paid),
không gia hạn checkout. Booking giữ nguyên lịch/giá. Có thể xác nhận sau slot đã
chọn nếu chưa kết thúc slot cuối cùng của ngày nhận kho. Check-in cũng dùng hạn
cuối ngày này; vẫn yêu cầu payment SUCCEEDED và kho/nhân viên đã được phân công.

Hết chỗ, offering không hoạt động hoặc đã tới hạn cuối check-in thì ghi payment
REFUND_PENDING, paidAt, provider reference và lý do; event PROCESSED, hold RELEASED,
booking giữ DRAFT, không QR/email/gán kho. Hoàn toàn bộ payment total gồm thuê + cọc;
đây không phải chính sách khách hủy/NO_SHOW mất cọc. Callback đã được xử lý trả 200.

## Hoàn thủ công cho MVP

- `GET /api/payments/refunds?limit=20&offset=0`: danh sách khoản REFUND_PENDING.
- `POST /api/payments/:paymentId/refund/confirm` với `{ "reference": "mã chuyển khoản/bằng chứng" }`:
  xác nhận admin đã chuyển tiền, không thực hiện chuyển tiền qua SePay.
- Chỉ SYSTEM_ADMIN và BUSINESS_OPERATION_MANAGER đang ACTIVE được truy cập.
  Server lấy toàn bộ số tiền từ payment, actor từ session và thời gian hiện tại.
  Lưu refundReference/refundedBy/refundedAt rồi chuyển REFUNDED trong transaction.
  Retry cùng reference giữ nguyên audit; reference khác trả 409. Payment không chờ
  hoàn trả 409, payment không tồn tại trả 404; guest 401, sai role 403, input sai 400.

Migration `0033_bent_puma.sql` bổ sung enum/metadata hoàn tiền; phải migrate trước
khi chạy backend mới.
Hủy trước bàn giao và NO_SHOW dùng cùng API hoàn thủ công, nhưng `amount` chỉ là
tiền thuê; `depositForfeitedAmount` là tiền cọc bị giữ. Xem [policy hủy/NO_SHOW](booking-cancellation-policy.md).
Migration `0034_nosy_hellfire_club.sql` bổ sung snapshot số tiền hoàn và cọc bị giữ;
cần migrate trước khi chạy backend mới. Payment status trả thêm `refund` khi đang
chờ hoàn/đã hoàn; customer xem thông tin này qua session tài khoản.

## Kiểm thử

Chạy với PostgreSQL test riêng đã migrate, đặt `DATABASE_URL` bằng
`BOOKING_TEST_DATABASE_URL` và `NODE_ENV=test`:

```sh
bun test apps/api/tests/integration/booking-payment-start.test.ts
```

Test dùng SDK SePay với credential giả để tạo form tại chỗ, không gọi SePay thật
hoặc gửi email thật. Các ca PostgreSQL không cần Redis. Để chạy cả chuỗi API và
kiểm tra email job thực trong BullMQ, đặt thêm `REDIS_TEST_URL` trỏ tới Redis test
riêng. Queue dùng tên riêng theo fixture và được dọn sau test; không chạy worker.
Nếu thiếu Redis test, ca xác minh email/full API flow sẽ được đánh dấu skip.

| Tình huống | Kiểm tra tích hợp |
| --- | --- |
| Chỗ cuối | Hai draft gọi payment đồng thời: chỉ một payment/hold được tạo |
| Retry | Giữ nguyên payment ID và expiresAt, kể cả retry qua nửa đêm Việt Nam |
| Hết hạn | Chạy `expireCapacityHolds()` thật đúng expiresAt; hold thành EXPIRED, retry không hồi sinh |
| Webhook lặp | Cùng event đồng thời và event khác cho payment đã xác nhận: một booking/allocation/email job |
| Tiền đến muộn | Tranh chỗ với checkout mới dưới khóa transaction; không nhận dư capacity |
| Hết chỗ/hết ngày | REFUND_PENDING toàn bộ thuê + cọc, không booking confirmation hoặc QR |
| Hoàn thủ công | Admin xác nhận qua API; webhook replay không đổi số tiền/reference/actor/thời gian |
| Chuỗi API | Draft → pay → protected status → webhook → manager gán staff/kho → staff check-in |
| Rollback | Database lỗi không để lại booking confirmed hoặc provider event xử lý dở; retry được |

Các ca hủy/NO_SHOW bổ sung trong suite payment: hủy đồng thời, hủy sau VERIFIED,
tranh chấp hủy với handover, handover tại đúng hạn cuối, NO_SHOW với hai lượt cron
đồng thời, cron bắt lại booking quá hạn lúc startup và rollback khi constraint lỗi.
Tracking có ca đọc booking CANCELLED trong lúc chỉ tiền thuê đang chờ hoàn.

Provider-confirmed rental charges use a separate `rentalChargeId` payment source;
their completion and late-capture refund paths do not create or modify bookings,
capacity, QR, or handover. See [rental charges API](./rental-charges-api.md).
