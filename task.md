# Công việc tiếp theo — Booking flow 1

- [x] Chốt quy tắc tính sức chứa: chỉ kho AVAILABLE, xét lịch gán kho và mức chiếm chỗ đồng thời trong khoảng thuê.
- [x] Dùng chung cách tính sức chứa cho tạo draft và bắt đầu payment để tránh lệch kết quả.
- [x] Dọn checkout reservation khỏi SePay gateway và chuyển repository sức chứa sang Drizzle query builder.
- [x] Cập nhật webhook SePay cho payment gắn trực tiếp với booking: kiểm tra số tiền, xử lý lặp an toàn, chuyển `DRAFT → CONFIRMED` và `HOLD → BOOKING` trong cùng transaction.
- [x] Triển khai tiền đến sau hold hết hạn: kiểm tra lại chỗ tới hết slot cuối ngày; không thể nhận thì chờ hoàn thủ công toàn bộ tiền thuê + cọc.
- [x] Chỉ tạo draft/payment mới cho ngày nhận kho từ ngày mai theo giờ Việt Nam; retry giữ nguyên hold.
- [x] API admin xem khoản chờ hoàn và xác nhận hoàn thủ công, lưu mã giao dịch, thời gian và người xử lý.
- [x] Bảo vệ endpoint trạng thái payment bằng token checkout trong header hoặc session tài khoản sở hữu booking; không cache.
- [ ] Cân nhắc API trả số lượng còn trống theo cơ sở, loại kho và khoảng thời gian thuê.
- [x] Kiểm thử tích hợp toàn flow: tranh chấp chỗ cuối, retry không gia hạn hold, cron hết hạn, webhook lặp, thanh toán muộn, hoàn thủ công và API gán kho/check-in; email không trùng job.
- [ ] Triển khai hủy trước check-in và NO_SHOW sau slot cuối ngày nhận kho: hoàn tiền thuê, giữ tiền cọc.

Quy tắc đã chốt: tạo hold 10 phút khi bắt đầu payment; retry không gia hạn hold. Hold giữ sức chứa trong khoảng thời gian thuê, chưa gán kho vật lý cụ thể.
