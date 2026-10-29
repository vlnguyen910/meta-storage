# Chuyển từ booking sang reservation và appointment

Backend không còn đăng ký `/api/bookings` hoặc module booking. Web/mobile giữ UI trước commit `2445056`, nối API mới: chọn cơ sở/loại kho → lịch nhận kho/slot → thanh toán xác nhận reservation → FM gán kho và staff → task → inspection/bàn giao. Reservation DRAFT là dữ liệu báo giá nội bộ; appointment được tạo trước thanh toán.

| Nghiệp vụ | API hiện tại |
| --- | --- |
| Tạo đặt kho | POST `/api/reservations/drafts` |
| Thanh toán | POST `/api/reservations/:id/make-payment` |
| Đặt kho của customer | GET `/api/reservations/mine` |
| Chi tiết / hủy | GET / PATCH `/api/reservations/:id` |
| Trạng thái thanh toán | GET `/api/payments/:id/status` |
| Khung giờ | GET `/api/appointments/check-in-slots` |
| Tạo lịch nhận kho | POST `/api/appointments` |
| Lịch của customer / staff | GET `/api/appointments/mine` / `/assigned-to-me` |
| Manager xem lịch | GET `/api/appointments/facilities/:facilityId` |
| Gán kho / xác nhận và giao staff | PATCH `/api/appointments/:id` với `physicalUnitId`, `assignedStaffId`, `status: CONFIRMED` |
| Tạo / khôi phục inspection | POST `/api/inspections` / GET `/api/inspections/appointments/:appointmentId` |
| Bàn giao | POST `/api/inspections/:id/handover` |

## Trang trả về sau thanh toán

SePay trả trình duyệt về `${WEB_URL}/customer/payments/result?paymentId=...&reservationId=...&status=success|error|cancel`.
Với Web local mặc định, URL này ở port 3000. Đây là trang Web, không phải endpoint
`/api/reservations/payment-result` ở port 4000. Backend sẽ hiểu chuỗi cuối URL API
đó là `:id` và từ chối vì không phải UUID.

Trang kết quả đọc GET `/api/payments/:id/status` bằng phiên đăng nhập. Chỉ webhook
đã xác minh hoặc đối soát từ provider mới xác nhận tiền; `status=success` trên URL
không tự cập nhật reservation. URL Web cũ `/customer/reservations/payment-result`
vẫn mở được, và `/reservations/payment-result` chuyển tới trang kết quả hiện tại.

## Demo nhận kho

Chỉ cần `NODE_ENV=develop` hoặc `NODE_ENV=development` rồi khởi động lại API.
Không có biến demo riêng và không thay đổi setting OPENING_HOUR/CLOSING_HOUR.
API cho tạo reservation trong ngày (không nhận ngày quá khứ), dùng slot nhận kho
ngoài giờ hoạt động, thanh toán/đặt appointment khi giờ bắt đầu đã qua và xử lý
check-in trước/sau giờ hẹn. Vì vậy slot demo `20000000-0000-4000-8000-000000000005`
kết thúc gần nửa đêm vẫn sử dụng được. Cron bỏ qua no-show trong môi trường demo.

Các ngoại lệ thời gian appointment chỉ áp dụng CHECK_IN. Chúng không cho bỏ qua
ownership, staff/facility assignment, thanh toán, capacity, loại kho, checklist hoặc
xác nhận khách nhận kho. Không giả lập thanh toán chỉ vì NODE_ENV=develop; phải dùng
webhook/provider đã cấu hình. Test/production tiếp tục kiểm tra thời gian và no-show
bình thường. Web có thể vẫn yêu cầu chọn ngày từ ngày mai; dùng API/Postman để demo
đặt trong ngày, hoặc đặt ngày mai rồi cho staff nhận sớm.

## Triển khai

1. Sao lưu database và dừng API/worker cũ để không phát sinh ghi booking trong lúc chuyển đổi.
2. Chạy `bun run db:migrate` với database đích. Schema commit trước; sau đó dữ liệu
   booking được chuyển trong một transaction riêng. Nếu dữ liệu xung đột, bước
   dữ liệu rollback toàn bộ và lệnh trả lỗi; xử lý lỗi rồi chạy lại trước khi mở API mới.
3. Chỉ khởi động API/worker mới và client mới khi lệnh migrate thành công.
4. Kiểm tra đặt kho, thanh toán, lịch manager/staff và bàn giao theo collection
   [Postman](../apps/api/tests/postman/README.md).

Quá trình giữ nguyên booking nguồn, ID reservation/appointment, số tiền và lịch sử.
Payments, rentals, inspections, support, outbox và task đang hoạt động được nối
sang tham chiếu mới. Chạy lại không đổi trạng thái reservation đã tiếp tục sau
chuyển đổi. Script từ chối số tiền ngoài giới hạn INTEGER VND, thiếu slot, lịch sử
khác nhau hoặc nhiều task đang hoạt động/gán sai staff cho cùng booking.

Không xóa bảng booking và enum lịch sử trong lần chuyển này. Không khởi động lại
code booking cũ sau chuyển đổi: các tham chiếu và trạng thái đã đổi; rollback cần
khôi phục bản sao lưu hoặc một kế hoạch dữ liệu riêng. Client mock/demo cũ được
đặt tên `legacyBookings`/`legacyReservations`; chúng không phải API backend đang hỗ trợ.

Hoàn tiền vẫn là quy trình chuyển khoản và xác nhận thủ công hiện có. Trả kho,
đóng rental và quyết toán cọc là nghiệp vụ riêng; việc chuyển module này không
bổ sung một luồng trả kho mới.
