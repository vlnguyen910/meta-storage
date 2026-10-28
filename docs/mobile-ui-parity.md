# Giao diện Expo cho Landing, Customer và Staff

Ứng dụng dùng React Native + NativeWind, lấy bố cục, nội dung và hình minh họa từ web hiện có. Không nhúng WebView. Bảng trên web được trình bày bằng thẻ trên điện thoại; bộ lọc dùng các lựa chọn có thể cuộn ngang. Các khung nội dung rộng hơn được xếp cột trên tablet.

## Điều hướng

- App mở landing trước, kể cả khi đã có phiên đăng nhập.
- Chưa đăng nhập vẫn xem được chi nhánh, thông tin cơ sở, loại kho và giá tháng.
- Khi chọn đặt kho, app giữ cơ sở và loại kho đã chọn, mở đăng nhập rồi tiếp tục bước đặt kho.
- Tài khoản đã đăng nhập mở đúng workspace Customer hoặc Staff qua nút Tài khoản.
- Customer có thanh điều hướng dưới; logo quay về landing. Staff tập trung vào Công việc của tôi, không có sidebar hay dashboard riêng.
- Staff dùng header riêng với tên, cơ sở, thông báo và menu tài khoản; đăng xuất nằm trong menu tài khoản. API thông báo đã được kiểm tra trả 200 cho Staff.
- Màn công việc Staff có tab trạng thái, tìm kiếm và các chip bộ lọc. Bộ lọc ngày/loại công việc mở từ dưới lên, chỉ áp dụng khi nhấn Áp dụng; đóng bảng giữ nguyên bộ lọc trước đó. Việc đang thực hiện được ưu tiên trước, sau đó theo giờ hẹn. Số lượng trên tab chỉ hiện khi dữ liệu đã tải đủ các trang và không có lỗi.
- Nút quay lại trên Android trở về bước trước hoặc landing. Đăng xuất trở về landing.

## Đối chiếu màn hình

| Web | Expo |
| --- | --- |
| Landing: giới thiệu, lợi ích, bảng giá, quy trình thuê, cơ sở, thông tin thuê, footer | `features/landing/landing-screen.tsx` |
| Đăng nhập, đăng ký, quên mật khẩu, xác minh email | `features/auth/` |
| Customer: Tổng quan | `CustomerHomeScreen` trong `features/customer-api/customer-api-screens.tsx` |
| Tìm kho và chi tiết cơ sở, loại kho | `CustomerCatalogScreen`, `FacilityTypes` |
| Đặt kho, chọn ngày/giờ và thời hạn, thanh toán, xác nhận | `CustomerCheckoutScreen`, `CustomerPaymentScreen` |
| Kho của tôi: kho đang thuê, đơn đặt kho, lịch sử | `CustomerRentalsScreen`, `RentalList`, `CustomerBookingsScreen` |
| Chi tiết đơn đặt, QR và hủy đơn | `CustomerBookingScreen` |
| Chi tiết kỳ thuê và các giao dịch booking liên quan | `CustomerRentalScreen` |
| Lịch sử giao dịch | `features/customer-api/customer-transactions-screen.tsx` |
| Hỗ trợ: danh sách, tạo phiếu, chi tiết, phản hồi và ảnh | `CustomerSupportScreen`, `CustomerSupportNewScreen`, `CustomerTicketScreen` |
| Thông báo của Customer/Staff | `features/notifications/notification-screen.tsx` |
| Staff: danh sách booking và việc cơ sở được giao | `features/staff-api/staff-workspace.tsx` |
| Staff: chi tiết và cập nhật việc cơ sở | `StaffTaskView` |
| Staff: xác minh khách, checklist, ảnh hiện trạng, bàn giao | `features/staff-api/staff-check-in-view.tsx` |

Các màn tái sử dụng API client và contracts hiện tại. Link thanh toán vẫn mở trình duyệt theo tích hợp nhà cung cấp; tài liệu dùng chức năng tải/chia sẻ file của thiết bị. Reset mật khẩu qua email tiếp tục dùng trang reset của web theo callback backend hiện có.

## Chạy local

Từ thư mục gốc:

```bash
bun run --filter api dev
bun run --filter web dev
bun run --filter mobile dev
```

API mặc định dùng cổng 4000 và web thanh toán dùng cổng 3000 trên máy đang chạy Expo. Có thể ghi đè bằng `EXPO_PUBLIC_API_BASE_URL` và `EXPO_PUBLIC_WEB_BASE_URL`; các biến Expo này là cấu hình công khai, không chứa secret.

Đăng nhập Expo Go cần địa chỉ `exp://...` của phiên Expo hiện tại trong `AUTH_TRUSTED_ORIGINS` ở cấu hình API local. Dùng đúng địa chỉ máy/cổng đang test; khởi động lại API sau khi đổi cấu hình. Bản app cài đặt dùng scheme `metastorage://` đã có trong backend. Xem [tài liệu Expo của Better Auth](https://better-auth.com/docs/integrations/expo).

Database phải khớp với code dev trước khi kiểm thử API thật. Việc sửa giao diện không tự động migrate, reset hoặc seed dữ liệu.

Đã đồng bộ với cấu trúc rental mới trên dev: dùng `storageUnit`, `endAt` và giao dịch booking. Các API gia hạn, khoản thu và trả kho cũ đã được gỡ trên dev nên mobile không gọi lại các API này. Bộ lọc Trả kho của Staff chỉ hiển thị thông báo chưa khả dụng; không ảnh hưởng booking/task cơ sở.

## Kiểm tra đã chạy

- `bun run --filter mobile check-types`
- `bun run check`
- Xuất bundle Android bằng `expo export --platform android`.
- Kiểm thử giao diện qua Expo web ở chiều rộng 320, 390 và 768 px với API giả lập: landing không ép đăng nhập; Customer mở các tab; Staff bắt đầu/hoàn tất task và bàn giao booking.
- Kiểm tra trực tiếp trên máy ảo Android: landing và đăng nhập Customer/Staff bằng API local. Sau khi migrate và seed DB local mới, API booking/rental Customer và booking/task Staff trả 200. Màn Staff hiển thị thông báo riêng khi API trả kho trả 404.
- Kiểm thử hồi quy Expo web ở 390 px khi chọn loại Trả kho chưa khả dụng: booking/task vẫn hiển thị; bắt đầu/hoàn tất task và check-in/bàn giao vẫn hoạt động; bộ lọc trả kho thông báo chưa khả dụng; không có lỗi trang hoặc tràn ngang. Kiểm thử giả lập không thay thế kiểm thử nghiệp vụ với DB thật.

Chưa xác minh trên thiết bị iOS thật, cổng thanh toán thật hoặc camera/ảnh thực tế.

Kiểm tra lần tinh chỉnh giao diện Staff: 23 test mobile pass; type-check và Biome pass. Expo web ở 320, 390 và 768 px kiểm tra tìm kiếm, áp dụng/hủy bộ lọc, menu tài khoản, thông báo, task và check-in/bàn giao bằng API giả lập; hành động công việc đầu tiên nằm trong màn hình đầu. Máy ảo Android kiểm tra bố cục, bảng lọc, lịch tùy chọn, menu tài khoản, thông báo API thật và nút quay lại hệ thống.
