# Chính sách vận hành cơ sở và phân công nhân sự (Facility & Staff Operations Policy)

**Mã quyết định:** Open Decisions F1–F5 (Flow 5 / F5-0).

**Trạng thái:** ĐÃ CHỐT CHO MVP (Confirmed for MVP).

**Traceability:**
- `UC-FM-02`: Vận hành cơ sở và điều phối nhân viên.
- `UC-FM-04`: Gán nhân viên phụ trách check-in và bàn giao kho.
- `UC-FM-08`: Quản lý trạng thái ô kho vật lý (Available <-> Maintenance).
- `UC-FM-09`: Xem danh sách nhân viên cơ sở và tải công việc.
- Nguồn: *STOREX User Requirements — Use Cases (bản consolidated hiện tại)*, đối chiếu `AGENTS.md`, `docs/flow-4-5-backend-audit.md` và `docs/flow-5-backend-plan.md`.

---

## 1. Quyết định F1: Phạm vi trực thuộc cơ sở của nhân sự (Single Active Facility Assignment)

### Quyết định chính thức
**Nhân viên cơ sở (`FACILITY_STAFF`) và Quản lý cơ sở (`FACILITY_MANAGER`) chỉ trực thuộc duy nhất 1 cơ sở tại một thời điểm trong phạm vi MVP.** Hệ thống KHÔNG hỗ trợ multi-facility assignment đồng thời cho cùng một tài khoản nhân sự.

### Ràng buộc kỹ thuật & Nghiệp vụ
1. **Ràng buộc toàn vẹn Database:**
   - Bảng `facility_assignments` áp dụng unique partial index:
     ```sql
     CREATE UNIQUE INDEX "facility_assignments_active_user_idx" 
     ON "facility_assignments" ("user_id") 
     WHERE "is_active" = true;
     ```
   - Ràng buộc này đảm bảo một `user_id` chỉ có tối đa 1 bản ghi `is_active = true`.
2. **Trách nhiệm vật lý tại chỗ:**
   - Nghiệp vụ của FS đòi hỏi phải có mặt trực tiếp tại chi nhánh (kiểm tra kho thực tế, hướng dẫn khách, mở khóa cửa, ký biên bản bàn giao, xử lý sự cố). Việc gán một nhân viên thuộc nhiều cơ sở đồng thời trong MVP sẽ dẫn đến xung đột lịch trực vật lý và sai lệch định tuyến công việc.
3. **Quy trình điều chuyển cơ sở (Staff Transfer Policy):**
   - Khi một FS được điều chuyển từ cơ sở A sang cơ sở B:
     - Phân công cũ tại cơ sở A phải được kết thúc trước (`is_active = false`, `ended_at = CURRENT_TIMESTAMP`).
     - **Xử lý công việc dở dang:** Nếu FS đang được gán phụ trách các booking ở trạng thái `CONFIRMED` tại cơ sở A, FM cơ sở A phải thực hiện **gán lại (reassign)** các booking đó cho nhân sự khác tại cơ sở A trước khi thực hiện thu hồi/chuyển công tác.
     - Tạo hoặc kích hoạt phân công mới tại cơ sở B (`is_active = true`, `ended_at = NULL`).
   - Lịch sử phân công được bảo toàn nguyên vẹn trong DB qua các bản ghi có `is_active = false` nhằm phục vụ kiểm toán (audit trail), tuyệt đối không xóa cứng (hard delete).

---

## 2. Quyết định F2: Mô hình ca trực và phạm vi lịch làm việc (Staff Schedule & Shift Scope)

### Quyết định chính thức
**Trong phạm vi MVP, KHÔNG xây dựng công cụ xếp ca/phân ca phức tạp (`staff_shifts` / shift engine).** Không tạo thêm bảng dữ liệu phân ca hay lịch làm việc xoay vòng cá nhân.

### Ràng buộc kỹ thuật & Nghiệp vụ
1. **Phạm vi giờ làm việc (Operational Working Hours):**
   - Nhân sự làm việc theo khung giờ hoạt động chuẩn của cơ sở mà mình đang có active assignment, được cấu hình dùng chung toàn hệ thống tại System Settings bởi Business Operations Manager (múi giờ `Asia/Ho_Chi_Minh`).
   - Mọi lịch hẹn nhận kho của khách hàng (`check_in_slots`) đều được ràng buộc phải nằm trọn trong khung giờ mở cửa của cơ sở (`open_time` đến `close_time`).
2. **Tiêu chuẩn nhân sự khả dụng (Staff Availability Criteria):**
   - Một nhân viên cơ sở được coi là sẵn sàng để nhận phân công công việc khi thỏa mãn đồng thời cả 4 điều kiện:
     1. Trạng thái tài khoản người dùng: `users.status = 'ACTIVE'`.
     2. Vai trò tài khoản: `users.role = 'FACILITY_STAFF'`.
     3. Có phân công cơ sở đang hoạt động: `facility_assignments.facility_id = :facilityId`, `facility_assignments.role = 'FACILITY_STAFF'`, và `facility_assignments.is_active = true`.
     4. Thời hạn phân công hợp lệ: `facility_assignments.ended_at IS NULL` hoặc `facility_assignments.ended_at > CURRENT_TIMESTAMP`.

---

## 3. Quyết định F3: Cơ chế lựa chọn nhân sự khi giao việc (Staff Selection by Facility Manager)

### Quyết định chính thức
**Quản lý cơ sở (`FACILITY_MANAGER`) phân công công việc THỦ CÔNG (Manual Selection) có sự hỗ trợ của chỉ số tải công việc (Workload Visibility).** Không sử dụng thuật toán tự động chia việc ngẫu nhiên (No Auto-dispatch / Round-Robin).

### Ràng buộc kỹ thuật & Nghiệp vụ
1. **Hỗ trợ quyết định cho Quản lý:**
   - API `GET /api/facilities/:facilityId/staff` cung cấp danh sách nhân viên cơ sở trực thuộc, tính toán kèm trường:
     - `assignedTasksCount`: Số lượng đơn đặt chỗ (`bookings`) ở trạng thái `CONFIRMED` đang được gán cho nhân viên này tại cơ sở nhưng chưa hoàn tất thủ tục bàn giao (`status != 'CHECKED_IN'`).
   - Giao diện người dùng hiển thị trực quan thông tin: Họ tên, email, số điện thoại, vai trò và tải công việc:
     - Badge xanh: *"Sẵn sàng (0 việc)"* nếu `assignedTasksCount === 0`.
     - Badge xám: *"Đang phụ trách: X việc"* nếu `assignedTasksCount > 0`.
   - FM chủ động đánh giá tình hình nhân sự thực tế tại chỗ (nhân viên có mặt tại quầy, nhân viên đang đi kiểm tra hiện trường) để lựa chọn người phù hợp nhất.
2. **Quy tắc phân công & Gán lại (Task Assignment & Reassignment):**
   - Thao tác: `POST /api/bookings/:id/assign-staff` với payload `{ staffId, notes? }`.
   - Ràng buộc:
     - Booking phải ở trạng thái `CONFIRMED`.
     - Staff được chọn bắt buộc phải thuộc cơ sở của booking và có phân công active (`FACILITY_STAFF`).
     - FM có toàn quyền **gán lại (reassign)** task cho một FS khác bất kỳ lúc nào trước khi quá trình check-in hoàn tất (ví dụ khi nhân viên ban đầu có việc đột xuất hoặc vắng mặt).
     - Khi bàn giao hoàn tất (`CHECKED_IN`), task tự động hoàn thành và giảm tải cho nhân viên đó.

---

## 4. Quyết định F4: Phân quyền và chuyển đổi trạng thái Bảo trì ô kho (Physical Unit Maintenance Permissions)

### Quyết định chính thức
**Chỉ `FACILITY_MANAGER` (trong phạm vi cơ sở được phân công), `SYSTEM_ADMIN` và `BUSINESS_OPERATION_MANAGER` (trên toàn hệ thống) mới có quyền đưa ô kho vật lý vào hoặc đưa ra khỏi trạng thái BẢO TRÌ (`MAINTENANCE`).** `FACILITY_STAFF` và `CUSTOMER` KHÔNG có quyền này.

### State Machine chuyển đổi trạng thái ô kho

```text
    ┌───────────────────────────────────────────────┐
    │                                               │
    ▼                                               │
┌──────────────┐     FM Đưa vào bảo trì     ┌───────────────┐
│  AVAILABLE   │ ─────────────────────────► │  MAINTENANCE  │
└──────────────┘ (Yêu cầu reason, kho sạch) └───────────────┘
    ▲      │                                        │
    │      │ Gán kho cho booking                    │ FM Hoàn tất bảo trì
    │      ▼                                        ▼
    │  ┌──────────────┐                     ┌───────────────┐
    │  │   RESERVED   │                     │   AVAILABLE   │
    │  └──────────────┘                     └───────────────┘
    │      │ Handover thành công                    ▲
    │      ▼                                        │
    │  ┌──────────────┐      Khách trả kho          │ Không hư hỏng
    │  │   OCCUPIED   │ ──────────────────────► ┌───────────────┐
    │  └──────────────┘                         │  INSPECTION   │
    │                                           └───────────────┘
    │                                                   │ Có hư hại
    └───────────────────────────────────────────────────┘
```

### Chi tiết các chuyển đổi trạng thái:

1. **Đưa vào bảo trì (`AVAILABLE → MAINTENANCE`):**
   - **Điều kiện cho phép:**
     - Ô kho đang ở trạng thái `AVAILABLE`.
     - Ô kho KHÔNG có phân công đặt chỗ nào đang active (`unit_assignments.status = 'ACTIVE'`).
     - Ô kho KHÔNG có hợp đồng thuê nào đang hoạt động (`rentals.status = 'ACTIVE'`).
     - Bắt buộc phải có lý do bảo trì (`reason` không được rỗng, tối thiểu 3 ký tự).
   - **Hệ quả tức thì:**
     - Ô kho chuyển sang trạng thái `MAINTENANCE`.
     - Ngay lập tức bị loại khỏi sức chứa trống (`getAvailableCapacity` chỉ tính `AVAILABLE`), chống overbooking.
     - Bị loại khỏi danh sách ô kho hợp lệ để FM gán cho khách (`getEligibleUnitsForBooking`).

2. **Đưa ra khỏi bảo trì (`MAINTENANCE → AVAILABLE`):**
   - **Điều kiện cho phép:**
     - Ô kho đang ở trạng thái `MAINTENANCE`.
     - Công tác bảo trì, sửa chữa, vệ sinh đã hoàn tất.
   - **Hệ quả tức thì:**
     - Ô kho chuyển sang trạng thái `AVAILABLE`.
     - Quay trở lại pool sức chứa khả dụng để sẵn sàng cho thuê và phân công.

3. **Từ trả kho sang bảo trì (`INSPECTION / RETURN_PENDING → MAINTENANCE`):**
   - Khi hoàn tất trả kho (Flow 3/4), nếu biên bản nghiệm thu (`handover_inspections`) ghi nhận hư hại cần sửa chữa, ô kho được chuyển sang `MAINTENANCE` trước khi có thể phục hồi về `AVAILABLE`.

### Các chuyển đổi BỊ CẤM TUYỆT ĐỐI (Forbidden Transitions):
- **CẤM `OCCUPIED → MAINTENANCE` trực tiếp:** Không được phép đơn phương đưa ô kho đang có khách thuê vào bảo trì thông qua nút thao tác thường. Nếu phát sinh sự cố khẩn cấp, bắt buộc phải qua quy trình điều chuyển đổi kho (unit swap/relocation) hoặc thanh lý hợp đồng.
- **CẤM `RESERVED → MAINTENANCE` trực tiếp:** Ô kho đang gán cho booking chờ nhận kho không được phép đưa vào bảo trì nếu chưa gán lại kho khác (reassign unit) hoặc hủy booking.
- **CẤM `INACTIVE → MAINTENANCE`:** Ô kho đã ngưng sử dụng không thể bảo trì.
- **CẤM chuyển tắt `OCCUPIED → AVAILABLE`:** Trả kho bắt buộc phải qua quy trình bàn giao hoàn trả (Rental Return Lifecycle / Flow 3), không được dùng CRUD ghi đè status.

---

## 5. Quyết định F5: Ma trận phân quyền Actor × Operation & Shared Contracts

### Ma trận phân quyền (Permissions Matrix)

| Thao tác nghiệp vụ | SYSTEM_ADMIN | BOM | FACILITY_MANAGER | FACILITY_STAFF | CUSTOMER |
|---|:---:|:---:|:---:|:---:|:---:|
| **Quản trị cơ sở & Metadata dùng chung** | Toàn quyền | Toàn quyền | Xem trong scope | Xem trong scope | Public info |
| **Gán / Thu hồi phân công nhân sự (`facility_assignments`)** | Có | Có | Có (Cơ sở mình) | Không | Không |
| **Xem danh sách nhân viên cơ sở (`GET /facilities/:id/staff`)** | Có | Có | Có (Cơ sở mình) | Không | Không |
| **Gán nhân viên phụ trách check-in (`POST /bookings/:id/assign-staff`)** | Không (ủy quyền) | Không (ủy quyền) | Có (Cơ sở mình) | Không | Không |
| **Gán ô kho vật lý cho booking (`POST /bookings/:id/assign-unit`)** | Không (ủy quyền) | Không (ủy quyền) | Có (Cơ sở mình) | Không | Không |
| **Đưa ô kho vào bảo trì (`AVAILABLE → MAINTENANCE`)** | Có | Có | Có (Cơ sở mình) | Không | Không |
| **Đưa ô kho ra khỏi bảo trì (`MAINTENANCE → AVAILABLE`)** | Có | Có | Có (Cơ sở mình) | Không | Không |
| **Thực hiện kiểm tra & hoàn tất biên bản nhận kho (`handover`)** | Không | Không | Giám sát | Có (FS được giao) | Không |

### Shared Contracts & Validation Rules trong code
Mọi module (API, Web, Mobile, Background Worker) bắt buộc phải sử dụng các schema và hàm dùng chung từ `@metastorage/contracts`:

1. **Schemas chuyển đổi bảo trì:**
   - `StorageUnitTransitionActionSchema`: `enum(["ENTER_MAINTENANCE", "EXIT_MAINTENANCE"])`.
   - `StorageUnitMaintenanceTransitionSchema`: Validate action và lý do bảo trì (`reason` tối thiểu 3 ký tự khi vào bảo trì).
   - `UpdateStorageUnitStatusBodySchema`: DTO chuẩn cho API cập nhật trạng thái kho.
2. **Hàm kiểm tra hợp lệ chuyển đổi trạng thái (Pure Validator):**
   - `canTransitionStorageUnitStatus(currentStatus, targetStatus, context)`:
     - Kiểm tra tính hợp lệ của chuyển đổi trạng thái ô kho.
     - Kiểm tra ràng buộc không có active assignment hoặc active rental.
     - Trả về `{ allowed: boolean, error?: string }` với message tiếng Việt chuẩn hóa từ `STORAGE_UNIT_MESSAGES`.
3. **Bộ thông điệp tập trung (Centralized Messages):**
   - `STORAGE_UNIT_MESSAGES` (tuân thủ Rule 21 của AGENTS.md):
     - `cannotPutOccupiedUnitInMaintenance`
     - `cannotPutReservedUnitInMaintenance`
     - `invalidStatusTransition`
     - `unitHasActiveRental`
     - `unitHasActiveAssignment`

---

## 6. Xử lý Failure Paths, Edge Cases và Tranh chấp đồng thời (Concurrency)

1. **Tranh chấp đồng thời giữa Đưa vào bảo trì và Đặt cọc / Gán kho (Race Condition):**
   - Khi FM thực hiện chuyển kho `AVAILABLE → MAINTENANCE`, hệ thống sử dụng Database Transaction kèm khóa dòng `FOR UPDATE` trên ô kho tương ứng.
   - Nếu cùng lúc khách hàng đang tạo checkout hold hoặc FM đang gán ô kho đó cho booking khác:
     - Nếu transaction gán kho commit trước: Ô kho chuyển sang `RESERVED` -> Thao tác bảo trì sẽ bị từ chối với lỗi `cannotPutReservedUnitInMaintenance`.
     - Nếu transaction bảo trì commit trước: Ô kho chuyển sang `MAINTENANCE` -> Thao tác checkout / gán kho sẽ bị từ chối với lỗi `unitUnavailable` / `UNIT_STATUS_INVALID`.
2. **Thu hồi nhân sự khi đang có công việc dở dang:**
   - Khi chấm dứt phân công cơ sở của một FS (`endedAt` hoặc `isActive = false`), hệ thống kiểm tra các đơn `CONFIRMED` đang được giao cho FS đó.
   - Nếu còn đơn chưa hoàn tất: FM được yêu cầu reassign các đơn đó cho FS khác, đảm bảo không có đơn đặt chỗ nào bị "bỏ rơi" không có người tiếp đón khách.
3. **Truy cập ngoài phạm vi cơ sở (Out-of-scope Access):**
   - FM chỉ có quyền thao tác trên các ô kho và nhân sự thuộc cơ sở mà mình có active assignment (`scope.kind === "assigned" && scope.facilityId === targetFacilityId`). Mọi nỗ lực can thiệp sang cơ sở khác sẽ bị từ chối với mã lỗi `403 Forbidden` (`facilityAccessDenied` / `facilityOperationDenied`).

---

## 7. Quy chuẩn nghiệm thu & Kiểm thử (Verification & DoD)

- Tất cả quy tắc F1–F5 đã được cụ thể hóa thành hợp đồng `@metastorage/contracts` và tài liệu chính thức.
- Test suites:
  - `packages/contracts/src/storage-units.test.ts` (15/15 tests pass).
  - `apps/api/tests/units/bookings/bookings.service.test.ts` (14/14 tests pass).
  - `apps/api/tests/units/facilities/facility-assignments.service.test.ts` (6/6 tests pass).
  - Toàn bộ workspace `check-types` và `check` (Biome) đạt 100% không cảnh báo/lỗi.
- Khi triển khai các route và UI cho Flow 5, lập trình viên không được tự suy diễn các quy tắc này.
