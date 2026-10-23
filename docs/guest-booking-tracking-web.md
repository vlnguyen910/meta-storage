# Guest booking tracking — issue #112

## Phạm vi đã nối

Màn `/booking/tracking` mở từ nút **Tra cứu kho của tôi** trên header công khai.
Khách không cần đăng nhập; mã đặt kho một mình không cấp quyền đọc dữ liệu.
Các method API client đã có được tái sử dụng, không tạo API/backend song song.

| Bước Web | API hiện có |
| --- | --- |
| Nhập mã đặt kho và email | POST `/api/booking/access-link` |
| Mở liên kết email có `#token=…` | POST `/api/booking/magic-link/exchange` |
| Đọc booking bằng cookie phiên guest | GET `/api/booking/tracking/:bookingCode` |
| Xem kho đã bàn giao | GET `/api/booking/tracking/:bookingCode/rental` |
| Lịch sử thanh toán | GET `/api/booking/tracking/:bookingCode/payments` |
| Hợp đồng được phép xem | GET `/api/booking/tracking/:bookingCode/contracts` và `/:contractId/pdf` |
| Kết thúc phiên | POST `/api/booking/session/revoke` |

Response nhận yêu cầu liên kết dùng nội dung chung, không xác nhận booking/email
có tồn tại hay email đã gửi thành công. Worker xử lý outbox và gửi mail. Session
guest chỉ đọc booking tương ứng, không gửi yêu cầu trả/đổi kho hoặc xử lý tài chính.
Nếu chưa bàn giao thì hiển thị booking và giải thích chưa có rental.

## Phần hoàn thiện lần này

- Phiên hết hạn/link sai/kết thúc phiên đều có thể về lại form ngay trên cùng URL.
- Tra cứu lại xóa cache riêng tư, trạng thái lỗi và token/query trong URL.
- Token được bỏ khỏi URL trước khi exchange; không lưu trong localStorage/sessionStorage.
- Khi gửi yêu cầu lỗi, giữ nội dung và cùng idempotency key cho cùng mã/email khi thử lại;
  yêu cầu khác tạo key mới. Không tự retry gửi email.
- Rate-limit có thông báo riêng và không làm mất nội dung form.
- Test cũ của tracking được cập nhật: vào URL trống hiển thị form, không phải lỗi phiên.

## Chạy và test tay

Từ repository root, chạy các tiến trình cần thiết ở terminal riêng:

```powershell
bun run --filter api dev
bun run --filter worker dev
bun run --filter web dev
```

Web dùng `NEXT_PUBLIC_API_MODE=api`, `NEXT_PUBLIC_API_BASE_URL` trỏ tới API hoặc
proxy `/api` được cấu hình. API và worker cần PostgreSQL, Redis, cấu hình mail và
`PUBLIC_APP_URL` đúng địa chỉ Web. Không khởi động thêm tiến trình nếu cổng đã có server.

1. Mở `http://localhost:3000/booking/tracking` bằng phiên guest.
2. Nhập **mã đặt kho** có trên xác nhận và email đã dùng cho booking đã thanh toán.
   API hiện nhận `bookingCode`; UUID booking nội bộ không thay thế mã này.
3. Gửi yêu cầu, mở liên kết từ email. Không cần đăng nhập hoặc nhập OTP.
4. Xem booking, kho đã bàn giao, thanh toán và PDF được phép xem; reload vẫn dùng cookie phiên.
5. Kết thúc phiên: nội dung riêng tư phải biến mất. Chọn Tra cứu lại để mở form.
6. Link sai/hết hạn và chỉ nhập mã trên URL phải không lộ dữ liệu. Thử Tra cứu lại
   ngay trên màn lỗi, không cần reload trình duyệt.

Trong môi trường thật, bước gửi yêu cầu sẽ gửi mail qua worker nếu thông tin hợp lệ.
Không dùng thông tin người khác để thử; kiểm tra log/outbox và cấu hình mail khi
không nhận được email. Quyền Cloudinary hiện tại vẫn có thể chặn đọc PDF; đây là
điều kiện dịch vụ lưu trữ đã ghi trong `docs/google-auth-cloudinary.md`.

## Kiểm chứng tự động

```powershell
bun run --filter web test src/features/booking-tracking/booking-lookup-form.test.tsx
bun run --filter web check-types
# Cần Web đang chạy ở chế độ API:
cd apps/web
bunx playwright test --config booking-tracking.playwright.config.ts
```

Playwright chặn API bằng fixture và không gửi mail, tạo outbox hoặc ghi DB thật.
Có desktop/375/390/430, axe, screenshot, exchange/reload/revoke, lỗi phiên,
nonce khi retry, rate-limit và trường hợp chưa bàn giao. Kiểm tra này xác minh
frontend và API client; không thay thế backend integration với DB/Redis cô lập.
Chưa kiểm chứng gửi email thật hoặc thiết bị vật lý trong đợt này.

Kết quả ngày 23/10/2026: 32 ca Playwright đạt (8 kịch bản × 4 viewport), axe
không có vi phạm tại các trạng thái được kiểm tra; đã xem lại ảnh desktop/mobile.
Hai ca Vitest form lookup, type-check Web/API client/contracts và Biome các file
thay đổi đạt. Backend API không chạy trong lần kiểm tra này nên không ghi nhận
kết quả kiểm chứng live API hoặc giao nhận email thật.
