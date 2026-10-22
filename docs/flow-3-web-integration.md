# Flow 3 — tích hợp Web và bàn giao backend

Phạm vi: Web, shared API client và typing response. Không sửa backend, migration,
database demo hoặc ứng dụng Expo. Issue nguồn: #139. Guest dùng magic link theo
quyết định được xác nhận trong phiên làm việc, thay nội dung OTP cũ ở #77.

## Endpoint → giao diện

| Giao diện | API đang sử dụng |
| --- | --- |
| `/customer/storage` | GET rentals/mine, current/history, cursor nguyên cặp |
| `/customer/storage/:id` | GET rental, payments, contracts, return-requests |
| `/customer/storage/:id/return`, `/customer/returns/:id` | GET slots, POST create, PATCH edit, POST cancel; PENDING mới sửa/hủy |
| `/booking/tracking` | Access-link/exchange/revoke hiện có; GET tracking rental/payments/contracts/PDF; chỉ đọc |
| `/facility-manager/returns`, `/staff/returns` | GET facility queue, 20 hồ sơ/lượt, limit/offset; FM staff assignment |
| `/staff/returns/:id` | Confirm, physical-return, inspections save/complete/photos; property; evidence; time-changes |
| `/facility-manager/returns/:id` | Detail/revisions, đọc ảnh, quyết định time-change, refund confirmation trong trường hợp đủ dữ liệu |
| `/facility-manager/check-in?view=assign&bookingId=…` | GET/POST contracts, issue, private PDF; upload không tự issue |
| `/system-admin/return-settings` | Checklist version; facility calendar/operating hours; system settings reminder/review và history |
| `/operations/fees` | System setting OVERDUE_FEE_RATE và history; không nhân bản cấu hình cọc |
| Hộp thông báo Customer/FM | GET notifications, limit/offset; không bịa trạng thái đã đọc |

Các methods mới ở `packages/api-client/src/flow3.ts`, được compose vào centralized
client hiện tại. Không gọi backend rải rác hoặc dùng dữ liệu mock để bù response thiếu.
Response tiền từ PostgreSQL có thể chứa phần `.00`: chỉ bỏ phần thập phân toàn số 0,
không dùng float hoặc làm tròn khoản tiền.

## Phụ thuộc backend — chưa được triển khai trong đợt frontend

### 1. Context hồ sơ FM/FS

Mở rộng GET queue/detail hiện có bằng booking code, mã/loại ô kho, hạn thuê,
tên khách cần cho vận hành và tên nhân viên. DTO phải giới hạn theo quyền actor.
Frontend không gọi rental-detail chỉ dành cho Customer để lấy context FM/FS.
Trong lúc thiếu, hiển thị thông tin có thật và giữ ID kỹ thuật trong phần bổ sung.

### 2. Xem trước quyết toán

POST settlement hiện tính tiền đồng thời đóng rental. Cần contract review không ghi
dữ liệu, có request/version, các khoản FM đề xuất, cọc/rate snapshot, phí quá hạn,
quyền được hoàn, nợ, điều kiện chưa đạt để đóng và thời điểm tài chính sử dụng.
Backend owner chốt phương thức/path và chống stale preview trước khi frontend bật
duyệt. Không tạo client method gọi một endpoint preview chưa tồn tại.

Hiện nút Duyệt quyết toán bị khóa, có giải thích. Kết quả đã ghi nhận được hiển thị
theo revision server. Không coi inspection PASS là đã COMPLETED/CLOSED.

### 3. Số dư hoàn tiền theo từng nguồn

GET detail cần trả số dư cọc và tiền thuê còn được hoàn, cùng tình trạng phân bổ
historical refunds để review khoản hoàn hỗn hợp. Không suy ra số dư bằng công thức
quyết toán ở frontend. Hiện chỉ cho phép xác nhận khoản hoàn một nguồn cọc khi
server xác nhận `unusedRentRefundAmount` bằng 0 và `remainingRefund` dương;
khoản hoàn có tiền thuê vẫn khóa, có giải thích.

Xác nhận refund là ghi nhận chuyển khoản thủ công **đã hoàn tất**, cần reference,
bằng chứng và idempotency key. Không gọi chuyển tiền hoặc gửi email thử thật.

## Kiểm tra tay

Chạy từ root:

```powershell
bun run --filter api dev
bun run --filter web dev
```

Web dùng `NEXT_PUBLIC_API_MODE=api` và base URL local API phù hợp trong môi trường
cục bộ. Không cần clear/seed lại DB để thử đọc dữ liệu. Không mở thêm tiến trình
cùng cổng nếu API 4000 hoặc Web 3000 đang chạy.

Tài khoản demo đã có: `customer@metastorage.vn`, `manager@metastorage.vn`,
`staff@metastorage.vn`, `bom@metastorage.vn`, `admin@metastorage.vn`.
Mật khẩu demo đã được cấu hình trước đợt này: `12345678`.

1. Customer: My Storage → current/history → mở kho → payments/contracts và yêu
   cầu trả. Tạo/sửa/hủy chỉ dùng hồ sơ demo được chỉ định, không dùng hợp đồng thật.
2. Guest: dùng liên kết hợp lệ do môi trường kiểm thử cấp → đọc rental/payment/PDF;
   hết hạn/thu hồi phiên phải mất nội dung riêng tư và có cách xin liên kết mới.
3. FM: chọn đúng cơ sở → queue/tải thêm → phân công → xem hồ sơ/inspection;
   kiểm tra trước/sau và bằng chứng rồi duyệt hoặc từ chối đề xuất sửa giờ.
4. FS: chỉ hồ sơ được giao → xác nhận → thực nhận → checklist/ảnh → hoàn tất;
   nếu FAIL tạo attempt mới; xử lý tài sản và đề xuất sửa giờ qua mục tương ứng.
5. Admin: Cấu hình trả kho → checklist/calendar/reminder; xem version/history;
   thay giờ hoạt động phải xác nhận tác động tới check-in.
6. BOM: Cọc và phí → tỷ lệ quá hạn → lưu và lịch sử. Chính sách cọc vẫn ở trang cũ.

## Kiểm chứng

- Type-check Web, API client, contracts và Mobile để kiểm tra tương thích shared client.
- Biome trên các file sửa; Vitest Web và các case timezone/VND.
- `cd apps/web` rồi `bunx playwright test --config flow3.playwright.config.ts`:
  cần Web đang chạy ở chế độ API; có thể đặt `FLOW3_WEB_URL` để đổi địa chỉ.
  Test này chặn các request `/api/*` bằng fixture, không ghi DB/email/refund thật.
- Kiểm tra đọc bằng API local thật và ảnh desktop/responsive riêng. Test fixture
  xác minh frontend; không thay thế backend integration với database cô lập.

Issue #139 vẫn chưa hoàn thành toàn bộ: Mobile thuộc đợt khác; các phụ thuộc tài
chính/context bên trên cần backend owner xử lý trước nghiệm thu luồng đầy đủ.
