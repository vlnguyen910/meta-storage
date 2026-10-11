# Tra cứu booking bằng magic link

Khách mở liên kết trong email xác nhận sau khi thanh toán thành công, không cần tài khoản.
Logic đọc và cấp quyền nằm trong `BookingsService` và `BookingsRepository` hiện có.
Không thêm bảng, cột hay migration; PostgreSQL vẫn là nguồn dữ liệu booking/thanh toán.
Worker tiếp tục sử dụng bảng outbox `booking_confirmation_emails` đã có.

## Luồng và API

1. Worker đọc outbox, tạo token ngẫu nhiên 32 byte và gửi email qua Resend.
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
| `booking:magic:<SHA256(token)>` | `bookingId`, `createdAt`, `expiresAt` | 7 ngày từ lần tạo link đầu tiên |
| `booking:session:<SHA256(sessionToken)>` | `bookingId`, `bookingCode`, `createdAt`, `expiresAt` | 30 phút cố định |
| `booking:delivery:<outboxId>` | `bookingId`, `createdAt`, `expiresAt`, `ciphertext`, `iv`, `tag` | 7 ngày |
| `booking:rate:exchange:<HMAC-SHA256(IP)>` | Số lần exchange trong cửa sổ hiện tại | 60 giây từ lần đầu |
| `booking:email-lock:<outboxId>` | Mã sở hữu lock ngẫu nhiên | 60 giây, gia hạn mỗi 10 giây trong lúc xử lý |

Token magic chỉ tồn tại ở dạng hash trong grant. Bản sao phục vụ retry được mã hóa
AES-256-GCM, khóa dẫn xuất từ `BOOKING_MAGIC_LINK_SECRET`, có AAD ràng buộc booking/outbox.
Retry sử dụng cùng link và deadline; không kéo dài TTL. Counter dùng Lua để tăng và
đặt expiry nguyên tử. Lock dùng compare-and-renew/delete; cập nhật outbox có điều kiện
attempt để worker cũ không ghi đè lần xử lý mới.

Gửi email thất bại không rollback booking/thanh toán; outbox retry tối đa 5 lần rồi FAILED.
Resend dùng `Idempotency-Key: booking-confirmation/<outboxId>`; cửa sổ dedupe của provider
là 24 giờ, không bảo đảm gửi đúng một lần sau mọi sự cố. Không ghi token, cookie, link
hoặc phản hồi lỗi thô của provider vào log/lastError. Redis mất dữ liệu làm các grant/phiên
mất hiệu lực; không có tự cấp lại link hoặc fallback OTP trong phiên bản này.

## Cấu hình

Sao chép `apps/worker/.env.example` thành `.env`, cấu hình DATABASE_URL, REDIS_URL,
PUBLIC_APP_URL và BOOKING_MAGIC_LINK_SECRET (tạo bằng `openssl rand -hex 32`).
Giữ secret ổn định giữa các worker và lần khởi động để khôi phục payload retry.

- Local: `MAIL_PROVIDER=mock` chỉ ghi mã delivery, không gửi email hay in link.
- Gửi thật: `MAIL_PROVIDER=resend`, RESEND_API_KEY và RESEND_FROM_EMAIL với domain đã xác minh.
- Production yêu cầu provider Resend; dùng HTTPS cho web/API. Web/API nên cùng site để
  cookie SameSite=Lax hoạt động. Đặt CORS_ORIGIN và AUTH_TRUSTED_ORIGINS cho đúng web origin,
  NEXT_PUBLIC_API_BASE_URL trỏ tới API, PUBLIC_APP_URL trỏ tới web.
- Giới hạn IP sử dụng IP kết nối Fastify; nếu triển khai sau proxy, cần cấu hình trustProxy
  cho proxy đáng tin cậy trước khi dựa vào IP của khách. Không tin trực tiếp X-Forwarded-For.

## Kiểm tra

Dùng database đã migrate riêng và Redis database riêng, tuyệt đối không dùng production:

```sh
DATABASE_URL="$BOOKING_TEST_DATABASE_URL" bun run --filter api test
bun run --filter web test:e2e --config=playwright.tracking.config.ts
```

Cả hai lệnh cần BOOKING_TEST_DATABASE_URL và REDIS_TEST_URL. Bộ browser test tự chạy
API cổng 4100 và web cổng 3000 ở chế độ API thật, kiểm tra desktop/mobile và axe.
SMTP/Resend thật không được gọi trong test; adapter provider được kiểm tra qua fetch giả.
