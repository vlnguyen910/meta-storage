# Flow 4–5: kiểm kê backend và ranh giới triển khai

Mốc rà soát: 17/10/2026, nhánh `feat/flow-1-api-import`, commit `b4003a9`.
Working tree sạch trước rà soát. Đã đối chiếu `origin/dev` sau fetch: không có khác
biệt nội dung trong `apps/api/src/modules`, `packages/contracts/src` và
`packages/database/src/schema` giữa HEAD và dev tại thời điểm kiểm tra.
Đây là kiểm kê source, contracts, schema, tests và issue; không phải nghiệm thu
runtime/database. Không chạy test hoặc migration trong lần lập kế hoạch này.

Kế hoạch riêng: [Flow 4 — bạn](flow-4-backend-plan.md),
[Flow 5 — người thứ hai](flow-5-backend-plan.md).

## 1. Những gì thực sự đã có

Các đường dẫn bên dưới có prefix `/api`. Chỉ đánh dấu API khi có route được đăng
ký qua `apps/api/src/app.ts`; tên method, contract hoặc màn mock chưa đủ.

| Khả năng | Hiện trạng | Hướng xử lý |
|---|---|---|
| `GET /facilities`, `GET /facilities/:facilityId/unit-types` | API public có sẵn; danh sách facility luôn lấy active | Giữ nguyên cho Flow 1. Không dùng public list như danh sách quản trị có inactive |
| `POST /facilities` | Có route, service, repository; BOM/SA được tạo | Tái sử dụng, không tạo API tạo cơ sở thứ hai |
| Đọc chi tiết, list có scope, sửa facility | `FacilitiesService.getFacilityById/listFacilities/updateFacility` và repository đã có; route quản trị tương ứng chưa có | Nối/mở rộng code hiện tại, bổ sung DTO và điều kiện ngừng hoạt động |
| `GET /facilities/my-assignments`, `GET /facilities/:facilityId/staff` | API có sẵn | Dùng lại; kiểm tra assignment hết hạn và role/status hiện tại |
| Gán/thu hồi nhân sự theo facility | Repository `upsertAssignment/deactivateAssignment` có; service list/revoke có; chưa có route ghi và chưa có service orchestration gán hoàn chỉnh | Hoàn thiện module facilities, không viết repository mới trùng chức năng |
| `GET /facilities/:facilityId/bookings`, `GET /bookings/:id/eligible-units` | API có sẵn | Tái sử dụng cho vận hành |
| `POST /bookings/:id/assign-unit`, `POST /bookings/:id/assign-staff` | API có sẵn, quyền ghi FM | Không làm lại trong Flow 5 |
| `GET /bookings/assigned-to-me` | API công việc bàn giao/check-in có sẵn cho FS | Không tạo bảng task tổng quát để thay flow hiện tại |
| Quản lý loại kho | `UnitTypesRepository` có create/read/list/update/delete; chưa có service/route CRUD hoàn chỉnh | Tái sử dụng repository; delete vật lý không mặc định là nghiệp vụ được phép |
| Loại kho được bán tại facility | Bảng `facility_unit_types`, repository upsert/list/setActive/unlink có sẵn | Nối quản trị vào code này; không tạo bảng liên kết khác |
| Quản lý ô kho vật lý | Bảng `storage_units` có; service/repository hiện chủ yếu tính capacity theo kỳ | Bổ sung list/detail/create/update/transition trong module hiện có |
| Tài khoản/role/status | `POST/GET /users`, `GET /users/:id`, `PATCH /users/:id/role`, `PATCH /users/:id/status`, `GET /users/me` có | Dùng lại cho provisioning; không xây bộ CRUD nhân viên riêng |
| Giá/cọc checkout | `BookingsService.createDraft` lấy `unit_types.monthlyPrice`, nhân số tháng; cọc bằng một tháng; lưu snapshot trên booking | Đây là implementation hiện tại, không phải quyết định chính thức về công thức cọc |
| Hoàn tiền thủ công | `GET /payments/refunds`, `POST /payments/:paymentId/refund/confirm` có; BOM/SA | Giữ nguyên; không tạo refund API mới dưới module báo cáo |
| Chính sách giá/cọc/phí | Chưa thấy module config và schema persistence chuyên biệt | Flow 4 bổ sung sau khi chốt policy |
| Dashboard/report/export backend | Chưa có route đăng ký; `dashboard.types.ts` chỉ là contract, BOM UI dùng `operations.mock.ts` | Flow 4 xây query từ DB thật; không dùng mock làm nguồn tài chính |
| Login history/audit administration | Chưa thấy API/bảng chuyên biệt | Ngoài Flow 5 cốt lõi; không mặc định nhận cả M7 |

Nguồn chính: `apps/api/src/app.ts`, các route trong modules
`facilities/users/bookings/payments/rentals`, các service/repository liên quan,
contracts cùng tên, toàn bộ schema và tests integration liên quan.

## 2. Quyết định còn thiếu hoặc dễ hiểu nhầm

1. **Giá/cọc:** [#42](https://github.com/vlnguyen910/metastorage/issues/42) còn mở.
   Chưa chốt global hay facility override, công thức cọc, thời điểm áp dụng và cách
   xử lý draft cũ. Bảng `facility_unit_types` hiện chưa có giá override.
2. **Báo cáo:** [#43](https://github.com/vlnguyen910/metastorage/issues/43) chưa chốt
   ghi nhận doanh thu, cọc bị giữ và thời điểm trừ refund. Comment của issue nhấn
   mạnh không suy ra revenue recognition từ policy hủy/no-show.
3. **Nhân sự:** [#41](https://github.com/vlnguyen910/metastorage/issues/41) chưa chốt
   đầy đủ. DB hiện có unique partial index `facility_assignments_active_user_idx`:
   mỗi user chỉ một assignment active. Không triển khai multi-facility/ca làm việc
   chỉ vì issue #38 đề cập khả năng chuyển context.
4. **Bảo trì:** actor, các transition hợp lệ, xử lý hold/booking/rental đang tồn
   tại phải chốt trước. FM không được dùng API đổi status để làm tắt bàn giao/trả kho.
5. **Quyền gán facility:** issue [#51](https://github.com/vlnguyen910/metastorage/issues/51)
   mô tả SA quản lý membership; FM phân công công việc. Không nhầm hai việc này.
6. **Loại kho dùng chung:** quyền sửa kích thước/type toàn hệ thống và ảnh hưởng
   các unit đang thuê cần chốt. FM của một facility không mặc định được sửa global type.
7. **Ngoài scope:** renewal/overdue execution là Flow 6, support lifecycle là Flow 7.
   Flow 4 có thể khai báo rule đã được xác nhận nhưng không tự xây hai lifecycle này.

Policy hủy/no-show và refund hiện có ở `docs/booking-cancellation-policy.md`
phải được giữ; không đồng nhất nó với trả kho sau khi Rental đã ACTIVE.

## 3. Điểm kỹ thuật cần xử lý trước khi tái sử dụng

- `packages/contracts/src/users.ts` đang re-export User từ database; UsersService
  trả DB User và routes gửi thẳng row. Schema users có `passwordHash`.
  Cần DTO allowlist để không trả trường credential; không coi endpoint có sẵn là
  đã đạt yêu cầu bảo mật chỉ vì tên route đúng.
- Facility/assignment service cũng đang có chỗ trả row/spread row. Khi mở route
  mới, chọn output fields, serialize Date/nullable rõ ràng; không nhân rộng pattern này.
- `findFacilityStaff` chưa áp dụng cùng điều kiện `endedAt` như kiểm tra assignment
  active. Kiểm tra thêm role hiện tại sau khi đổi role user; tránh staff list và
  thao tác assign có hai cách hiểu khác nhau.
- Reporting không được chỉ cộng payment có status SUCCEEDED: payment đã nhận tiền
  có thể chuyển REFUND_PENDING/REFUNDED; có paidAt, refundAmount, refundedAt và
  depositForfeitedAmount để đối chiếu. Webhook retry phải không làm tăng số thu.
- Không dùng `payments.totalAmount` làm doanh thu thuê vì số đó gồm tiền cọc.
- Capacity theo kỳ, số ô OCCUPIED và utilization là các chỉ số khác nhau. Không
  đếm trùng allocation với physical assignment; không khẳng định có utilization
  lịch sử chính xác nếu chưa có lịch sử inventory/status đủ để dựng mẫu số.
- Vẫn còn legacy reservation contracts/schema/method trong repo. Luồng đang chạy
  tạo booking DRAFT trong module bookings; không hồi sinh Reservation lifecycle.

## 4. Chia quyền sở hữu file và tích hợp

| Phần | Chủ trì |
|---|---|
| Rule giá/cọc/phí, tính giá, reports/export, định nghĩa metrics | Người Flow 4 |
| Facility CRUD, physical inventory, type metadata/link, membership và quyền facility | Người Flow 5 |
| `unit_types.monthlyPrice`, facility price override nếu được chốt | Flow 4; Flow 5 không có endpoint ghi giá song song |
| Tạo type mới cần giá khởi tạo | Cùng chốt một contract; không tự đặt giá 0 hoặc để hai nguồn giá |
| Facility dashboard | Flow 4 sở hữu query/metric; Flow 5 tái sử dụng kết quả có facility scope |
| Booking assign-unit/assign-staff, check-in/handover | Giữ owner/module hiện có; chỉ bổ sung kiểm tra cần thiết |
| Schema, `docs/db-diagram.md`, contracts/index, app.ts | Hai người phối hợp; một người generate migration tại một thời điểm |

Thứ tự: chốt permission/metrics/contracts → làm policy/report và inventory/CRUD
song song → nối giá vào createDraft và dashboard vào scope → integration regression.
Không cần chờ toàn bộ Flow 5 xong mới bắt đầu query Flow 4 vì bảng nền đã có.

GitNexus hiện tại: BookingsService HIGH; StorageUnitsRepository và
requireAssignedFacility CRITICAL; FacilitiesService HIGH. Các điểm này đi qua
booking/payment/cron/check-in/inspection. Chạy impact đúng symbol trước sửa và
detect-changes đầy đủ trước commit; graph không thay thế test DB/concurrency.

Tài liệu issue #38 đã closed nhưng không chứng minh dashboard backend hiện hữu.
Các issue M6 #42–48, M5 #39–41, M7 #49–52 đã được đối chiếu; trạng thái issue
không được dùng thay kiểm kê route/service/schema.
