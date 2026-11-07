# Báo cáo kiểm thử Postman CLI: trả kho, quyết toán cọc và công nợ

Ngày chạy: 30/10/2026. Postman CLI **1.82.0**. Tổng **76 request / 112 assertion / 0 thất bại**; cả hai collection run trả **exit code 0**.

Chạy HTTP thật vào `buildApp()` trên loopback, dùng Better Auth thật, session cookie thật và PostgreSQL riêng đã migrate đến 0019. Seed sẵn ba Rental ACTIVE với CHARGE SUCCEEDED (300.000 VND, trong đó cọc 100.000 VND). Không mock route/service/repository. Không gọi ngân hàng/SePay; tiền hoàn và tiền thu bên ngoài được mô phỏng bằng xác nhận của Staff.

Phase 1 chạy với đồng hồ hiện tại để Customer đặt lịch tương lai. Phase 2 đặt đồng hồ của riêng API test vào 12:15 ngày hẹn để thực hiện task hợp lệ; không thay đồng hồ hệ điều hành. Database thử nghiệm được xóa sau chạy. Không cập nhật database đang vận hành, web hoặc mobile. Báo cáo không được publish lên Postman cloud (`--no-report-events`).

| Kịch bản | Cọc | Khấu trừ | Kết quả thực tế |
|---|---:|---:|---|
| Dư cọc / surplus | 100.000 | 50.000 | Hoàn 50.000, Payment REFUNDED, không Debt, Rental CLOSED, Unit AVAILABLE |
| Vừa đủ / equal | 100.000 | 100.000 | Không tạo refund/Debt, Rental CLOSED, Unit MAINTENANCE |
| Thiếu cọc / debt | 100.000 | 150.000 | Debt 50.000, Rental CLOSED, Unit MAINTENANCE; thu 20.000 rồi 30.000 → PAID |

## Endpoint theo đúng thứ tự chạy

HTTP 4xx bên dưới là kết quả thành công của ca kiểm thử từ chối. Cột thực tế lấy từ response Postman; assertion được lưu trong collection và log. Các số thứ tự khớp tên request trong collection.

| STT | Endpoint | Ca kiểm thử | Mong đợi | Thực tế |
|---:|---|---|---|---|
| 01 | `POST /api/auth/sign-in/email` | Login customer | 200; Đăng nhập thật thành công | **200**; Thành công — PASS |
| 02 | `POST /api/auth/sign-in/email` | Login staff | 200; Đăng nhập thật thành công | **200**; Thành công — PASS |
| 03 | `POST /api/auth/sign-in/email` | Login manager | 200; Đăng nhập thật thành công | **200**; Thành công — PASS |
| 04 | `POST /api/auth/sign-in/email` | Login bom | 200; Đăng nhập thật thành công | **200**; Thành công — PASS |
| 05 | `PUT /api/policy-violation-fees` | BOM updates fee policy | 200; Lưu 3 mức phí theo chính sách BOM | **200**; policyVersion=1 — PASS |
| 06 | `POST /api/appointments/` | surplus: Customer requests return | 201; Tạo yêu cầu CHECK_OUT | **201**; status=SCHEDULED — PASS |
| 07 | `PATCH /api/appointments/:appointmentId` | surplus: FM confirms and assigns Staff | 200; CONFIRMED, gán Staff và tạo task | **200**; status=CONFIRMED — PASS |
| 08 | `POST /api/appointments/` | equal: Customer requests return | 201; Tạo yêu cầu CHECK_OUT | **201**; status=SCHEDULED — PASS |
| 09 | `PATCH /api/appointments/:appointmentId` | equal: FM confirms and assigns Staff | 200; CONFIRMED, gán Staff và tạo task | **200**; status=CONFIRMED — PASS |
| 10 | `POST /api/appointments/` | debt: Customer requests return | 201; Tạo yêu cầu CHECK_OUT | **201**; status=SCHEDULED — PASS |
| 11 | `PATCH /api/appointments/:appointmentId` | debt: FM confirms and assigns Staff | 200; CONFIRMED, gán Staff và tạo task | **200**; status=CONFIRMED — PASS |
| 12 | `PATCH /api/facility-tasks/:taskId` | surplus: Staff starts task | 200; Task IN_PROGRESS | **200**; status=IN_PROGRESS — PASS |
| 13 | `POST /api/inspections` | surplus: Staff creates inspection | 201; Tạo CHECK_OUT inspection | **201**; status=PENDING; ước tính: khấu trừ=0, hoàn=100000, nợ=0 — PASS |
| 14 | `PATCH /api/inspections/:inspectionId` | surplus: Save inspection and applied fees | 200; Lưu checklist và snapshot phí | **200**; status=IN_PROGRESS; ước tính: khấu trừ=50000, hoàn=50000, nợ=0 — PASS |
| 15 | `GET /api/inspections/:inspectionId` | surplus: Read settlement estimate | 200; Khấu trừ/hoàn/nợ đúng mức phí | **200**; status=IN_PROGRESS; ước tính: khấu trừ=50000, hoàn=50000, nợ=0 — PASS |
| 16 | `PATCH /api/inspections/:inspectionId` | surplus: Reject missing settlement confirmation | 409; Chặn hoàn tất khi chưa xác nhận quyết toán | **409**; {'code': 409, 'message': 'Thông tin quyết toán đã thay đổi; kiểm tra lại số tiền và xác nhận trước khi hoàn tất.'} — PASS |
| 17 | `PATCH /api/inspections/:inspectionId` | surplus: Complete return and settlement | 200; PASSED; quyết toán và đóng Rental | **200**; status=PASSED; ước tính: khấu trừ=50000, hoàn=50000, nợ=0 — PASS |
| 18 | `PATCH /api/inspections/:inspectionId` | surplus: Replay completion | 200; Giữ nguyên quyết toán, không tạo trùng | **200**; status=PASSED; ước tính: khấu trừ=50000, hoàn=50000, nợ=0 — PASS |
| 19 | `PATCH /api/inspections/:inspectionId` | surplus: Reject changed completion | 409; Từ chối thay đổi quyết toán đã chốt | **409**; {'code': 409, 'message': 'Thông tin quyết toán đã thay đổi; kiểm tra lại số tiền và xác nhận trước khi hoàn tất.'} — PASS |
| 20 | `GET /api/rentals/:rentalId` | surplus: Customer reads closed Rental | 200; CLOSED; trả snapshot quyết toán | **200**; status=CLOSED; settlement: khấu trừ=50000.00, hoàn=50000, nợ=0 — PASS |
| 21 | `GET /api/storage-units/?facilityId=:facilityId&limit=100` | surplus: FM verifies Unit status | 200; AVAILABLE nếu GOOD; MAINTENANCE nếu có hư hỏng | **200**; total=3; Unit AVAILABLE — PASS |
| 22 | `GET /api/rentals/facility/:facilityId/:rentalId` | surplus: FM reads closed Rental | 200; FM xem được quyết toán của Rental | **200**; status=CLOSED; settlement: khấu trừ=50000.00, hoàn=50000, nợ=0 — PASS |
| 23 | `GET /api/rentals/:rentalId/payments` | surplus: Customer reads payment history | 200; 1 refund nếu dư; 0 refund nếu bằng/thiếu | **200**; records=2; CHARGE:SUCCEEDED, DEPOSIT_REFUND:REFUNDED — PASS |
| 24 | `GET /api/rentals/facility/:facilityId/:rentalId/payments` | surplus: FM reads payment history | 200; FM xem lịch sử thanh toán thuộc chi nhánh | **200**; total=2 — PASS |
| 25 | `GET /api/payments/:paymentId/status` | surplus: Source charge status preserved | 200; CHARGE gốc vẫn SUCCEEDED | **200**; status=SUCCEEDED — PASS |
| 26 | `GET /api/debts?rentalId=:rentalId` | surplus: Staff lists Debt | 200; Chỉ tạo 1 Debt khi phí vượt cọc | **200**; total=0 — PASS |
| 27 | `PATCH /api/facility-tasks/:taskId` | equal: Staff starts task | 200; Task IN_PROGRESS | **200**; status=IN_PROGRESS — PASS |
| 28 | `POST /api/inspections` | equal: Staff creates inspection | 201; Tạo CHECK_OUT inspection | **201**; status=PENDING; ước tính: khấu trừ=0, hoàn=100000, nợ=0 — PASS |
| 29 | `PATCH /api/inspections/:inspectionId` | equal: Save inspection and applied fees | 200; Lưu checklist và snapshot phí | **200**; status=IN_PROGRESS; ước tính: khấu trừ=100000, hoàn=0, nợ=0 — PASS |
| 30 | `GET /api/inspections/:inspectionId` | equal: Read settlement estimate | 200; Khấu trừ/hoàn/nợ đúng mức phí | **200**; status=IN_PROGRESS; ước tính: khấu trừ=100000, hoàn=0, nợ=0 — PASS |
| 31 | `PATCH /api/inspections/:inspectionId` | equal: Reject missing settlement confirmation | 409; Chặn hoàn tất khi chưa xác nhận quyết toán | **409**; {'code': 409, 'message': 'Thông tin quyết toán đã thay đổi; kiểm tra lại số tiền và xác nhận trước khi hoàn tất.'} — PASS |
| 32 | `PATCH /api/inspections/:inspectionId` | equal: Complete return and settlement | 200; PASSED; quyết toán và đóng Rental | **200**; status=PASSED; ước tính: khấu trừ=100000, hoàn=0, nợ=0 — PASS |
| 33 | `PATCH /api/inspections/:inspectionId` | equal: Replay completion | 200; Giữ nguyên quyết toán, không tạo trùng | **200**; status=PASSED; ước tính: khấu trừ=100000, hoàn=0, nợ=0 — PASS |
| 34 | `PATCH /api/inspections/:inspectionId` | equal: Reject changed completion | 409; Từ chối thay đổi quyết toán đã chốt | **409**; {'code': 409, 'message': 'Thông tin quyết toán đã thay đổi; kiểm tra lại số tiền và xác nhận trước khi hoàn tất.'} — PASS |
| 35 | `GET /api/rentals/:rentalId` | equal: Customer reads closed Rental | 200; CLOSED; trả snapshot quyết toán | **200**; status=CLOSED; settlement: khấu trừ=100000.00, hoàn=0, nợ=0 — PASS |
| 36 | `GET /api/storage-units/?facilityId=:facilityId&limit=100` | equal: FM verifies Unit status | 200; AVAILABLE nếu GOOD; MAINTENANCE nếu có hư hỏng | **200**; total=3; Unit MAINTENANCE — PASS |
| 37 | `GET /api/rentals/facility/:facilityId/:rentalId` | equal: FM reads closed Rental | 200; FM xem được quyết toán của Rental | **200**; status=CLOSED; settlement: khấu trừ=100000.00, hoàn=0, nợ=0 — PASS |
| 38 | `GET /api/rentals/:rentalId/payments` | equal: Customer reads payment history | 200; 1 refund nếu dư; 0 refund nếu bằng/thiếu | **200**; records=1; CHARGE:SUCCEEDED — PASS |
| 39 | `GET /api/rentals/facility/:facilityId/:rentalId/payments` | equal: FM reads payment history | 200; FM xem lịch sử thanh toán thuộc chi nhánh | **200**; total=1 — PASS |
| 40 | `GET /api/payments/:paymentId/status` | equal: Source charge status preserved | 200; CHARGE gốc vẫn SUCCEEDED | **200**; status=SUCCEEDED — PASS |
| 41 | `GET /api/debts?rentalId=:rentalId` | equal: Staff lists Debt | 200; Chỉ tạo 1 Debt khi phí vượt cọc | **200**; total=0 — PASS |
| 42 | `PATCH /api/facility-tasks/:taskId` | debt: Staff starts task | 200; Task IN_PROGRESS | **200**; status=IN_PROGRESS — PASS |
| 43 | `POST /api/inspections` | debt: Staff creates inspection | 201; Tạo CHECK_OUT inspection | **201**; status=PENDING; ước tính: khấu trừ=0, hoàn=100000, nợ=0 — PASS |
| 44 | `PATCH /api/inspections/:inspectionId` | debt: Save inspection and applied fees | 200; Lưu checklist và snapshot phí | **200**; status=IN_PROGRESS; ước tính: khấu trừ=150000, hoàn=0, nợ=50000 — PASS |
| 45 | `GET /api/inspections/:inspectionId` | debt: Read settlement estimate | 200; Khấu trừ/hoàn/nợ đúng mức phí | **200**; status=IN_PROGRESS; ước tính: khấu trừ=150000, hoàn=0, nợ=50000 — PASS |
| 46 | `PATCH /api/inspections/:inspectionId` | debt: Reject missing settlement confirmation | 409; Chặn hoàn tất khi chưa xác nhận quyết toán | **409**; {'code': 409, 'message': 'Thông tin quyết toán đã thay đổi; kiểm tra lại số tiền và xác nhận trước khi hoàn tất.'} — PASS |
| 47 | `PATCH /api/inspections/:inspectionId` | debt: Complete return and settlement | 200; PASSED; quyết toán và đóng Rental | **200**; status=PASSED; ước tính: khấu trừ=150000, hoàn=0, nợ=50000 — PASS |
| 48 | `PATCH /api/inspections/:inspectionId` | debt: Replay completion | 200; Giữ nguyên quyết toán, không tạo trùng | **200**; status=PASSED; ước tính: khấu trừ=150000, hoàn=0, nợ=50000 — PASS |
| 49 | `PATCH /api/inspections/:inspectionId` | debt: Reject changed completion | 409; Từ chối thay đổi quyết toán đã chốt | **409**; {'code': 409, 'message': 'Thông tin quyết toán đã thay đổi; kiểm tra lại số tiền và xác nhận trước khi hoàn tất.'} — PASS |
| 50 | `GET /api/rentals/:rentalId` | debt: Customer reads closed Rental | 200; CLOSED; trả snapshot quyết toán | **200**; status=CLOSED; settlement: khấu trừ=150000.00, hoàn=0, nợ=50000 — PASS |
| 51 | `GET /api/storage-units/?facilityId=:facilityId&limit=100` | debt: FM verifies Unit status | 200; AVAILABLE nếu GOOD; MAINTENANCE nếu có hư hỏng | **200**; total=3; Unit MAINTENANCE — PASS |
| 52 | `GET /api/rentals/facility/:facilityId/:rentalId` | debt: FM reads closed Rental | 200; FM xem được quyết toán của Rental | **200**; status=CLOSED; settlement: khấu trừ=150000.00, hoàn=0, nợ=50000 — PASS |
| 53 | `GET /api/rentals/:rentalId/payments` | debt: Customer reads payment history | 200; 1 refund nếu dư; 0 refund nếu bằng/thiếu | **200**; records=1; CHARGE:SUCCEEDED — PASS |
| 54 | `GET /api/rentals/facility/:facilityId/:rentalId/payments` | debt: FM reads payment history | 200; FM xem lịch sử thanh toán thuộc chi nhánh | **200**; total=1 — PASS |
| 55 | `GET /api/payments/:paymentId/status` | debt: Source charge status preserved | 200; CHARGE gốc vẫn SUCCEEDED | **200**; status=SUCCEEDED — PASS |
| 56 | `GET /api/debts?rentalId=:rentalId` | debt: Staff lists Debt | 200; Chỉ tạo 1 Debt khi phí vượt cọc | **200**; total=1 — PASS |
| 57 | `GET /api/debts/:debtId` | Customer reads own unpaid Debt | 200; UNPAID; còn 50.000 VND | **200**; status=UNPAID; remainingAmount=50000; paidAmount=0.00; receipts=0 — PASS |
| 58 | `GET /api/debts?status=UNPAID` | FM lists unpaid Debt | 200; 1 Debt UNPAID | **200**; total=1 — PASS |
| 59 | `GET /api/debts/:debtId` | Outsider cannot read Debt | 404; Không tiết lộ Debt của khách khác | **404**; {'code': 404, 'message': 'Không tìm thấy công nợ.'} — PASS |
| 60 | `GET /api/debts` | Anonymous cannot list Debt | 401; Yêu cầu đăng nhập | **401**; {'code': 401, 'message': 'Bạn cần đăng nhập để thực hiện thao tác này'} — PASS |
| 61 | `POST /api/debts/:debtId/payments` | FM cannot collect Debt | 403; FM chỉ theo dõi, không thu nợ | **403**; {'code': 403, 'message': 'Bạn không có quyền thực hiện thao tác này'} — PASS |
| 62 | `POST /api/debts/:debtId/payments` | Unassigned Staff cannot collect Debt | 403; Chặn Staff chưa được phân công tại chi nhánh | **403**; {'code': 403, 'message': 'Bạn không có quyền truy cập cơ sở này'} — PASS |
| 63 | `POST /api/debts/:debtId/payments` | Transfer requires reference | 400; Chuyển khoản phải có mã tham chiếu | **400**; {'code': 400, 'message': 'body/reference Cần cung cấp mã giao dịch hoặc bằng chứng đã hoàn tiền.', 'details': [{'field': 'reference', 'message': 'Cần cung cấp mã giao dịch hoặc bằng chứng đã hoàn tiền.'}]} — PASS |
| 64 | `POST /api/debts/:debtId/payments` | Staff collects partial payment | 200; Thu 20.000; PARTIALLY_PAID; còn 30.000 | **200**; status=PARTIALLY_PAID; remainingAmount=30000; paidAmount=20000.00; receipts=1 — PASS |
| 65 | `GET /api/debts?status=PARTIALLY_PAID` | FM filters partially paid Debt | 200; Lọc được 1 Debt PARTIALLY_PAID | **200**; total=1 — PASS |
| 66 | `GET /api/debts?limit=1&offset=1` | Debt pagination retains total beyond last page | 200; Trang rỗng, total vẫn bằng 1 | **200**; total=1 — PASS |
| 67 | `POST /api/debts/:debtId/payments` | Replay partial receipt | 200; Không ghi thêm receipt | **200**; status=PARTIALLY_PAID; remainingAmount=30000; paidAmount=20000.00; receipts=1 — PASS |
| 68 | `POST /api/debts/:debtId/payments` | Reject conflicting receipt key | 409; Từ chối cùng key nhưng khác số tiền | **409**; {'code': 409, 'message': 'Thông tin khoản thu không khớp với giao dịch đã ghi nhận.'} — PASS |
| 69 | `POST /api/debts/:debtId/payments` | Reject overpayment | 409; Không cho thu 30.001 khi còn 30.000 | **409**; {'code': 409, 'message': 'Số tiền thu vượt quá công nợ còn lại.'} — PASS |
| 70 | `POST /api/debts/:debtId/payments` | Staff collects final transfer | 200; Thu 30.000; PAID; còn 0; tổng 2 receipt | **200**; status=PAID; remainingAmount=0; paidAmount=50000.00; receipts=2 — PASS |
| 71 | `GET /api/payments/:paymentId/status` | Customer reads debt receipt status | 200; Payment DEBT_COLLECTION, SUCCEEDED | **200**; status=SUCCEEDED — PASS |
| 72 | `GET /api/rentals/:rentalId/payments` | Customer payment history includes both receipts | 200; Lịch sử có đủ 2 receipt thu nợ | **200**; records=3; CHARGE:SUCCEEDED, DEBT_COLLECTION:SUCCEEDED, DEBT_COLLECTION:SUCCEEDED — PASS |
| 73 | `GET /api/reports/revenue?facilityId=:facilityId&unitTypeId=:unitTypeId&from=2026-10-30&to=2026-10-31` | FM revenue includes debt cash | 200; Cash received = 350.000; không tính thu cọc lần nữa | **200**; total=1; cashReceived=350000.00; depositForfeited=100000.00; pendingRefundCount=0 — PASS |
| 74 | `GET /api/reports/revenue/monthly?facilityId=:facilityId&unitTypeId=:unitTypeId&from=2026-10-30&to=2026-10-31` | FM monthly revenue | 200; HTTP 200; số liệu thu nợ trong báo cáo tháng | **200**; cashReceived=350000.00 — PASS |
| 75 | `GET /api/reports/overview?facilityId=:facilityId&unitTypeId=:unitTypeId&from=2026-10-30&to=2026-10-31` | FM overview | 200; HTTP 200; báo cáo tổng quan có thu nợ và kho bảo trì | **200**; total=1; cashReceived=350000.00; depositForfeited=100000.00; pendingRefundCount=0 — PASS |
| 76 | `GET /api/payments/refunds` | BOM pending refund queue excludes completed refund | 200; Không đưa refund đã hoàn tất vào hàng chờ | **200**; records=0 — PASS |

## Logic mã giả và module tham gia

```text
BOM cập nhật chính sách phí
  InspectionsService.updatePolicyCatalog
    → InspectionsRepository.updatePolicyCatalog
    → Khóa catalog, kiểm tra phiên bản, lưu mức phí/phiên bản mới.

Customer gửi yêu cầu trả kho: POST /appointments
  AppointmentsService.scheduleAppointment
    → CheckInSlotsService + FacilitiesService: kiểm tra lịch/cơ sở/giờ hoạt động.
    → RentalsService.requireAppointmentContext → RentalsRepository:
        kiểm tra Rental thuộc Customer, còn ACTIVE, không có gia hạn đang thanh toán.
    → AppointmentsRepository: tạo CHECK_OUT SCHEDULED, chống yêu cầu đang mở trùng.

FM xác nhận và phân công: PATCH /appointments/:id
  AppointmentsService.updateAppointment
    → FacilityAssignmentsService: kiểm tra quyền FM và Staff còn được phân công.
    → AppointmentsRepository: khóa lịch hẹn, kiểm tra slot, lưu CONFIRMED/assignedStaff.
    → FacilityTasksService/Repository: tạo task theo APPOINTMENT.

Staff bắt đầu task: PATCH /facility-tasks/:id
  FacilityTasksService.update → FacilityTasksRepository
    → Kiểm tra đúng Staff, phân công đang hoạt động, thời gian và trạng thái hợp lệ.
    → ASSIGNED → IN_PROGRESS.

Staff tạo/lưu inspection: POST /inspections; PATCH /inspections/:id
  InspectionsService.create/update
    → AppointmentsService.requireInspectionContext: khóa và kiểm tra ngữ cảnh lịch hẹn/Rental.
    → FacilityAssignmentsService + FacilityTasksRepository: đúng Staff và task đang làm.
    → InspectionsRepository: lấy Unit từ Rental; lưu condition/checklist/notes.
    → replaceInspectionFees: đối chiếu catalog/phiên bản, snapshot code/tên/giá phí.
    → MediaAssetsService/Repository: quản lý bằng chứng nếu có.
    → Kho hỏng vẫn được ghi nhận; checklist FAIL phải có ghi chú.

Staff xem quyết toán dự kiến: GET /inspections/:id
  InspectionsService.returnContext → InspectionsRepository
    khấu_trừ = tổng phí snapshot
    hoàn = max(cọc - khấu_trừ, 0)
    nợ = max(khấu_trừ - cọc, 0)

Staff xử lý tiền bên ngoài và xác nhận hoàn tất: PATCH /inspections/:id
  InspectionsService.update → completeReturn
    BẮT ĐẦU TRANSACTION (InspectionsRepository.transaction)
      Khóa/kiểm tra lịch hẹn, Rental, inspection, task và CHARGE gốc.
      Kiểm tra checklist đầy đủ, condition, quyền Staff.
      Đọc phí snapshot; kiểm tra settlement.confirmed và tổng phí khách xác nhận.
      Nếu không khớp → 409, ROLLBACK.
      Nếu hoàn > 0:
        yêu cầu xác nhận refund; CASH hoặc BANK_TRANSFER + reference.
      InspectionsRepository.closeRental: ACTIVE → CLOSED, ghi closedAt.
      StorageUnitsService.completeReturn → StorageUnitsRepository.completeReturn:
        đóng assignment; xác nhận không còn thuê/assignment khác;
        GOOD → AVAILABLE, có hư hỏng → MAINTENANCE.
      InspectionsRepository.createReturnSettlement:
        lưu cọc, tổng khấu trừ, CHARGE nguồn, Staff, thời điểm; một bản/Rental.
      Nếu hoàn > 0:
        createDepositRefund → DEPOSIT_REFUND / REFUNDED,
        lưu số tiền, phương thức, reference, refundedBy/refundedAt.
      Nếu nợ > 0:
        createDebt → originalAmount = nợ, paidAmount = 0, status = UNPAID.
      Nếu cả hai = 0: không tạo Payment hoặc Debt bằng 0.
      AppointmentsService.completeHandover → FacilityTasksService/Repository:
        hoàn thành lịch hẹn và task.
      InspectionsRepository.update: inspection PASSED.
    COMMIT
    Gửi lại cùng xác nhận → assertReturnReplay, trả kết quả cũ.
    Gửi lại xác nhận tài chính khác → 409, không sửa lịch sử.

Customer/FM xem quyết toán và công nợ
  RentalsService.getCustomerRental/getFacilityRental → RentalsRepository:
    trả snapshot settlement và lịch sử Payment, bao gồm Rental CLOSED.
  PaymentsService.listDebts/getDebt → PaymentsRepository:
    Customer chỉ xem nợ của mình;
    Staff/FM chỉ xem chi nhánh có phân công đang hoạt động.
  FacilityAssignmentsService đảm nhiệm phân quyền chi nhánh.

Customer trả nợ bên ngoài; Staff ghi nhận: POST /debts/:id/payments
  PaymentsService.collectDebt
    BẮT ĐẦU TRANSACTION (PaymentsRepository.transaction)
      Tìm Debt/Rental/chi nhánh; khóa phân công Staff qua FacilityAssignmentsService.
      PaymentsRepository.lockDebt: SELECT FOR UPDATE.
      Tìm receipt theo idempotencyKey:
        cùng Debt/số tiền/phương thức/reference/Staff → trả kết quả cũ.
        khác dữ liệu → 409.
      Nếu số tiền > số dư → 409; không ghi Payment.
      insertDebtPayment: DEBT_COLLECTION / SUCCEEDED,
        lưu số tiền thực nhận, method, reference, recordedBy, paidAt.
      updateDebt: cộng paidAmount; còn dư → PARTIALLY_PAID; hết dư → PAID.
      Không mở lại Rental; không đổi trạng thái Unit khi thu nợ.
    COMMIT

FM xem báo cáo
  ReportsService.revenue/monthlyRevenue/overview → ReportsRepository:
    tính DEBT_COLLECTION thành tiền thực thu;
    khoản khấu trừ vào cọc tối đa bằng cọc, phần vượt là Debt;
    không ghi nhận lại tiền cọc như một khoản thu mới.

```

## Bằng chứng và chạy lại

- Collection: `postman/collections/return-settlement.postman_collection.json`.
- Response thực tế (token test đã che): `postman/reports/return-settlement/results.json`.
- Log nguyên bản được runner tạo local tại `postman/reports/return-settlement/` (`schedule.log`: 11 request / 12 assertion; `flow.log`: 65 request / 100 assertion); `.log` bị `.gitignore` loại trừ. `results.json` đã commit làm evidence response đã che token.
- Chạy lại từ root: `bun apps/api/tests/run-return-postman.ts`. Cần Postman CLI và PostgreSQL loopback 5433, Redis loopback 6379. Script tự tạo/migrate fixture, chạy hai folder collection, giữ log rồi xóa database test. Cookie được sinh khi chạy và xóa khỏi collection sau chạy; không tái sử dụng UUID của lần đã cleanup.

Chưa kiểm chứng chuyển/nhận tiền ngân hàng thật, webhook SePay, ảnh Cloudinary, UI hoặc tải đồng thời bằng Postman. Request Postman chạy tuần tự; bằng chứng chống race đồng thời thuộc bộ kiểm thử PostgreSQL đã chạy ở phase triển khai, không suy diễn từ lượt CLI này. Phạm vi lần này bắt đầu từ Rental đã nhận kho và CHARGE đã xác minh; không kiểm thử lại checkout/check-in.
