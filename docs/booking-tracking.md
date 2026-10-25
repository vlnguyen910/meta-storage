> Superseded 2026-10-25: guest access has been removed from the backend. All customer booking/rental access requires an account session. This document records the former design; frontend updates are outside the backend/database change.

# Tra cứu booking bằng magic link

Khách mở liên kết trong email xác nhận sau khi thanh toán thành công, không cần tài khoản.
Logic đọc và cấp quyền nằm trong `BookingsService` và `BookingsRepository` hiện có.
Payment transaction lưu intent email booking khách và snapshot template trong
`notification_outbox`. Worker dispatcher chuẩn bị link/QR, lưu payload mã hóa và
đưa vào queue BullMQ `mail`; callback/API không còn là điều kiện để email được gửi.
`BookingsService` đọc trạng thái durable/job và giữ fallback cho booking/job legacy.
`createBookingTrackingLink` được dùng chung tại `packages/shared/src/booking-access.ts`
(vẫn re-export từ repository để giữ tương thích import); type ở booking-access.types.ts.
Không tạo lại bảng booking_confirmation_emails đã xóa ở migration 0032.

## Luồng và API

1. Transaction xác nhận thanh toán lưu intent cùng business data. Sau commit,
   dispatcher tạo link tra cứu/QR và enqueue job `booking-confirmation` vào queue
   `mail`. Payload mã hóa được giữ trong outbox để retry không đổi nội dung.
   Hạn magic link là 24 giờ tính từ lúc link được tạo. Link cũ có ngày tạo trước
   thay đổi này cũng bị giới hạn hiệu lực 24 giờ khi exchange.
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
   trả 204 kể cả khi cookie không tồn tại. Link vẫn dùng được đến hạn 24 giờ hoặc
   tới lúc khách yêu cầu cấp link mới, tùy mốc nào đến trước.
5. Guest rental access dùng cùng cookie session và booking code:
   `POST /api/booking/access-link` nhận `{ bookingCode, email, idempotencyKey }`.
   Backend chỉ gửi tới contact email khớp booking, luôn trả phản hồi chung 202,
   giới hạn 3 lần/booking/giờ và 10 lần/IP/giờ. Audit idempotency và email outbox
   được ghi cùng transaction; email có thể được retry qua worker.
   `GET /api/booking/tracking/:bookingCode/rental`, `/payments`, `/contracts` và
   `/contracts/:contractId/pdf` yêu cầu cookie session của đúng booking. Chỉ hợp đồng
   `ISSUED` được liệt kê/tải; PDF đi qua backend private storage. Các GET này chỉ đọc,
   không cấp quyền sửa rental. Phiên hợp lệ còn có thể xem yêu cầu trả kho, lấy
   khung giờ và gửi yêu cầu mới qua các endpoint guest trong [returns-api.md](returns-api.md).

Các endpoint có `Cache-Control: no-store`. Link sai/hết hạn hoặc phiên hết hạn trả 401;
truy cập booking khác bằng phiên hợp lệ trả 404; Origin không được phép trả 403;
quá giới hạn trả 429; Redis không khả dụng trả 503, không cấp quyền dự phòng.
Phiên không gia hạn theo mỗi request và chỉ cấp quyền đọc/gửi yêu cầu trả kho cho một booking, không cấp quyền
đăng nhập, thanh toán, hủy đơn hay thao tác quản trị. Ai giữ link đều có quyền xem
booking và gửi yêu cầu trả kho, vì vậy nội dung email nhắc khách không chia sẻ link.

## Dữ liệu Redis

| Key | Giá trị | TTL |
| --- | --- | --- |
| `booking:magic:<SHA256(token)>` | `bookingId`, `createdAt`, `expiresAt` | Phần thời gian còn lại trong 24 giờ từ lúc link được tạo |
| `booking:session:<SHA256(sessionToken)>` | `bookingId`, `bookingCode`, `createdAt`, `expiresAt` | 30 phút cố định |
| `booking:delivery:<deliveryId>` | `bookingId`, `createdAt`, `expiresAt`, `ciphertext`, `iv`, `tag` | Đến deadline cố định của từng link |
| `booking:rate:exchange:<HMAC-SHA256(IP)>` | Số lần exchange trong cửa sổ hiện tại | 60 giây từ lần đầu |
| `booking:magic:active:<bookingId>` | Redis key của grant hiện hành | Đến deadline của link hiện hành |
| `booking:rate:resend:booking:<HMAC>` / `booking:rate:resend:ip:<HMAC>` | Số lần xin link | 1 giờ từ lần đầu |

Token magic chỉ tồn tại ở dạng hash trong grant. Bản sao phục vụ retry được mã hóa
AES-256-GCM, khóa dẫn xuất từ `BOOKING_MAGIC_LINK_SECRET`, có AAD ràng buộc booking ID.
Retry sử dụng cùng link và deadline; không kéo dài TTL. Counter dùng Lua để tăng và
đặt expiry nguyên tử.

BullMQ quản lý lock, trạng thái và retry: tối đa 5 lượt, exponential backoff bắt đầu
5 giây. Job ID `booking-confirmation-<bookingId>` tránh enqueue trùng; giữ job hoàn tất/
thất bại đến hết deadline của link. Intent chưa enqueue trả PENDING; job tồn tại trả QUEUED;
ENQUEUED không được coi là SENT. Chỉ provider success/job hoàn tất mới ghi SENT;
trạng thái durable vẫn đọc được sau khi job được dọn. REVIEW_REQUIRED/SUPPRESSED
ánh xạ FAILED, không có intent/job legacy trả FAILED. Lỗi đọc Redis trả PENDING.
Resend dùng `Idempotency-Key: booking-confirmation/<bookingId>`; cửa sổ dedupe của provider
là 24 giờ, không bảo đảm gửi đúng một lần sau mọi sự cố. Không ghi token, cookie, link
hoặc phản hồi lỗi thô của provider vào log. Redis mất dữ liệu làm job/grant/phiên mất
hiệu lực; không có fallback OTP hoặc gia hạn link. Outbox giữ payload mã hóa để
khôi phục enqueue bằng cùng job/delivery ID và nội dung. Lần thử provider đầu được
lưu trước khi gửi; quá 23h59m khi kết quả chưa rõ thì REVIEW_REQUIRED, không tự gửi lại.
Booking/job cũ vẫn dùng payload/delivery ID cũ; không backfill email booking lịch sử.

## Cấu hình

API cấu hình PUBLIC_APP_URL, BOOKING_MAGIC_LINK_SECRET và QR_TOKEN_SECRET.
API và worker dùng cùng BOOKING_MAGIC_LINK_SECRET (ít nhất 32 ký tự, tạo bằng
`openssl rand -hex 32`) để mã hóa/giải mã payload truyền qua Redis/BullMQ. Giữ secret ổn định
giữa các replica và lần khởi động. Worker cần DATABASE_URL và cùng PUBLIC_APP_URL,
QR_TOKEN_SECRET để chuẩn bị mail từ intent sau khi API đã dừng.
Payload dùng AES-256-GCM với khóa dẫn xuất riêng cho mail, AAD ràng buộc booking ID;
job/outbox không lưu link/token plaintext và inbox không trả payload. Worker chuẩn bị
nội dung đầu vào cho intent mới, giữ các
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

Dùng PostgreSQL và Redis container local hiện có, không tạo database riêng hoặc reset/flush
dữ liệu. Integration fixtures dùng UUID ngẫu nhiên và chỉ cleanup các hàng do test tạo:

```sh
DATABASE_URL="$BOOKING_TEST_DATABASE_URL" bun run --filter api test
bun run --filter web test:e2e --config=playwright.tracking.config.ts
```

Cấu hình `BOOKING_TEST_DATABASE_URL` trùng với `DATABASE_URL` local và `REDIS_TEST_URL`
trỏ tới Redis local. Bộ browser test tự chạy
API cổng 4100 và web cổng 3000 ở chế độ API thật, kiểm tra desktop/mobile và axe.
SMTP/Resend thật không được gọi trong test; test worker dùng mail adapter giả để kiểm tra retry.
