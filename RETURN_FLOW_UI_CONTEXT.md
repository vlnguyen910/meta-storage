# Context tích hợp UI cho flow trả kho

Lưu ngày: 2026-10-30.

Tài liệu lưu lại toàn bộ nội dung đối chiếu UI Web/Mobile với backend trong câu
trả lời trước, để tham khảo khi triển khai. Đây là kết quả đọc code và contract,
chưa kiểm chứng bằng chạy UI trên trình duyệt/thiết bị. Các đề xuất dưới đây chưa
được triển khai trong lượt phân tích hoặc lượt lưu tài liệu này.

Đọc cùng `AGENTS.md` và `RETURN_FLOW_CONTEXT.md`. Khi triển khai cần đối chiếu lại
code hiện tại; các URL/view đề xuất không đồng nghĩa đã tồn tại.

## 1. Kết quả đối chiếu tổng thể

UI chưa nối đủ flow trả kho; phần lớn có thể mở rộng màn hình đang có. Chỉ có
`GET/PUT /api/policy-violation-fees` là endpoint mới; các bước khác dùng API hiện
hữu đã được mở rộng.

Phí vi phạm dùng bảng `policy_violation_fee`, không triển khai cấu hình phí qua
`system_settings`.

## 2. Reservation và appointment cần được thể hiện thế nào?

UI cần phân biệt ba đối tượng:

| Đối tượng | Vai trò trong flow | UI sử dụng |
| --- | --- | --- |
| Reservation | Đặt chỗ, thanh toán và theo dõi nhận kho | Màn đặt kho, thanh toán, biên nhận |
| Appointment | Lịch thực hiện nghiệp vụ: `CHECK_IN`, `CHECK_OUT`, `SUPPORT` | Chọn lịch, FM xác nhận và phân công |
| Rental | Kho thực tế khách đang thuê | Chi tiết kho, yêu cầu trả kho, lịch sử hoàn cọc |

Phần đặt kho hiện đã gọi API reservation và tạo appointment `CHECK_IN` trong
[`booking-checkout.hooks.ts`](apps/web/src/features/reservations/booking-checkout.hooks.ts).

Khi trả kho, UI phải xuất phát từ **`rentalId`**, tạo appointment `CHECK_OUT`.
Reservation được giữ làm lịch sử đặt chỗ; không tạo lại reservation cho lần trả kho.

## 3. Những màn hình hiện có cần sửa

| Màn hình | Hiện trạng trong code | Thay đổi cần làm và lý do |
| --- | --- | --- |
| **Customer — Chi tiết kho** `/customer/storage/[rentalId]` | Hai nút “Trả kho” đều dẫn sang tạo ticket hỗ trợ | Mở form chọn ngày/slot và tạo appointment `CHECK_OUT`. Hiển thị lịch đang chờ xác nhận, đã xác nhận, hoàn tất; tránh gửi yêu cầu trùng |
| **Customer — Danh sách kho/lịch sử** `/customer/storage` | Đã có danh sách rental hiện tại/lịch sử | Sau trả kho cần cập nhật `CLOSED`, thời điểm `closedAt`, điều hướng về chi tiết. Tách “hạn thuê” khỏi “ngày trả thực tế” |
| **FM — Điều phối** `/facility-manager/tasks` | Tab nghiệp vụ hiện chỉ tải appointment `CHECK_IN` | Thêm tab/bộ lọc “Trả kho”, xem yêu cầu `CHECK_OUT`, xác nhận và phân Staff. Trả kho dùng Unit của rental nên không có bước chọn/gán Unit mới |
| **Staff — Danh sách công việc** `/staff/tasks` | Appointment khác `CHECK_IN` vẫn được đưa vào đường dẫn `/staff/check-in`; task tham chiếu appointment bị loại khỏi danh sách task để tránh trùng | Phân nhánh điều hướng theo `appointmentType`. Giữ một mục công việc cho mỗi appointment, đưa `CHECK_OUT` vào giao diện kiểm tra trả kho |
| **Staff — Chi tiết công việc/inspection** | Trang task chung có nút hoàn tất trực tiếp; editor inspection hiện phục vụ check-in | Với task trả kho, mở inspection để ghi checklist/phí và chốt. Hoàn tất task riêng không thực hiện đầy đủ việc đóng rental và tạo hoàn cọc |
| **Customer/FM — Lịch sử thanh toán** | Chủ yếu hiển thị số tiền, trạng thái; chưa phân biệt đầy đủ loại giao dịch | Hiển thị `CHARGE` là khoản thu, `DEPOSIT_REFUND` là hoàn cọc; phân biệt `REFUND_PENDING` và `REFUNDED` để tránh hiểu rằng đã chuyển tiền |
| **FM — Chi tiết rental** `/facility-manager/rentals` | Có rental và payment history | Bổ sung ngày trả thực tế, loại giao dịch hoàn cọc và liên kết xem inspection trả kho |
| **BOM — Phí** `/operations/fees` | API mode chỉ hiển thị trạng thái trống | Triển khai danh mục mã vi phạm, tên, số tiền VND, bật/tắt và lưu phiên bản qua API mới |
| **BOM — Hàng chờ hoàn tiền** `/operations/reports`, tab hoàn tiền | Đã có danh sách và form xác nhận hoàn | Dùng lại, thêm nhãn hoàn cọc và thông tin `reservationId`; hiện bảng/tìm kiếm còn thiên về `bookingId` |

Các vị trí thể hiện rõ khoảng cách hiện tại:

- Nút trả kho mở support:
  [`rental-detail.tsx`](apps/web/src/features/rentals/rental-detail.tsx).
- Danh sách FM chỉ lấy `CHECK_IN`:
  [`use-dispatch.ts`](apps/web/src/features/facility-flow/use-dispatch.ts).
- Staff đưa appointment vào trang check-in:
  [`use-staff-work.ts`](apps/web/src/modules/facility-staff/use-staff-work.ts).
- Trang task chung có hành động hoàn tất:
  [`staff-task-detail-screen.tsx`](apps/web/src/modules/facility-staff/staff-task-detail-screen.tsx).
- Trang phí đang trống:
  [`operations-fees-view.tsx`](apps/web/src/features/operations/components/operations-fees-view.tsx).
- Hàng chờ hoàn tiền hiện có:
  [`operations-reports-hub.tsx`](apps/web/src/features/operations/components/operations-reports-hub.tsx)
  và [`use-operations-refunds.ts`](apps/web/src/features/operations/hooks/use-operations-refunds.ts).

## 4. API cần nối theo thứ tự flow

Tất cả đường dẫn trong bảng dưới đây có tiền tố `/api`.

| Bước / người dùng | API cần nối | Dữ liệu và hành vi UI |
| --- | --- | --- |
| Customer mở kho | `GET /rentals/:rentalId` | Hiện Unit, thời hạn, trạng thái và ngày trả thực tế |
| Customer chọn lịch | `GET /appointments/check-in-slots` | Backend hiện dùng chung danh sách slot cho appointment, dù URL có tên check-in |
| Customer xem lịch trả đã có | `GET /appointments/mine?appointmentType=CHECK_OUT` | Lọc theo `rentalId` trên kết quả; query hiện chưa nhận `rentalId` |
| Customer gửi yêu cầu | `POST /appointments` | Gửi `appointmentType`, `rentalId`, ngày và slot |
| Customer hủy lịch | `PATCH /appointments/:id` | Gửi `status: CANCELLED`; backend kiểm tra thời hạn được hủy |
| FM xem yêu cầu | `GET /appointments/facilities/:facilityId?appointmentType=CHECK_OUT` | Hiển thị lịch trả tại cơ sở đang quản lý |
| FM chọn Staff | `GET /facilities/:facilityId/staff` | Dùng lại danh sách Staff đang hoạt động |
| FM xác nhận/phân công | `PATCH /appointments/:id` | Gửi `status: CONFIRMED`, `assignedStaffId`; backend tạo task |
| Staff mở công việc | `GET /appointments/assigned-to-me` và `GET /facility-tasks/my` | Ghép task qua `referenceType: APPOINTMENT`, `referenceId: appointment.id` |
| Staff bắt đầu | `PATCH /facility-tasks/:taskId` | Gửi `status: IN_PROGRESS` |
| Staff tạo/tiếp tục inspection | `POST /inspections`; `GET /inspections/appointments/:appointmentId` | Tạo bằng `taskId`; tìm lại inspection khi mở lại màn hình |
| Staff xem chi tiết | `GET /inspections/:id` | Lấy checklist, ảnh, `returnContext`, danh mục phí và phí đã lưu |
| Staff lưu/chốt | `PATCH /inspections/:id` | Lưu nháp hoặc chốt bằng `status: PASSED` |
| Customer xem hoàn cọc | `GET /rentals/:rentalId/payments` | Hiện khoản hoàn riêng và trạng thái thực tế |
| FM xem hoàn cọc | `GET /rentals/facility/:facilityId/:rentalId/payments` | Theo dõi lịch sử trong phạm vi cơ sở |
| BOM xác nhận đã chuyển tiền | `GET /payments/refunds`; `POST /payments/:paymentId/refund/confirm` | Dùng hàng chờ hiện có; nhập `reference` sau khi thực tế hoàn tiền |
| BOM quản lý phí | **`GET /policy-violation-fees`; `PUT /policy-violation-fees`** | Đọc danh mục và cập nhật bằng `expectedVersion` |

Ví dụ Customer đặt lịch trả:

```json
{
  "appointmentType": "CHECK_OUT",
  "rentalId": "<rental-id>",
  "scheduledDate": "2026-11-02",
  "slotId": "<slot-id>"
}
```

Customer và cơ sở được backend xác định từ session/rental. UI không cần gửi thêm
các thông tin định danh này.

Hiện API client đã có các hàm appointment, task, inspection và refund cần thiết.
**Còn thiếu hàm client cho `GET/PUT /policy-violation-fees`** trong
[`packages/api-client/src/index.ts`](packages/api-client/src/index.ts).

## 5. Giao diện inspection trả kho cần khác check-in ở đâu?

Có thể dùng lại component checklist, ảnh, ghi chú và trạng thái lưu. Phần điều
phối cần phân nhánh theo `inspectionType`.

| Phần | UI trả kho cần làm |
| --- | --- |
| Unit | Hiển thị Unit backend suy ra từ rental. Tạo inspection bằng `{ taskId }` |
| Đối chiếu nhận kho | Hiện `returnContext.checkIn` ở chế độ chỉ đọc cạnh kết quả kiểm tra mới |
| Checklist | Bắt buộc trả lời đủ mục; cho phép `FAIL` nhưng phải có ghi chú từng mục |
| Phí | Chọn từ `returnContext.penalties`; gửi `violations: [{ code, note }]` và `policyVersion` |
| Tiền cọc/phí/hoàn dự kiến | Hiện cọc từ `returnContext.depositAmount`, phí đã lưu từ `returnContext.fees`; số tính trên UI chỉ là dự kiến |
| Chốt | Dùng nhãn “Chốt trả kho”; gọi PATCH inspection với `status: PASSED` |
| Sau chốt | Hiển thị biên bản chỉ đọc và làm mới appointment/task/rental/Unit/payment |

Editor hiện dùng `HandoverChecklistCompletionSchema` và sau hoàn tất chuyển sang
bước handover tại
[`use-check-in-flow.ts`](apps/web/src/features/facility-flow/use-check-in-flow.ts).
Với trả kho cần dùng **`ReturnChecklistCompletionSchema`**; component checklist
cũng cần thêm ô ghi chú cho mục `FAIL`.

`PASSED` ở CHECK_OUT mang nghĩa đã chốt việc nhận lại kho. Checklist vẫn có thể
chứa vi phạm. Backend hiện chỉ chốt khi:

- `condition: GOOD`;
- tổng phí không vượt cọc;
- task/appointment và quyền Staff hợp lệ.

PATCH chốt đã đóng rental, giải phóng Unit, hoàn tất appointment/task và tạo
khoản hoàn nếu có. UI chỉ cần một hành động chốt nghiệp vụ; endpoint
`/inspections/:id/handover` phục vụ nhận kho.

Khi chính sách phí đã đổi và backend trả `409`, UI cần tải lại mức phí và yêu cầu
Staff kiểm tra trước khi gửi lại.

## 6. Màn hình nào thực sự cần tạo mới?

Đề xuất tối giản là **thêm hai view nghiệp vụ**, có thể đặt trong các trang đang có:

| View cần bổ sung | Vị trí đề xuất | Lý do |
| --- | --- | --- |
| **Đặt lịch trả kho** | Form/dialog trong trang chi tiết rental | Hiện chưa có thao tác tạo `CHECK_OUT`; khách cần chọn ngày/slot và xem kết quả |
| **Kiểm tra và chốt trả kho** | Nhánh trả kho trong workspace Staff, dùng lại checklist/ảnh hiện có | Cần đối chiếu check-in, ghi vi phạm/phí và chốt transaction trả kho |

Các phần còn lại mở rộng trang hiện có:

- FM thêm tab trả kho trong điều phối.
- BOM triển khai danh mục phí tại `/operations/fees`.
- Xác nhận hoàn cọc dùng hàng chờ hoàn tiền đang có.
- Biên bản sau chốt là trạng thái chỉ đọc của inspection.
- Customer theo dõi trả kho và hoàn cọc trong chi tiết rental.

Như vậy chưa có nhu cầu bắt buộc tạo thêm route riêng cho từng bước.

## 7. Những giới hạn dữ liệu cần lưu ý trước khi triển khai UI

Có một số nội dung không thể chỉ nối API rồi hiển thị đầy đủ:

- **Appointment CHECK_OUT chưa có sẵn thông tin Unit như CHECK_IN.** Truy vấn
  hiện lấy `assignedUnit` qua reservation assignment; CHECK_OUT dùng `rentalId`.
  FM có thể bổ sung thông tin từ API rental hiện có. Staff nhận đúng Unit khi tạo
  inspection; nếu muốn hiện trước bước này cần bổ sung dữ liệu phù hợp.
- **Customer chưa có quyền đọc inspection.** Customer hiện xem được lịch trả,
  rental và payment history. Nếu muốn khách xem từng khoản phạt/checklist/biên
  bản thì cần mở rộng response hoặc API có kiểm tra chủ rental.
- **`returnContext` chưa trả ảnh check-in gốc, refund ID hoặc trạng thái refund.**
  Hiện có condition, checklist, ghi chú và thời gian check-in. Không nên thiết
  kế UI dựa trên những trường chưa có.
- **Hàng chờ refund đang hiển thị `paidAt`.** Giao dịch hoàn cọc mới có thể có
  `paidAt: null`; nếu cần “thời điểm tạo yêu cầu hoàn” thì response cần có thời
  điểm tương ứng.

## 8. Phạm vi Mobile

Với Mobile, các thay đổi tương tự nằm ở:

- `CustomerRentalScreen` trong
  [`customer-api-screens.tsx`](apps/mobile/src/features/customer-api/customer-api-screens.tsx).
- [`StaffWorkspace`](apps/mobile/src/features/staff-api/staff-workspace.tsx).
- [`StaffCheckInView`](apps/mobile/src/features/staff-api/staff-check-in-view.tsx).
- Hook [`use-staff-workspace.ts`](apps/mobile/src/features/staff-api/use-staff-workspace.ts).

Workspace Staff hiện mở cùng view check-in cho mọi appointment và còn khai báo
`returnsUnavailable: true`; cần bổ sung nhánh CHECK_OUT dùng API thật.

## 9. Trạng thái kiểm chứng và rủi ro

Chưa chạy UI trên trình duyệt/thiết bị hoặc test runtime; đây là đối chiếu code
và contract. Lượt phân tích không thay đổi file; lượt hiện tại chỉ lưu tài liệu.

Rủi ro chính là tái sử dụng nguyên logic check-in sẽ chặn nhầm CHECK_OUT do thiếu
assignment/payment context hoặc áp sai điều kiện checklist.
