# Kế hoạch backend Flow 5 — người thực hiện: bạn của bạn

Mốc source `b4003a9` ngày 17/10/2026. Đọc
[kiểm kê chung](flow-4-5-backend-audit.md) trước khi code.
Chỉ API, contracts và persistence cần thiết; không sửa web/mobile/API client/mocks.
Các endpoint bổ sung dưới đây là đề xuất, chưa được triển khai.

## Mục tiêu và phạm vi

Quản lý cơ sở, loại kho/ô kho và nhân sự theo đúng facility scope; FM điều phối
công việc đã có. Không viết lại booking assignment, check-in hoặc handover.
Tài khoản và gán role tái sử dụng users API; toàn bộ audit/login-history M7 không
mặc định thuộc Flow 5. Membership facility và phân công task là hai thao tác khác nhau.

## F5-0 — Chốt permission và các transition

- **Chính sách chính thức:** Đã chốt chi tiết tại [Chính sách vận hành cơ sở và phân công nhân sự (F1–F5)](facility-staff-operations-policy.md) và contracts `@metastorage/contracts`.
- Thống nhất BOM/SA quản lý danh mục facility; FM chỉ thao tác phần được phép tại
  facility mình. Quyền sửa metadata/đóng cơ sở, sửa type dùng chung đã chốt.
- SA/BOM gán/thu hồi membership; FM chọn FS hợp lệ để giao việc và phân bổ tải công việc.
- Giữ model một user một role và một facility assignment active hiện có (F1). Không
  tạo multi-facility hoặc ca làm việc khi DB đã có unique partial index chặn (F2).
- Phân quyền đưa kho vào/ra MAINTENANCE thuộc về FM trong scope cơ sở (F4), cấm chuyển
  trực tiếp OCCUPIED/RESERVED sang MAINTENANCE. Không PATCH status tùy ý.
- Chốt thu hồi/chuyển nhân sự đang có việc chưa bàn giao: reassign cho FS khác trước
  khi thu hồi hoặc điều chuyển (F3).

Đầu ra: ma trận actor × operation, state transition table, ca test contracts và chính sách dùng chung.

## F5-1 — Hoàn thiện facility management

- Giữ POST `/api/facilities` hiện có, không tạo endpoint tương đương ở module BOM.
- Giữ GET public `/api/facilities` và `/:facilityId/unit-types` cho Flow 1.
  Đề xuất GET `/api/facilities/management` cho list quản trị có inactive/filter;
  không đưa inactive vào public list hoặc âm thầm đổi response hiện có.
- Đề xuất GET/PATCH `/api/facilities/:facilityId` dùng lại FacilitiesService
  getFacilityById/updateFacility và scoped repository hiện tại. Chọn DTO rõ ràng.
- Chỉ dùng vô hiệu hóa nếu đúng policy; không thêm hard delete facility có dữ
  liệu thuê/thanh toán. Chốt và test trường hợp còn hold hoặc booking tương lai.
- Operating hours đã có bảng và được booking kiểm tra. Chỉ thêm API cấu hình giờ
  khi nằm trong scope đã chốt; không làm scheduling engine hoặc ca làm việc.

## F5-2 — Loại kho, offering và physical inventory

- Dùng `UnitTypesRepository` hiện có cho metadata loại kho, chỉ bổ sung service,
  contracts/route cần thiết. Sửa kích thước/type dùng chung cần quyền riêng, không
  cho FM của một facility sửa dữ liệu của toàn hệ thống.
- `monthlyPrice` do người Flow 4 sở hữu. Tạo type mới cần thống nhất initial price
  trong một contract; không tự dùng 0 và không tạo API giá song song.
- GET public `/:facilityId/unit-types` giữ nguyên. Mở rộng quản trị liên kết
  facility ↔ type bằng repository facility-unit-types đã có; không tạo bảng mới.
  Đề xuất PUT/PATCH `/api/facilities/:facilityId/unit-types/:unitTypeId` sau chốt quyền.
- Thêm GET/POST `/api/facilities/:facilityId/storage-units` và GET/PATCH
  `/api/storage-units/:unitId` cho trường metadata được phép. Resolve facility từ
  unit trong DB; không tin facilityId do client gửi để vượt quyền.
- Thêm POST `/api/storage-units/:unitId/transitions` theo state machine đã chốt.
  Không nhận chuyển OCCUPIED → AVAILABLE bằng CRUD để thay Flow 3 trả kho.
- Mở rộng module storage-units hiện tại, giữ nguyên thuật toán capacity theo kỳ.
  Transaction phải phối hợp cùng khóa offering/assignment mà payment và gán kho
  đang dùng; test race đưa kho bảo trì khi checkout hoặc assign-unit đồng thời.
  Không chỉ đổi status rồi hy vọng hold hiện có tự hết hiệu lực.
- Không cho chuyển facility/type của unit đang gắn booking/rental một cách tùy ý;
  giữ lịch sử và dữ liệu snapshot. Hạn chế xóa theo policy/foreign keys đã chốt.

## F5-3 — Membership và phân công nhân sự

- Dùng users API có sẵn để tạo tài khoản có credential, gán role/status; không
  insert staff vào bảng users riêng rồi bỏ qua Better Auth account.
- Trước tái sử dụng, sửa DTO allowlist của users, tránh trả passwordHash hoặc DB
  User trực tiếp; giữ tương thích consumer hiện có và không mở thêm CRUD trùng.
- Giữ GET `/api/facilities/my-assignments` và `/:facilityId/staff` hiện có.
- Đề xuất GET/POST `/api/facilities/:facilityId/assignments` và DELETE
  `/api/facilities/:facilityId/assignments/:userId` theo spec quyền SA; DELETE là
  thu hồi/deactivate, không xóa lịch sử. GET membership và GET staff picker có
  mục đích khác nhau; đừng tạo thêm một staff-list tương đương.
- Dùng upsertAssignment/deactivateAssignment/listAssignment repository hiện tại,
  bổ sung service validation: user/facility tồn tại, role phù hợp, status ACTIVE,
  một assignment active, xử lý việc đang được giao theo F5-0.
- Đồng bộ cách lọc endedAt/role/status giữa staff picker, scope guard và assign.
  Đổi role/disable/thu hồi phải tác động tới quyền request tiếp theo; kiểm tra
  session/cache auth hiện tại thay vì mặc định mọi session đã bị vô hiệu.
- Giữ nguyên assign-unit, assign-staff và assigned-to-me của module bookings.
  Chỉ bổ sung validation đã thiếu. Không tạo bảng task và lịch làm việc mới.
  Inspection trả kho/support task chỉ mở rộng khi owner Flow 3/7 có contract.

## F5-4 — Summary, integration tests và bàn giao

- Facility summary tái sử dụng metric/query do Flow 4 sở hữu, truyền scope an toàn.
  Đề xuất GET `/api/facilities/:facilityId/summary` chỉ khi cần DTO tổng hợp; không
  tạo nguồn doanh thu/utilization thứ hai. Có thể làm inventory trước, nối report sau.
- Dùng app.inject + PostgreSQL cô lập: hai facility, FM/FS khác scope, inactive
  user, expired/revoked assignment, duplicate code, unit đang thuê/có booking.
- Test guard không vượt cơ sở, public GET không đòi login, private GET không lộ
  inactive/metadata nội bộ ra public; output không có trường credential.
- Test concurrent assignment giữ unique active assignment; revoke/re-role không
  để quyền hoặc task cũ tiếp tục hoạt động trái policy.
- Test maintenance transition và race checkout/assign-unit; inventory thay đổi
  không làm overbook hoặc thay trạng thái rental trái lifecycle.
- Tái dùng regression facilities, booking-payment-start, inspections và handover;
  không viết lại tests chỉ để phản chiếu repository CRUD.
- Chạy check-types API/contracts/database, Biome và test liên quan. Không coi
  repo-mocked test là bằng chứng cho transaction/constraint trên DB thật.
- Bàn giao Swagger, fixtures và script demo API: dùng users endpoint hiện có →
  gán facility → tạo/quản lý unit → đọc staff picker → dùng assign-staff cũ → thử
  truy cập chéo facility để xác nhận bị chặn → xem summary có scope.

Không tự commit/push hoặc thay backend production trong lúc thực hiện kế hoạch.
