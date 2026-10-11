# Tra cứu booking bằng magic link

Khách mở liên kết trong email xác nhận sau khi thanh toán thành công, không cần tài khoản.
Logic đọc và cấp quyền nằm trong `BookingsService` và `BookingsRepository` hiện có.
PostgreSQL là nguồn dữ liệu booking/thanh toán. Mail dùng trực tiếp BullMQ/Redis,
không có bảng outbox hoặc cron chuẩn bị mail. Migration 0032 xóa bảng
`booking_confirmation_emails` và dữ liệu mail cũ.

## Luồng và API

1. Sau khi transaction xác nhận thanh toán commit, API tạo link tra cứu, link QR và
   enqueue một job `booking-confirmation` vào queue `mail`. Payload được mã hóa.
   Hạn link là 7 ngày tính từ `booking.paidAt`, kể cả khi enqueue/gửi bị chậm.
   Worker giải mã payload, dựng nội dung trong `mail.service.ts` và gửi qua Resend;
   không truy vấn booking hoặc tự cấp link. Mail hết hạn dừng retry và chuyển FAILED.
   Lỗi enqueue được log, không rollback thanh toán. Chấp nhận khoảng trống giữa
   DB commit và enqueue: nếu API dừng tại đó hoặc Redis lỗi, mail có thể không được gửi;
   không có cron tự phục hồi. Replay thanh toán có thể enqueue lại nếu chưa có job.
   Link có dạng `${PUBLIC_APP_URL}/booking/tracking#token=<64 hex>`.
   Fragment không được gửi trong HTTP request hoặc Referer. Trang có referrer policy
   `no-referrer`, không được index, xóa fragment trước khi gọi API.
2. `POST /api/booking/magic-link/exchange`, body `{ "token": "..." }`:
   kiểm tra Origin, giới hạn 30 lần/phút/IP, kiểm tra grant Redis và booking đã thanh toán.
   Trả `{ bookingCode, expiresAt, booking }` trong envelope chuẩn; `booking` dùng cùng DTO
   với GET tracking, lấy từ truy vấn xác minh quyền hiện có. Frontend đưa booking vào
   TanStack Query cache và hiển thị ngay, không gọi thêm GET lúc mở link lần đầu. Đặt cookie
   `metastorage_booking_session`, HttpOnly, SameSite=Lax, Path=/api/booking, Max-Age=1800,
   Secure ở production. Khi có cookie cũ, phiên cũ được thu hồi.
   Token phiên không xuất hiện trong JSON và không được lưu ở localStorage/sessionStorage.
3. Khi refresh trang, lấy lại focus hoặc đến chu kỳ cập nhật 30 giây,
   `GET /api/booking/tracking/:bookingCode` dùng cookie trên:
   chỉ đọc booking được gắn với phiên, truy vấn dữ liệu hiện tại từ PostgreSQL.
   DTO gồm mã/trạng thái booking, tên/địa chỉ cơ sở, loại kho, ca nhận kho, kỳ thuê,
   thông tin liên hệ, giá snapshot và trạng thái/ngày thanh toán.
   Không trả ID tài khoản, phân công nhân viên, token QR, token draft hoặc dữ liệu provider.
4. `POST /api/booking/session/revoke` kiểm tra Origin, xóa phiên Redis và cookie;
   trả 204 kể cả khi cookie không tồn tại. Link gốc vẫn dùng được trong thời hạn 7 ngày.

Các endpoint có `Cache-Control: no-store`. Link sai/hết hạn hoặc phiên hết hạn trả 401;
truy cập booking khác bằng phiên hợp lệ trả 404; Origin không được phép trả 403;
quá giới hạn trả 429; Redis không khả dụng trả 503, không cấp quyền dự phòng.
Phiên không gia hạn theo mỗi request và chỉ cấp quyền đọc một booking, không cấp quyền
đăng nhập, thanh toán, hủy đơn hay thao tác quản trị. Ai giữ link đều có quyền xem
booking, vì vậy nội dung email nhắc khách không chia sẻ link.

## Dữ liệu Redis

| Key | Giá trị | TTL |
| --- | --- | --- |
| `booking:magic:<SHA256(token)>` | `bookingId`, `createdAt`, `expiresAt` | Phần thời gian còn lại trong 7 ngày từ xác nhận |
| `booking:session:<SHA256(sessionToken)>` | `bookingId`, `bookingCode`, `createdAt`, `expiresAt` | 30 phút cố định |
| `booking:delivery:<bookingId>` | `bookingId`, `createdAt`, `expiresAt`, `ciphertext`, `iv`, `tag` | Đến deadline cố định của link |
| `booking:rate:exchange:<HMAC-SHA256(IP)>` | Số lần exchange trong cửa sổ hiện tại | 60 giây từ lần đầu |

Token magic chỉ tồn tại ở dạng hash trong grant. Bản sao phục vụ retry được mã hóa
AES-256-GCM, khóa dẫn xuất từ `BOOKING_MAGIC_LINK_SECRET`, có AAD ràng buộc booking ID.
Retry sử dụng cùng link và deadline; không kéo dài TTL. Counter dùng Lua để tăng và
đặt expiry nguyên tử.

BullMQ quản lý lock, trạng thái và retry: tối đa 5 lượt, exponential backoff bắt đầu
5 giây. Job ID `booking-confirmation-<bookingId>` tránh enqueue trùng; giữ job hoàn tất/
thất bại trong 7 ngày. API ánh xạ trạng thái job sang QUEUED/SENT/FAILED; lỗi đọc Redis
trả PENDING, không có job trả FAILED. Trạng thái mail không phải dữ liệu audit lâu dài.
Resend dùng `Idempotency-Key: booking-confirmation/<bookingId>`; cửa sổ dedupe của provider
là 24 giờ, không bảo đảm gửi đúng một lần sau mọi sự cố. Không ghi token, cookie, link
hoặc phản hồi lỗi thô của provider vào log. Redis mất dữ liệu làm job/grant/phiên mất
hiệu lực; không có tự cấp lại link hoặc fallback OTP trong phiên bản này.

## Cấu hình

API cấu hình PUBLIC_APP_URL, BOOKING_MAGIC_LINK_SECRET và QR_TOKEN_SECRET.
API và worker dùng cùng BOOKING_MAGIC_LINK_SECRET (ít nhất 32 ký tự, tạo bằng
`openssl rand -hex 32`) để mã hóa/giải mã payload truyền qua Redis/BullMQ. Giữ secret ổn định
giữa các replica và lần khởi động. Worker không cần DATABASE_URL, PUBLIC_APP_URL hoặc QR_TOKEN_SECRET.
Payload dùng AES-256-GCM với khóa dẫn xuất riêng cho mail, AAD ràng buộc booking ID;
job không lưu link/token plaintext. API chuẩn bị nội dung đầu vào, worker giữ các
hàm gửi từng loại mail trong cùng `mail/mail.service.ts`.

- Worker chỉ dùng Resend: RESEND_API_KEY và RESEND_FROM_EMAIL với domain đã xác minh.
  Không còn MAIL_PROVIDER hay MockMailAdapter. Gửi thật được kiểm tra trên staging
  khi hoàn thành API flow 1 và nối client; test tự động không gọi Resend.
- Production dùng HTTPS cho web/API. Web/API nên cùng site để
  cookie SameSite=Lax hoạt động. Đặt CORS_ORIGIN và AUTH_TRUSTED_ORIGINS cho đúng web origin,
  NEXT_PUBLIC_API_BASE_URL trỏ tới API, PUBLIC_APP_URL trỏ tới web.
- Giới hạn IP sử dụng IP kết nối Fastify; nếu triển khai sau proxy, cần cấu hình trustProxy
  cho proxy đáng tin cậy trước khi dựa vào IP của khách. Không tin trực tiếp X-Forwarded-For.

Khi triển khai, dừng worker/API phiên bản cũ trước khi migrate và chạy phiên bản mới.
Job sweep cũ trong queue `booking-confirmation-email` không còn được xử lý; có thể
xóa queue cũ sau khi xác nhận không còn producer/worker cũ. Các mail chỉ có trong
bảng bị xóa sẽ không được chuyển tự động sang queue mới.

## Kiểm tra

Dùng database đã migrate riêng và Redis database riêng, tuyệt đối không dùng production:

```sh
DATABASE_URL="$BOOKING_TEST_DATABASE_URL" bun run --filter api test
bun run --filter web test:e2e --config=playwright.tracking.config.ts
```

Cả hai lệnh cần BOOKING_TEST_DATABASE_URL và REDIS_TEST_URL. Bộ browser test tự chạy
API cổng 4100 và web cổng 3000 ở chế độ API thật, kiểm tra desktop/mobile và axe.
SMTP/Resend thật không được gọi trong test; test worker dùng mail adapter giả để kiểm tra retry.
