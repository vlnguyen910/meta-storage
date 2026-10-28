# Backend Module Refactor Priorities

Rà soát sơ bộ ngày 2026-10-28, dựa trên cấu trúc backend hiện tại và các quyết định đã chốt khi tinh gọn module `facility-tasks`. Đây là thứ tự ưu tiên để xem xét, không phải yêu cầu phải tách file hoặc xóa bảng theo số dòng.

## Nguyên tắc

- Ưu tiên code dễ đọc, ít endpoint và ít tầng; không thêm abstraction nếu chưa có use case cần nó.
- Giữ nguyên API, quyền truy cập, transaction và dữ liệu lịch sử trong đợt refactor cấu trúc, trừ khi phạm vi thay đổi đã được xác nhận riêng.
- Service điều phối nghiệp vụ; repository xử lý đọc/ghi DB và phần persistence của transaction.
- Tách theo nhóm nghiệp vụ thực sự khác nhau, không tách chỉ vì file dài.
- Trước khi gộp hoặc bỏ bảng, kiểm tra mục đích dữ liệu, vòng đời, nơi đọc/ghi, khóa ngoại, audit và yêu cầu lưu lịch sử. Cập nhật Drizzle schema và `docs/db-diagram.md` cùng nhau khi schema được duyệt.

## Thứ tự module

### 1. Returns

**Lý do ưu tiên:** `returns.service.ts` khoảng 1.432 dòng, `returns.repository.ts` 734 dòng và `returns.routes.ts` 369 dòng. Service hiện xử lý yêu cầu/lịch trả, phân công, kiểm tra và ảnh, ghi nhận thời gian nhận kho, thay đổi lịch, quyết toán, hoàn tiền và cấu hình checklist/phí.

**Hướng refactor:** Giữ route, contract, schema và transaction hiện tại. Tổ chức logic service theo ba nhóm dễ theo dõi:

1. Yêu cầu trả và lịch hẹn: tạo, sửa, hủy, xác nhận, phân công, danh sách và slot.
2. Kiểm tra kho và bằng chứng: bắt đầu/hoàn thành kiểm tra, lưu kết quả, ảnh và tài sản còn lại.
3. Quyết toán và hoàn tiền: điều chỉnh thời gian, preview, tính và chốt quyết toán, xác nhận hoàn tiền.

Chỉ tách repository nếu các nhóm truy vấn có ranh giới rõ và việc tách giúp đọc luồng hơn. Không đổi trạng thái nghiệp vụ hoặc gộp bảng trong cùng bước refactor này.

### 2. Bookings

**Lý do ưu tiên:** `bookings.repository.ts` khoảng 1.207 dòng và `bookings.service.ts` 475 dòng. Booking điều phối nhiều phần như availability, draft, phân kho, phân nhân viên và xác nhận/email. Việc phân nhân viên còn phải tạo task trong cùng transaction.

**Hướng refactor:** Vẽ các luồng từ route đến service/repository trước; nhóm code theo các use case đang trộn trong service. Giữ `assignStaff` làm điểm điều phối và bảo toàn transaction bao gồm cập nhật booking/task. Gửi notification sau commit như hiện tại. Tránh biến booking thành nơi chứa toàn bộ logic payment, facility hay task.

### 3. Payments

**Lý do ưu tiên:** `payments.repository.ts` khoảng 983 dòng và `payments.service.ts` 323 dòng. Đây là luồng tài chính nên lỗi ở trạng thái, webhook, retry hoặc hoàn tiền có thể gây ghi nhận tiền sai hoặc xử lý lặp.

**Hướng refactor:** Trước tiên lập bảng trạng thái và các transaction hiện có. Sau đó tổ chức code theo thao tác thật sự riêng biệt, giữ idempotency và kiểm thử DB cho các trường hợp webhook/retry/refund. Không gộp bảng chỉ vì chúng cùng chứa số tiền hoặc payment ID.

### 4. Reports

**Lý do ưu tiên:** `reports.service.ts` khoảng 454 dòng và `reports.repository.ts` 600 dòng. Module tổng hợp doanh thu, refund, utilization, đối soát và CSV; công thức tài chính và truy vấn khá dày nhưng phần lớn là đọc dữ liệu.

**Hướng refactor:** Làm rõ ranh giới giữa truy vấn, tính toán và xuất CSV; giữ nguyên công thức, phân quyền, giới hạn export và contract. Ưu tiên sau các workflow ghi dữ liệu như returns, bookings và payments.

## Vai trò của module Facility Tasks

Các quyết định đã thống nhất cho task là chuẩn tham khảo về phạm vi: một bảng task với `referenceType`/`referenceId`, endpoint tập trung, cơ sở và quyền lấy từ assignment/session, dùng schema Zod và DTO phân trang chung, còn booking gọi service task để tạo task trong transaction của booking.

Đây là chuẩn về mục tiêu nghiệp vụ, không phải yêu cầu sao chép nguyên trạng cấu trúc nội bộ task. Cần tiếp tục tránh mapping hoặc xử lý lỗi lặp nếu refactor các module tiếp theo cho thấy cách dùng chung đơn giản hơn.

## Giảm số bảng database

Không xếp hạng bảng theo số lượng trước khi xác định chức năng của chúng. Các bảng của returns có thể giữ các sự kiện khác nhau như request, từng lần inspection, bằng chứng, quyết toán, refund và audit; cần xác minh dữ liệu và vòng đời trước khi cân nhắc gộp. Việc dùng một media table chung cũng phải giữ được loại bằng chứng, chủ sở hữu, quyền truy cập và chính sách lưu trữ.

Khi xem xét một nhóm bảng, ghi lại trước:

- ai tạo/đọc/cập nhật bảng và ở endpoint/job nào;
- dữ liệu nào là snapshot, audit hoặc lịch sử bất biến;
- quan hệ khóa ngoại, ràng buộc, transaction và quy tắc xóa;
- liệu hai bảng thật sự có cùng lifecycle hay chỉ cùng một số cột.

Chỉ đề xuất bỏ/gộp bảng khi đã có bằng chứng về chức năng trùng nhau và đã kiểm tra caller, tests, fixtures, migration, schema cùng tài liệu sơ đồ.

## Phạm vi rà soát

Đây là đánh giá ưu tiên ban đầu, tập trung vào kích thước và trách nhiệm của Returns, Bookings, Payments và Reports. Chưa phải audit từng endpoint/caller hoặc xác nhận lỗi runtime trong tất cả module.
