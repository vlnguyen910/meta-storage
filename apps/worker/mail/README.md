# Email nghiệp vụ

Các file HTML trong `previews/` là bản xem trước với dữ liệu minh họa. Template chạy thực tế nằm tại
`apps/worker/mail/lifecycle-mail.template.ts`, nội dung riêng từng mail tại
`lifecycle-mail.messages.ts`. Màu và kiểu chữ tham chiếu `docs/DESIGN.md`; email dùng
inline styles và font dự phòng Arial để tương thích email client.

- Nhắc hạn: worker kiểm tra mỗi phút, tạo một outbox duy nhất theo rental ID + endAt,
  khi kỳ thuê ACTIVE còn tối đa 7 ngày và chưa hết hạn. Lần chạy đầu cũng xử lý
  kỳ thuê đã vào cửa sổ này. Trước gửi kiểm tra lại trạng thái, email và endAt;
  kỳ thuê đã đóng hoặc thay đổi ngày hết hạn sẽ không nhận mail nhắc cũ.
- Hỗ trợ: thông báo khi đặt lịch hỗ trợ và khi trạng thái lịch thay đổi.
  Module hỗ trợ hiện chưa có thao tác trả lời hoặc đổi trạng thái phiếu riêng.
- Trả kho: thông báo khi yêu cầu lịch, xác nhận hoặc đổi trạng thái lịch trả kho.
- Quyết toán: khi hoàn tất kiểm tra trả kho, cùng transaction đóng kỳ thuê;
  gồm tiền cọc, khấu trừ, hoàn cọc và công nợ.
- Hoàn tiền: khi ghi nhận hoàn cọc hoặc xác nhận hoàn tiền thủ công; không gửi
  mail xác nhận thành công khi khoản tiền mới ở REFUND_PENDING.

Sự kiện nghiệp vụ và outbox được ghi trong cùng transaction. Outbox dùng unique
(eventKey, recipientKey) để chống tạo trùng và cơ chế retry sẵn có của worker.
Không cần migration hay biến môi trường mới. Cần chạy worker với cấu hình Resend.

## Worker sau refactor

Contract dùng chung nằm trong `packages/contracts/src/mail.ts`:
`BOOKING_CONFIRMATION`, `VERIFY_EMAIL` và `RESET_PASSWORD` mang payload đã mã hóa;
`NOTIFICATION` mang `outboxId`.
Worker lấy loại thông báo và nội dung từ outbox, kiểm tra lại quyền nhận mail,
render template rồi gửi qua cùng `MailService` và adapter Resend.

Outbox dispatcher chỉ enqueue vào queue `mail`, không gọi Resend trực tiếp.
BullMQ thử gửi tối đa 5 lần với exponential backoff; job có ID ổn định để không
thêm trùng trong thời gian giữ job. Khi hết lượt thử, outbox chuyển sang
`REVIEW_REQUIRED` ở lần dispatch tiếp theo. Giữ nguyên idempotency key của
provider và giới hạn 24 giờ. Lịch nhắc hạn chạy độc lập với dispatch.

API chỉ enqueue mail tài khoản bằng `MailProducer`; không chứa HTML hoặc gọi
Resend. Fastify sở hữu queue và kết nối producer khi startup, ngắt khi shutdown.
Callback Better Auth dùng contract chung cho loại mail, người nhận, tên và URL.
Job có ID ổn định theo nội dung, payload mã hóa và hạn dùng một giờ; worker từ
chối job sai dữ liệu, bị sửa đổi hoặc quá hạn. API không cần Resend credentials.

Mail nghiệp vụ vẫn ghi outbox trong cùng transaction với thay đổi dữ liệu. Service
hoàn tiền sở hữu transaction; repository chỉ khóa/cập nhật payment, không gọi
callback nghiệp vụ. Không thay đổi schema hoặc API endpoints.

Type mail được suy ra từ Zod schema trong `@metastorage/contracts/mail`.
Producer validate input/envelope trước enqueue; worker validate envelope và payload
sau giải mã. Hai bên dùng enum `MailJobKind`; không tự khai báo lại loại job.
`packages/shared/mail` chỉ giữ helper mã hóa, job ID và thông điệp dùng chung.

Các template được dùng khi gửi mail nằm trực tiếp trong `apps/worker/mail`:
- `auth-mail.messages.ts`: HTML/text xác minh email và reset mật khẩu.
- `booking-mail.template.ts` và `booking-mail.messages.ts`: xác nhận đặt kho.
- `lifecycle-mail.template.ts` và `lifecycle-mail.messages.ts`: thông báo nghiệp vụ.

`src/mail/mail.service.ts` điều phối job và gọi các template này; `previews/`
chỉ chứa bản minh họa, không được đọc khi gửi mail.
