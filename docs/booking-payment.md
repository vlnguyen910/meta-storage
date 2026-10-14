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

## Quy tắc

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

Endpoint này hoàn thành bước bắt đầu payment. Webhook, confirm-sandbox và các reader
legacy chưa chuyển sang hoàn tất payment chỉ có booking ID; không dùng phiên này để
thu tiền thật trước khi triển khai luồng `DRAFT → CONFIRMED`, đối soát và bảo vệ status.
Quy tắc tiền đến sau hold hết hạn đã chốt cho bước webhook tiếp theo: kiểm tra lại
chỗ, còn thì xác nhận, hết thì chuyển xử lý hoàn tiền; chưa triển khai ở endpoint này.

## Kiểm thử

Chạy với PostgreSQL test riêng đã migrate, đặt `DATABASE_URL` bằng
`BOOKING_TEST_DATABASE_URL` và `NODE_ENV=test`:

```sh
bun test apps/api/tests/integration/booking-payment-start.test.ts
```

Test dùng SDK SePay với credential giả để tạo form tại chỗ, không gọi SePay thật,
không cần Redis hoặc worker. Kiểm tra persistence, giá snapshot, ownership, token,
validation, retry đồng thời, hết hạn và hai checkout tranh capacity cuối.
