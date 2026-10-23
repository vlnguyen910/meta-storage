# Kiểm thử Flow 5 trên frontend

## Khởi động local

Chạy tại thư mục gốc dự án (hiện là `metastorage`):

```bash
docker start storex-db metastorage-redis
bun run --filter api dev
```

Terminal khác:

```bash
bun run --filter web dev
```

Frontend: http://localhost:3000. Backend: http://localhost:4000.
`apps/web/.env` sử dụng API mode, `/api` và proxy `http://localhost:4000/api`.
Không cần seed lại để kiểm thử dữ liệu đang có. Seed có thể đặt lại mật khẩu và fixture.

## Màn hình và quyền

| Vai trò | Đường dẫn | Chức năng đã nối API |
| --- | --- | --- |
| FM | `/facility-manager/storage-units` | Danh sách, lọc, phân trang, chi tiết, thêm/sửa ô kho; vào/ra bảo trì và lịch sử |
| FM | `/facility-manager/tasks` | Giao việc, đổi nhân viên, xem chi tiết và lịch sử báo cáo |
| FM | `/facility-manager/staff` | Danh sách nhân viên cơ sở, email/số điện thoại và số booking được giao |
| FS | `/staff/tasks` | Xem việc được giao, gửi báo cáo và đọc lịch sử |
| Admin | `/system-admin/facility-management` | Cơ sở, loại kho, loại kho tại cơ sở, nhân sự và tra cứu ô kho |
| Admin | `/system-admin/facility-assignments` | Phân công và thu hồi nhân sự tại cơ sở |
| BOM | `/operations/facility-management` | Quản lý cơ sở/loại kho/nhân sự theo quyền backend |

FM/FS chỉ chọn được cơ sở được phân công. FS chỉ thấy task của mình.
Admin chọn tài khoản từ danh sách; BOM nhập UUID và vai trò vì API danh sách
tài khoản chỉ cho Admin. Admin/BOM không có nút thêm/sửa ô kho vật lý vì API
hiện chỉ cho FM thực hiện hai thao tác đó.

## Test thủ công FM → FS → FM

1. Đăng nhập FM, mở **Quản lý ô kho**, chọn cơ sở và một ô kho.
2. Thêm/sửa thông tin; thử đưa ô kho đủ điều kiện vào bảo trì với lý do, rồi kết
   thúc bảo trì. Kiểm tra lịch sử. Backend quyết định điều kiện và trả lỗi nếu
   ô kho đang có ràng buộc booking/rental.
3. Mở **Công việc cơ sở**, giao task cho FS cùng cơ sở; có thể gắn ô kho và booking.
4. Đăng xuất, đăng nhập FS, mở **Công việc cơ sở**, chọn task và gửi báo cáo.
5. Đăng nhập lại FM, mở task và kiểm tra lịch sử báo cáo của FS.

Lần kiểm thử thật ngày 23/10/2026 tại HCM-02 đã tạo:

- Ô kho `WEB-F5-VERIFY-20261023`, trạng thái cuối `AVAILABLE`, hai bản ghi lịch sử bảo trì.
- Task `WEB-F5 — Kiểm tra tích hợp HCM-02`, một báo cáo do FS gửi.

Đã đối chiếu trực tiếp PostgreSQL và kiểm tra FM đọc lại báo cáo trên trình duyệt.
Các bản ghi này được giữ lại trong DB local để tiếp tục kiểm thử.
Tài khoản dùng trong lần kiểm thử: `manager.hcm02@metastorage.test` và
`staff.hcm02@metastorage.test`, sử dụng mật khẩu fixture hiện có của DB local.

## Lệnh kiểm tra

```bash
bun run check-types
bun run check
bun run --filter web test
bun run --filter web build
bun run --filter web test:e2e --config flow5.playwright.config.ts
```

E2E Flow 5: **14/14 pass**, gồm desktop/mobile, phân quyền, form validation,
phân trang, lỗi API/retry, xung đột phiên bản, lịch sử bảo trì/báo cáo,
kiểm tra accessibility và ảnh giao diện. Suite dùng API fixture có trạng thái;
không phải 14 ca tích hợp với PostgreSQL thật. Kiểm thử DB thật được mô tả riêng ở trên.
Web unit suite: **109/109 pass** trong lần chạy của tác vụ này.
Admin được kiểm thử bằng fixture vì DB local hiện không có tài khoản Admin;
BOM đã kiểm tra đọc dữ liệu từ API thật.

Regression Flow 2:

```bash
bun run --filter web test:e2e --config flow2.playwright.config.ts
```

Regression Flow 2 lần cuối: **36 pass, 3 fail**. Các ca fail là tải lại nội dung
biên bản khi xung đột phiên bản, và hai ca dashboard BOM/Admin còn kỳ vọng màn hình
chưa sẵn sàng. Chưa sửa hoặc xác nhận baseline cho ba ca này trong tác vụ nối API
Flow 5. Không xem kết quả này là toàn bộ CI đã pass.

Type-check toàn repo (8 workspace có script), Biome và build web đều pass.
GitNexus đánh giá toàn bộ thay đổi đang có trong worktree là `critical`, bao gồm
các thay đổi backend đã có và shell/API client dùng chung. Kết quả graph không
thay thế kiểm thử và không phải kết luận rằng toàn bộ worktree không có rủi ro.

## Giới hạn theo API hiện có

- Gửi báo cáo chưa đánh dấu task hoàn tất. Chưa có API trạng thái thực hiện,
  hoàn tất hoặc FM duyệt báo cáo; giao diện không tự suy ra các trạng thái này.
- Task in tài liệu chỉ giao việc và lưu báo cáo; không tự sinh hợp đồng.
- Bảo trì dùng quyền chuyển trực tiếp của FM theo backend hiện tại.
- API cron local còn báo `Rental lifecycle settings are missing` do thiếu cấu hình
  lifecycle trong DB; server vẫn chạy. Không seed/reset dữ liệu để che lỗi này.

Chưa commit, push hoặc triển khai các thay đổi frontend này.
