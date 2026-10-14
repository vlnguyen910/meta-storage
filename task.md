# Công việc tiếp theo — Booking flow 1

- [x] Chốt quy tắc tính sức chứa: chỉ kho AVAILABLE, xét lịch gán kho và mức chiếm chỗ đồng thời trong khoảng thuê.
- [x] Dùng chung cách tính sức chứa cho tạo draft và bắt đầu payment để tránh lệch kết quả.
- [x] Dọn checkout reservation khỏi SePay gateway và chuyển repository sức chứa sang Drizzle query builder.
- [ ] Cập nhật webhook SePay cho payment gắn trực tiếp với booking: kiểm tra số tiền, xử lý lặp an toàn, chuyển `DRAFT → CONFIRMED` và `HOLD → BOOKING` trong cùng transaction.
- [ ] Triển khai tiền đến sau hold hết hạn: kiểm tra lại chỗ; còn thì xác nhận, hết thì chuyển xử lý hoàn tiền.
- [ ] Bảo vệ endpoint xem trạng thái payment bằng quyền truy cập checkout/booking.
- [ ] Cân nhắc API trả số lượng còn trống theo cơ sở, loại kho và khoảng thời gian thuê.
- [ ] Kiểm thử tích hợp toàn flow: tranh chấp chỗ cuối, retry không gia hạn hold, hold hết hạn, webhook lặp và thanh toán đến muộn.
- [ ] Triển khai hủy trước check-in và NO_SHOW sau slot cuối ngày nhận kho: hoàn tiền thuê, giữ tiền cọc.

Quy tắc đã chốt: tạo hold 10 phút khi bắt đầu payment; retry không gia hạn hold. Hold giữ sức chứa trong khoảng thời gian thuê, chưa gán kho vật lý cụ thể.
