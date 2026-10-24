# UI and Flow Bug Fixes Implementation Plan

**Goal:** Sửa các lỗi UI/UX và điều hướng được ghi nhận ở thông báo cơ sở, phí quá hạn, timeline thuê và kết quả thanh toán.

**Architecture:** Giữ Next.js, TanStack Query và centralized API client. Chỉ chỉnh frontend presentation/state khi đủ bằng chứng; không đổi nghiệp vụ backend. Payment result phải giữ trạng thái booking/payment theo đúng query params và dọn checkout context khi bắt đầu booking mới.

**Tech Stack:** React, Next.js App Router, TanStack Query, Tailwind, React Hook Form, Playwright và axe.

---

### Task 1: Notification panel

- Tạo panel có tiêu đề, icon, trạng thái màu và hành động rõ ràng; giảm chiều cao trên desktop/mobile.
- Kiểm tra connected, reconnecting, unavailable và received.

### Task 2: Overdue rate explanation

- Đổi label/help text để nói rõ đây là tỷ lệ áp trên tiền thuê/số dư nào theo chính sách hiện tại.
- Không thay đổi API calculation; nếu backend chưa xác nhận cơ sở tính, ghi rõ TBD thay vì khẳng định sai.

### Task 3: Staff schedule remaining time

- Bổ sung số ngày/giờ còn lại hoặc đã quá hạn từ `checkInSlotEnd` theo timezone cơ sở.
- Hiển thị trạng thái cùng ngày, quá hạn và loading/error; không đo bằng thời gian trình bày không có timezone.

### Task 4: Rental timeline and payment result

- Căn lại timeline bằng layout hai cột icon/content, tránh text lệch khỏi trục.
- Thêm loading skeleton/overlay phù hợp cho payment result; khóa hành động trong lúc polling.
- Dọn checkout context cũ khi bắt đầu booking mới và khi payment result đã chuyển sang confirmation để không quay nhầm success cũ.

### Task 5: Verification

- Cập nhật test component/Playwright cho các trạng thái trên desktop và 375/390/430px.
- Chạy type-check, Biome file sửa, test liên quan, axe và kiểm tra screenshot sau test.
