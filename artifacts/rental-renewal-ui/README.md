# Ảnh kiểm tra UI gia hạn kỳ thuê

Ngày: 2026-10-30.

Chụp màn hình ứng dụng Next.js tại localhost bằng Chromium trực tiếp qua Chrome DevTools Protocol. Không dùng Playwright và không thực hiện E2E thanh toán.

Ảnh dùng dữ liệu minh họa được cấp qua network interception trong một browser profile riêng, không tạo hoặc sửa dữ liệu backend. Customer, rental, đơn giá và các kết quả trong ảnh là fixture phục vụ kiểm tra giao diện; không phải bằng chứng API/SePay đã xử lý thành công.

| Màn hình | Desktop 1440px | Mobile 390px |
| --- | --- | --- |
| Chọn thời lượng | [Ảnh](./desktop-form.png) | [Ảnh](./mobile-form.png) |
| Báo giá | [Ảnh](./desktop-quote.png) | [Ảnh](./mobile-quote.png) |
| Gia hạn thành công | [Ảnh](./desktop-success.png) | [Ảnh](./mobile-success.png) |
| Cần hoàn tiền | [Ảnh](./desktop-refund.png) | [Ảnh](./mobile-refund.png) |

Đã xem ảnh desktop/mobile và kiểm tra chiều rộng document không vượt viewport. Thanh hành động mobile cố định ở cuối viewport, phần nội dung có khoảng trống cuối trang để cuộn qua thanh này.

## Kiểm tra thủ công tiếp theo

1. Đăng nhập Customer → Kho của tôi → Chi tiết kỳ thuê → Gia hạn kỳ thuê.
2. Chọn số tháng, lấy báo giá; đối chiếu số tiền, hạn chót, thời hạn báo giá và hạn thuê dự kiến.
3. Thanh toán sandbox SePay; chỉ xác nhận thành công khi renewal APPLIED và hạn thuê đã được backend cập nhật.
4. Tải lại trước/sau tạo payment; thử tiếp tục từ thiết bị khác qua yêu cầu trong lịch sử, kiểm tra cùng payment và deadline.
5. Kiểm tra hết hạn, lịch trả kho đang mở, thiếu capacity, mất mạng, nhận tiền muộn, REFUND_REQUIRED và REFUNDED.
6. Kiểm chứng gia hạn chính kho đang OCCUPIED khi không có kho trống dự phòng. Kiểm tra này thuộc backend/capacity và chưa được xác minh trong lượt triển khai UI.
7. Kiểm tra booking/reservation checkout hiện có, quyền truy cập giữa hai Customer, bàn phím và viewport tablet.

## Kiểm tra kỹ thuật đã chạy

- `bun run --filter web check-types`: đạt.
- `bun run --filter api check-types`: đạt.
- `bun run --filter web build`: đạt, bao gồm route động `/customer/storage/[rentalId]/renew`.
- `bun run --filter web test src/features/rentals/renewal.test.ts`: đạt 1 test khôi phục và phân biệt mã yêu cầu theo khách/yêu cầu.
- `bun test apps/api/tests/units/sepay-renewal-return.test.ts`: đạt 1 test, 12 assertions cho return URL gia hạn và reservation.
- Biome trên các file thay đổi và `git diff --check`: đạt.

Các kiểm tra này không xác nhận capacity, webhook hoặc giao dịch SePay thật. E2E do người dùng kiểm tra thủ công.
