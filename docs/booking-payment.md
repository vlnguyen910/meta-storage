# Bắt đầu thanh toán booking

`POST /api/bookings/:bookingId/pay` tạo phiên SePay Payment Gateway cho booking
`DRAFT` hiện có. Endpoint public, xác minh quyền bằng `draftAccessToken`; đăng nhập
không thay thế token và không thay đổi `bookings.user_id`.

```json
{
  "draftAccessToken": "<64 ký tự hex từ API tạo draft>",
  "idempotencyKey": "<16–128 ký tự, giữ nguyên khi retry>",
  "contact": {
    "fullName": "Nguyen Van An",
    "email": "an@example.test",
    "phone": "+84901234567"
  }
}
```

Trả HTTP 201 với envelope chuẩn, `data` gồm `bookingId`, `paymentId`, `status: PENDING`,
`provider: sepay`, `paymentCode`, `checkoutUrl`, `checkoutFormFields`, `expiresAt`.
Form fields được ký bởi SDK SePay; không có request gọi provider hoặc gửi mail ở bước này.
Return URL cho booking mới là `${WEB_URL}/bookings/payment-result` với `status`,
`paymentId` và `bookingId`. Frontend sẽ tích hợp sau; return URL không xác nhận payment.
Gateway chỉ nhận `bookingId`, không tạo URL checkout reservation. Các method tạo
phiên SePay từ reservation (`startSepayPayment`, `pendingResponse`) đã được bỏ.
API trạng thái chỉ tạo lại form checkout cho payment gắn booking còn hold hợp lệ;
payment reservation cũ không còn được tạo form checkout qua gateway này.

## Quyền đọc trạng thái payment

`GET /api/payments/:paymentId/status` yêu cầu một trong hai credential:

- Header `x-booking-access-token: <draftAccessToken>` từ API tạo booking draft;
  server so SHA-256 với credential của đúng payment. Không gửi token trong URL.
- Cookie đăng nhập của tài khoản ACTIVE có `bookings.user_id` khớp session.
  Email trùng hoặc vai trò admin/staff không tự cấp quyền đọc checkout của khách.

Thiếu credential trả 401; credential không có quyền hoặc payment không tồn tại
cùng trả 404; token sai định dạng trả 400; tài khoản bị vô hiệu hóa trả 403.
Các response, kể cả lỗi, có `Cache-Control: no-store` và `Referrer-Policy: no-referrer`.
Hold hết hạn không thu hồi quyền đọc: khách vẫn xem được PENDING, SUCCEEDED,
REFUND_PENDING hoặc REFUNDED. Response không trả credential/hash lưu trong database.

Cookie email tracking giữ Path `/api/booking`; khách mở email tiếp tục dùng endpoint
tracking hiện có. API client/frontend chưa đổi trong task backend này: guest polling
status cần bổ sung header khi tích hợp; account owner có thể dùng session cookie.

## Quy tắc

- Ngày nhận kho của draft và payment mới phải sau ngày hiện tại tại
  `Asia/Ho_Chi_Minh` (ngày lịch, không yêu cầu đủ 24 giờ). Retry cùng key với hold
  còn hạn vẫn trả phiên cũ khi qua nửa đêm; không gia hạn hold.
- Transaction khóa booking và offering của cặp facility/unit type, kiểm tra capacity
  trên toàn kỳ thuê, lưu contact, tạo hold 10 phút và payment PENDING cùng lúc.
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
- Giữ nguyên booking ID, account owner, lịch và giá snapshot; không tạo reservation
  draft, booking khác, QR hoặc email. `payments.booking_id` được ghi ngay;
  `payments.draft_id` là NULL. Hold reference dùng booking ID.
- Token chỉ lưu SHA-256. Ở bước này hash draft token cũng là credential hash của hold
  và `payments.hold_token_hash`; không phát hành thêm hold token.
- Cùng key, booking, token và contact trả cùng payment/thời hạn. Không gia hạn hold.
  Đổi contact hoặc dùng key cho booking khác trả 409.
- Một payment PENDING chặn attempt mới, kể cả khi hold hết hạn: giao dịch có thể
  vẫn đến sau hạn và cần đối soát. Retry cùng key sau khi hold hết hạn cũng trả 409.
- Thiếu SePay PG merchant ID/secret hoặc provider chưa chọn SePay trả 503 trước khi
  ghi contact/hold/payment. Mock và bank webhook cũ không dùng để bắt đầu endpoint này.

HTTP 400: input không hợp lệ; 404: booking/token không hợp lệ; 409: booking không
còn DRAFT, lịch/offering/capacity không còn hợp lệ hoặc conflict checkout; 503: SePay PG
chưa được cấu hình. `error.code` dùng mã HTTP theo convention hiện tại.

## Phạm vi hiện tại

Webhook `POST /api/payments/webhooks/sepay` (alias `/api/sepay/ipn`) xác nhận payment
gắn booking khi hold còn hiệu lực. IPN cần xác thực, transaction ID ổn định,
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
khi chạy backend mới. Confirm-sandbox cho booking mới vẫn chưa hoàn thiện.
Hủy trước bàn giao và NO_SHOW dùng cùng API hoàn thủ công, nhưng `amount` chỉ là
tiền thuê; `depositForfeitedAmount` là tiền cọc bị giữ. Xem [policy hủy/NO_SHOW](booking-cancellation-policy.md).
Migration `0034_nosy_hellfire_club.sql` bổ sung snapshot số tiền hoàn và cọc bị giữ;
cần migrate trước khi chạy backend mới. Payment status trả thêm `refund` khi đang
chờ hoàn/đã hoàn; tracking hỗ trợ REFUND_PENDING và thông tin tiền hoàn/cọc.

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
