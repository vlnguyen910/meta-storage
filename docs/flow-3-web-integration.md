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
| Chuông trên headbar, `/customer/notifications`, `/facility-manager/notifications` | GET notifications, limit/offset; popup cuộn riêng, trang đầy đủ tải thêm; không bịa trạng thái đã đọc |

Các methods mới ở `packages/api-client/src/flow3.ts`, được compose vào centralized
client hiện tại. Không gọi backend rải rác hoặc dùng dữ liệu mock để bù response thiếu.
Response tiền từ PostgreSQL có thể chứa phần `.00`: chỉ bỏ phần thập phân toàn số 0,
không dùng float hoặc làm tròn khoản tiền.

## Hoàn thiện Web theo PR #149 (issue #148 thay thế #147)

- Queue FM/FS hiển thị context API: khách thuê (kể cả guest), booking, ô kho,
  nhân viên. Detail có liên hệ, cơ sở, hạn thuê và cọc snapshot.
- FM nhập khoản hư hỏng, tiền thuê hoàn ngoại lệ, lý do → POST
  `/return-requests/:id/settlement/preview` → xem tính toán/blockers →
  lấy lại detail và preview → dialog xác nhận cuối → POST settlement.
  Đổi draft/detail hủy preview cũ; có blocker thì không cho duyệt.
- Preview là đọc dữ liệu, loading cục bộ; settlement/refund có global loading,
  chống gửi hai lần, không tự retry giao dịch tài chính.
- Backend chưa ràng buộc settlement với snapshot preview bất biến. Chính sách
  có thể đổi giữa preview và duyệt; giao diện thông báo giới hạn này và hiển thị
  kết quả đã lưu. Frontend không tính phí hoặc tự đổi trạng thái nghiệp vụ.
- Refund dùng `refundSummary` server: số dư cọc/thuê riêng biệt. Chỉ FM xác nhận
  khi request COMPLETED và allocationKnown=true. Phân bổ lịch sử chưa rõ thì chỉ
  hiển thị tổng/lịch sử, khóa xác nhận mới; không suy diễn nguồn tiền.
- Xác nhận refund ghi nhận chuyển khoản thủ công **đã hoàn tất**, cần số tiền
  từng nguồn, reference, bằng chứng và xác nhận. Không gọi chuyển tiền thật.
- SessionStorage lưu lần gửi chưa rõ kết quả theo actor/role/request. Reload
  cùng tab giữ idempotency key nếu payload không đổi. Đối chiếu lịch sử khi
  phục hồi, không gửi lại khoản đã ghi nhận. Không bảo đảm chống trùng đa thiết bị.
- HTTP 409 giữ draft để review lại. Timeout/5xx cần tải lại hồ sơ trước thao tác
  tiếp. Ghi thành công nhưng refresh thất bại có thông báo riêng và khóa ghi tiếp.
  401/403/404 ẩn dữ liệu riêng tư.

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
   Khi đủ điều kiện: nhập số tiền/lý do → Xem trước quyết toán → Rà soát trước
   khi duyệt → Xác nhận duyệt và đóng thuê. Đối chiếu kết quả đã lưu; chỉ ghi nhận
   hoàn tiền sau khi thực sự chuyển khoản xong.
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

Đợt này hoàn thiện phần Web tích hợp API hiện có. Mobile trong issue #139 vẫn
thuộc đợt riêng. Không thay backend, schema, seed hoặc dữ liệu demo.

Kết quả kiểm tra ngày 23/10/2026: type-check Web/API client/contracts/Mobile,
Biome các file thay đổi và 8 ca Vitest đạt. Playwright kiểm tra 14 kịch bản trên
desktop và viewport 375/390/430, gồm axe và ảnh; ca blocker đã được sửa bộ chọn
trùng nội dung dialog và chạy lại đạt. Dialog xác nhận cũng được kiểm tra axe.
Đọc API local thật trên 3 hồ sơ xác nhận queue context, detail và preview đúng contract.
Chưa chạy ghi quyết toán/refund trên DB thật hoặc backend integration với DB cô lập;
kiểm tra thao tác ghi frontend dùng API fixture, không xác nhận đã test thiết bị thật.
