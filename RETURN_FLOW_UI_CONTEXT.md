# Context tích hợp UI Web cho flow trả kho

Cập nhật: 2026-10-30. Tài liệu này ghi trạng thái UI Web sau khi nối các API trả kho; đối chiếu cùng `AGENTS.md`, `docs/DESIGN.md` và `RETURN_FLOW_CONTEXT.md`. Backend/API đã được implement trước lượt UI này; bảng bên dưới mô tả hợp đồng đang dùng, không phải đề xuất endpoint mới.

## 1. Mô hình nghiệp vụ và API

| Đối tượng | Vai trò | UI/API sử dụng |
| --- | --- | --- |
| Reservation | Ghi nhận lần đặt và thanh toán nhận kho | Luồng đặt kho/nhận kho hiện có; không tạo reservation khi trả |
| Appointment | Lịch nghiệp vụ `CHECK_IN`, `CHECK_OUT`, `SUPPORT` | Chọn lịch, điều phối FM, phân công Staff |
| Rental | Kho khách đang thuê | Chi tiết rental, lịch trả, ngày đóng thực tế, payment history của FM |
| Inspection | Biên bản Staff kiểm tra Unit khi trả | Checklist, ảnh, phí, đối chiếu check-in và thao tác chốt |
| Policy fee catalog | Danh mục phí hiện hành của BOM | `GET/PUT /api/policy-violation-fees`, có `expectedVersion` |
| Deposit refund | Nghĩa vụ hoàn cọc được tạo khi chốt | Payment riêng `DEPOSIT_REFUND`; `REFUND_PENDING` chỉ chuyển thành `REFUNDED` sau xác nhận thực tế |

Customer tạo `CHECK_OUT` từ `rentalId`; Customer/facility được backend suy ra. FM xác nhận appointment và gán Staff; backend tạo task `UNIT_INSPECTION` tham chiếu appointment. Staff bắt đầu task rồi tạo/tiếp tục inspection qua `taskId`. Chốt inspection `PASSED` sẽ đóng rental, cập nhật Unit, hoàn tất appointment/task và tạo khoản hoàn cọc nếu số tiền hoàn lớn hơn 0.

## 2. Trạng thái UI Web đã nối API

| Người dùng / màn hình | Hành vi hiện tại |
| --- | --- |
| Customer — tab lịch hẹn trong `/customer/storage?tab=appointments` | Xem lịch FullCalendar mặc định theo tuần, chuyển tháng/ngày; week/day chỉ hiển thị từ giờ mở cửa đến giờ đóng cửa đọc từ System Settings; lọc cơ sở/trạng thái; xem dạng bảng dùng `CustomerTable`; mở chi tiết bằng Sheet. Chỉ hiện thao tác hủy với lịch `SCHEDULED`/`CONFIRMED` còn trước giờ bắt đầu; liên kết về reservation, rental hoặc support ticket khi có reference. |
| Customer — chi tiết kho `/customer/storage/[rentalId]` | Tạo lịch trả theo `rentalId`; lịch trả đang mở đổi nút thành “Hủy yêu cầu”; hủy gửi `status: CANCELLED`; trả trước hạn có bước xác nhận; lỗi tải lịch cho phép retry và không thể gửi khi chưa xác minh lịch/slot. Lịch sử thanh toán không hiển thị trên trang này theo yêu cầu UI. Rental `CLOSED` hiển thị ngày trả thực tế thay cho bộ đếm đến hạn. |
| Customer — danh sách kho `/customer/storage` | Rental `CLOSED` hiển thị thêm ngày trả thực tế cạnh thời hạn thuê; trạng thái tiếp tục dùng `ACTIVE`/`CLOSED` từ API. |
| Customer — form lịch trả | Dialog dùng lịch và slot của luồng đặt kho; hiển thị lịch trả hiện có, trạng thái tải/lỗi, lỗi gửi/hủy và chặn gửi trùng khi đã có lịch `SCHEDULED`/`CONFIRMED`. Ngày có thể chọn từ hôm nay; slot trong ngày đã qua bị khóa, đổi ngày sẽ xóa slot cũ. Backend vẫn là nguồn quyết định cuối cùng cho lịch hợp lệ. |
| FM — điều phối | Danh sách mặc định tải appointment qua `GET /appointments/facilities/:facilityId`, lọc theo `ALL`/`CHECK_IN`/`CHECK_OUT`, có số lượng mỗi loại; Sheet chi tiết hiển thị loại kho hoặc Unit trong hồ sơ thuê. FM xác nhận appointment trả kho và gán Staff bằng `PATCH /appointments/:id`; sau đó backend tạo task Staff. Thẻ trả kho không phụ thuộc reservation, không hiển thị thanh toán `0đ` giả và không yêu cầu phân Unit mới. |
| FM — công việc cơ sở | Dùng `CustomerTable` hiển thị task, loại, nhân viên nhận, trạng thái và đối tượng liên quan; Sheet xem thời gian, người giao, mô tả và context appointment/Unit. Nút “Tạo task” mở form giao việc hiện có trong Dialog. |
| Staff — danh sách việc | Có bộ lọc loại `RETURN`; CHECK_OUT gắn với task qua `referenceType: APPOINTMENT` và mở `/staff/tasks/[taskId]`. Tab điều phối CHECK_OUT cũng điều hướng về danh sách task, không đưa Staff vào luồng check-in. |
| Staff — chi tiết task/inspection | Bắt đầu task, tạo/tiếp tục inspection; đối chiếu thông tin CHECK_IN; hiển thị lịch trả và mã Unit; ghi checklist/ghi chú; thêm/xóa ảnh bằng PATCH inspection; chọn phí từ context; xem tiền cọc và số hoàn dự kiến; lưu nháp hoặc “Chốt trả kho”. Ảnh giới hạn JPEG/PNG/WebP, 3 MB/ảnh và 8 ảnh/biên bản. |
| FM — chi tiết rental | Hiển thị `closedAt`, payment type (`CHARGE`/`DEPOSIT_REFUND`), trạng thái và biên bản trả kho gồm Unit, condition, ghi chú và phí snapshot. |
| BOM — `/operations/fees` | Đọc/sửa danh mục bằng GET/PUT; gửi `expectedVersion`; thêm, xóa, bật/tắt mã phí; kiểm tra item bằng shared Zod schema; xử lý `409` bằng cách yêu cầu tải lại catalog, có xác nhận trước khi bỏ thay đổi chưa lưu. |
| BOM — hàng chờ refund | Tìm kiếm được payment/reservation/booking ID; phân biệt `DEPOSIT_REFUND`; `paidAt` null hiển thị là chưa có thời điểm xác nhận, không diễn đạt `REFUND_PENDING` thành đã hoàn. |

Không tạo route mới cho bước trả kho. Không tạo component cơ sở UI mới; tái sử dụng Button, Card, Dialog, AlertDialog, ErrorState/LoadingState và component ảnh kiểm tra hiện có.

## 3. API/contract Web đang gọi

| Bước | API |
| --- | --- |
| Customer lấy rental | `GET /api/rentals/:rentalId` |
| Customer hiển thị lịch | `GET /api/facilities/operating-hours` trả riêng `openingHour` và `closingHour` |
| Customer tải slot và lịch trả | `GET /api/appointments/check-in-slots`; `GET /api/appointments/mine?appointmentType=CHECK_OUT`, sau đó lọc theo `rentalId` |
| Customer tạo/hủy lịch | `POST /api/appointments` với `appointmentType`, `rentalId`, `scheduledDate`, `slotId`; `PATCH /api/appointments/:id` với `status: CANCELLED` |
| FM đọc/điều phối | `GET /api/appointments/facilities/:facilityId?appointmentType=CHECK_OUT`; `GET /api/facilities/:facilityId/staff`; `PATCH /api/appointments/:id` với `status: CONFIRMED`, `assignedStaffId` |
| Staff đọc/bắt đầu task | `GET /api/appointments/assigned-to-me`; `GET /api/facility-tasks/my`; `PATCH /api/facility-tasks/:taskId` với `IN_PROGRESS` |
| Staff inspection | `POST /api/inspections` với `{ taskId }`; `GET /api/inspections/appointments/:appointmentId`; `PATCH /api/inspections/:id` để lưu checklist/condition/notes/violations/policyVersion/ảnh hoặc chốt `PASSED` |
| Staff ảnh | Cùng PATCH inspection với `addEvidence` hoặc `removeEvidenceIds`; API client có `inspections.upload` và `inspections.removePhoto` |
| BOM phí | `GET /api/policy-violation-fees`; `PUT /api/policy-violation-fees` với `expectedVersion` và các item |
| Chi tiết payment | `GET /api/rentals/facility/:facilityId/:rentalId/payments`; `GET /api/payments/refunds`; xác nhận đã chuyển tiền bằng `POST /api/payments/:paymentId/refund/confirm` ở thao tác sẵn có của hàng chờ |

API client tập trung tại `packages/api-client/src/index.ts`; UI không gọi HTTP trực tiếp.

## 4. Quy tắc backend ảnh hưởng UI

- Lịch `CHECK_OUT` đang mở gồm `SCHEDULED`/`CONFIRMED`; hủy chỉ hợp lệ trước giờ hẹn. UI hiển thị lỗi nếu backend từ chối hủy.
- Task inspection CHECK_OUT phải được gán và bắt đầu trước; backend suy ra Unit từ rental. UI không gửi Unit ID để quyết định Unit trả.
- Checklist trả kho phải đủ kết quả; mục `FAIL` cần ghi chú. Trạng thái `PASSED` là chốt nghiệp vụ nhận lại kho, không có nghĩa checklist không có vi phạm.
- Backend chỉ chốt hiện tại khi `condition: GOOD` và tổng phí không vượt tiền cọc. UI chỉ tính tiền hoàn dự kiến; số cuối cùng do backend tính. Chưa có luồng nợ vượt cọc hoặc đưa Unit hỏng vào bảo trì.
- Phí được lưu snapshot khi áp dụng. Nếu policy version đổi trong lúc Staff đang lập biên bản, API trả `409`; UI tải catalog mới, loại lựa chọn không còn hợp lệ và yêu cầu Staff rà soát trước lần lưu tiếp.
- `REFUND_PENDING` là đang chờ chuyển tiền. UI chỉ hiển thị `REFUNDED` sau xác nhận của người có quyền; không tạo refund 0 đồng.
- Customer chưa có quyền xem inspection; UI khách không dựa vào checklist/fees/ảnh của biên bản. Chi tiết rental khách chủ động không hiển thị lịch sử thanh toán theo yêu cầu.
- API refund queue hiện không cung cấp thời điểm tạo refund riêng trong DTO đang dùng; khi `paidAt` null UI không suy đoán thời gian.

## 5. Component và tái sử dụng

- `BookingSchedulePicker` tại `apps/web/src/features/reservations/booking-schedule-picker.tsx` được tách từ lịch/slot của luồng đặt kho để chia sẻ với dialog trả kho.
- `CustomerAppointmentsView` gom lịch, filter, table và chi tiết cho tab lịch hẹn; FullCalendar xử lý month/week/day view. Thêm `Sheet` theo mẫu shadcn trên Radix Dialog do dự án chưa có panel trượt sẵn.
- `InspectionPhotoCard` trong `features/facility-flow/inspection-screen.tsx` được tái sử dụng ở task trả kho.
- `CustomerTable`, Button, Card, Select, Dialog/Sheet và trạng thái tải/lỗi dùng component/pattern sẵn có. Không tạo component dùng chung hay route mới cho các flow này.

## 6. Phạm vi và kiểm chứng

- Phạm vi triển khai là Web; Mobile không đổi theo yêu cầu hiện tại.
- Đã chạy Web typecheck, Biome và `git diff --check` trong các lượt chỉnh sửa UI.
- Có dữ liệu mock appointment và rental để xem lịch, chi tiết, bộ lọc và dialog trả kho mà không cần API thật.
- Design detector không phát hiện lỗi cơ học mới; có advisory về cỡ chữ 10/11px ở một số nhãn dense đã có từ trước. Các dòng đó không thuộc thay đổi lần này nên chưa mở rộng typography. Playwright/axe không chạy theo yêu cầu; người dùng sẽ tự review các màn Web trên browser ở desktop và viewport hẹp.
