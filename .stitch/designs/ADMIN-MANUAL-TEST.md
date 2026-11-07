# Test tay — 5 màn hình Admin

## Khởi chạy

Chạy tại root repository trong PowerShell (không cần backend):

```powershell
$env:NEXT_PUBLIC_API_MODE = "mock"
$env:NEXT_PUBLIC_MOCK_DELAY_MS = "0"
bun run --filter web dev
```

Vào `http://localhost:3000/login`, chọn demo Admin hoặc nhập `admin@metastorage.test` / `Demo@123`.

## Màn hình và kết quả mong đợi

1. **SA01** `/system-admin/dashboard`: 6 tài khoản, 5 hoạt động, 1 khóa, 1 FS/FM chưa gán cơ sở. Tổng phân bố role bằng tổng tài khoản; tên cơ sở và số lượng FS/FM khớp SA03. Card/link dẫn đến màn tương ứng.
2. **SA02** `/system-admin/users`: tìm tên/email (có hoặc không dấu), lọc role/trạng thái/cơ sở, đặt lại lọc. Xem chi tiết; chỉnh role/trạng thái → xem lại trước/sau → xác nhận. Hủy/Đóng/Escape không lưu. Lưu không đổi dữ liệu báo không có thay đổi. Thay đổi thực sự cập nhật SA01 và thêm nhật ký SA05; đổi cả role lẫn trạng thái tạo hai sự kiện. Tài khoản đăng nhập thật không bị đổi.
3. **SA03** `/system-admin/facility-assignments`: chỉ có FS/FM, không có Customer/BOM/SA. Gán một cơ sở cho Vũ Hữu Đạt, xem lại và lưu; card chưa gán ở SA01 giảm từ 1 xuống 0. FM có thể chọn nhiều cơ sở. Chọn nhiều cơ sở cho FS phải hiện thông báo chính sách TBD, không tự lưu. Bỏ gán cơ sở vẫn hiển thị tài khoản với nhãn chưa gán.
4. **SA04** `/system-admin/login-history`: lọc ngày `2026-10-08`, role, kết quả; có cả thành công/thất bại. Chi tiết gồm thời gian, tài khoản, role tại sự kiện, IP đã che, thiết bị và kết quả; không có mật khẩu/token hay nút sửa/xóa/chặn IP. Sự kiện đăng nhập là dữ liệu lịch sử mẫu, không thay đổi khi sửa role hiện tại.
5. **SA05** `/system-admin/activity-logs`: lọc người thực hiện/đối tượng/mã, hành động, cơ sở, ngày và kết quả. Chi tiết cho thấy trước/sau, người thực hiện, đối tượng, thời gian, kết quả và ghi chú. Không sửa/xóa được nhật ký. Lọc ngày phải phù hợp múi giờ Việt Nam.

## Kiểm tra chung

- Tìm một từ không tồn tại: hiện trạng thái rỗng và hướng dẫn đặt lại lọc; xuất CSV bị vô hiệu hóa khi không có kết quả. CSV chỉ chứa kết quả đang lọc và không có cột thao tác.
- Tab qua menu, bộ lọc, bảng cuộn và nút. Drawer giữ focus, Escape đóng và trả focus về nút mở.
- Thu nhỏ 360px/768px: mở menu mobile, điều hướng 5 màn; bảng nhiều cột cuộn riêng, không tràn ngang toàn trang; drawer không vượt viewport.
- Trong cửa sổ riêng, không đăng nhập rồi vào route Admin: chuyển đến đăng nhập. Đăng nhập demo Customer/FM/FS/BOM rồi vào route Admin: chuyển đến `/forbidden`.
- Reload trang để khôi phục fixture. Thay đổi mock chỉ tồn tại trong bộ nhớ cache của phiên trang; không lưu API/database/localStorage.

## Phạm vi kiểm chứng

Không chạy E2E. Đã kiểm tra unit, TypeScript, lint, build và ảnh/browser accessibility. Luồng chỉnh sửa/lưu và phân quyền production cần bạn test tay; đây là bản mẫu độc lập, không chứng minh enforcement backend.
