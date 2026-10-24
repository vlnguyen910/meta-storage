# Flow 5 PR #154 Review Fixes Implementation Plan

**Goal:** Sửa đủ bốn lỗi đã tái hiện trong review PR #154: mất capacity khi đổi loại kho, thu hồi nhân viên bị kẹt, ngừng cơ sở bị kẹt và báo cáo mới không xuất hiện trên màn FM.

**Architecture:** Giữ Fastify Route → Service → Repository, Drizzle và centralized API client hiện có. Sửa điều kiện truy vấn tại nguồn, dùng transaction và khóa chung với checkout cho thay đổi capacity; frontend dùng polling TanStack Query đang có. Không đổi schema, không tạo API mới hoặc thêm dependency.

**Tech Stack:** Bun, TypeScript, Fastify, PostgreSQL, Drizzle ORM, Next.js, TanStack Query, Bun integration tests, Playwright.

---

## Phạm vi và quyết định

- PR: https://github.com/vlnguyen910/metastorage/pull/154; reviewed HEAD `7f65be8`, base `e087d89`.
- **Đã được người dùng chốt ngày 24/10/2026:** chặn đổi loại khi loại cũ còn cam kết hiệu lực, kể cả còn dư kho. Không viết thuật toán tính lượng kho dư theo từng khoảng thuê.
- Cam kết cần bảo vệ: allocation `BOOKING/ACTIVE` và `HOLD/ACTIVE` chưa hết hạn. Giữ kiểm tra rental và assignment vật lý hiện có. Chỉ đổi code/floor/location vẫn được khi không đổi loại.
- Task `COMPLETED` là lịch sử, không chặn thu hồi membership. Task chưa hoàn tất và booking `CONFIRMED` vẫn chặn.
- Booking `CHECKED_IN` có rental `CLOSED` không chặn ngừng cơ sở. Rental `ACTIVE`, `RETURN_PENDING`, `OVERDUE` vẫn chặn. Nếu booking `CHECKED_IN` không có rental, tiếp tục chặn vì dữ liệu không nhất quán.
- Giữ cách xử lý booking `DRAFT` hiện tại. Chính sách dọn draft bỏ dở không thuộc bốn bản sửa này.
- Poll lịch sử báo cáo mỗi 30 giây như task detail; không thêm WebSocket hoặc nút mới.
- Không tự commit/push/deploy khi chỉ thực hiện yêu cầu lập kế hoạch. Các lệnh commit dưới đây dành cho giai đoạn triển khai được cho phép.

## Bằng chứng và điểm cần thận trọng

Review đã tái hiện bằng API với PostgreSQL riêng:

1. Đổi ô cuối cùng sang loại khác trả `200` dù booking loại cũ còn `CONFIRMED` và có allocation.
2. Hoàn tất task trả `200`; thu hồi nhân viên và giao lại task đều trả `409`.
3. Rental đã `CLOSED`, không còn allocation hiệu lực; ngừng cơ sở vẫn trả `409` vì booking giữ `CHECKED_IN`.
4. Browser FM mở detail trước khi FS gửi báo cáo: sau 32 giây task đổi trạng thái nhưng history chỉ được gọi một lần; đóng/mở detail mới thấy nút duyệt.

Baseline review: 23 test Flow 5 và 31 test returns pass; type-check và Biome pass. E2E Flow 5: 10 pass, 4 fail ở snapshot. Không coi lệch ảnh là lỗi chức năng đã được chứng minh; không cập nhật baseline tự động để làm xanh test.

GitNexus tại checkout `/home/owen/Projects/metastorage`, index đã cập nhật cho HEAD review:

- `StorageUnitsRepository.updateUnit`: LOW, nhưng kết quả là lower-bound; phải kiểm tra text callers bổ sung.
- `deactivateAssignmentWithWorkCheck`: LOW; caller là `FacilityAssignmentsService.revokeAssignment` → facility routes.
- `hasOpenOperations`: LOW; caller là `FacilitiesService.updateFacility` → facility routes.
- `useTaskReportHistory`: **HIGH**; dùng bởi `TaskDetails` → `TaskPanel` → cả trang FM và FS. Phải kiểm tra cả hai vai trò.
- `prepareBookingPayment`: LOW. `processBookingPaymentEvent`: **HIGH**, ảnh hưởng webhook/payment routes và booking confirmation. Nếu mở rộng khóa checkout, phải giữ regression cho webhook lặp, hold hết hạn, xác nhận booking và thứ tự khóa; không mặc định thay khóa payment là rủi ro thấp.

Đọc khi triển khai: `docs/backend-patterns.md`, `docs/flow-5-backend-plan.md`, `docs/flow5-task-assignment-api.md`, `docs/flow5-web-testing.md`. Đối chiếu `docs/db-diagram.md` để hiểu allocation, booking, rental; không cần migration cho kế hoạch này.

Áp dụng @ponytail:ponytail và @metastorage-backend-endpoint cho phần backend. Nếu thay đổi phạm vi kiểm tra UI, tham khảo @metastorage-frontend-quality. Quyết định domain đã chốt ở trên phải được tái sử dụng.

## Task 0: Chuẩn bị checkout, môi trường và test fixture

**Files:**
- Read: `.github/workflows/ci.yml`
- Read: `apps/api/tests/fixtures/facility-operations.ts`
- Read: `apps/api/tests/fixtures/test-database.ts`
- Read: `apps/api/tests/run-database-tests.ts`
- Create: `apps/api/tests/integration/flow5-review-regressions.test.ts`

**Step 1: Tạo worktree triển khai từ đúng HEAD được review**

```bash
git status --short
git worktree add /tmp/metastorage-flow5-review-fixes -b fix/flow5-review-findings HEAD
```

Chạy các lệnh tiếp theo từ root worktree đó. Không copy `.env` chứa credential production. Dùng cấu hình test dummy giống CI và database loopback mới tên `metastorage_inspection_test_flow5_review_fixes`. Không dùng DB business local.

**Step 2: Khởi tạo DB cô lập và cấu hình test**

```bash
docker exec metastorage-db createdb -U postgres metastorage_inspection_test_flow5_review_fixes
export NODE_ENV=test
export DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/metastorage_inspection_test_flow5_review_fixes
export MY_STORAGE_LOCAL_DATABASE_URL="$DATABASE_URL"
export BOOKING_TEST_DATABASE_URL="$DATABASE_URL"
export PRICING_TEST_DATABASE_URL="$DATABASE_URL"
export REPORTS_TEST_DATABASE_URL="$DATABASE_URL"
export REDIS_URL=redis://127.0.0.1:6379/13
export REDIS_TEST_URL="$REDIS_URL"
export RUN_INSPECTION_DB_TESTS=1
export LOG_LEVEL=silent
export CORS_ORIGIN=http://localhost:3000
export AUTH_TRUSTED_ORIGINS=http://localhost:3000
export BETTER_AUTH_SECRET=flow5-review-test-auth-secret-32-characters
export BETTER_AUTH_URL=http://localhost:4000/api/auth
export BOOKING_MAGIC_LINK_SECRET=flow5-review-test-booking-secret-32-characters
export QR_TOKEN_SECRET=flow5-review-test-qr-secret-32-characters
export PUBLIC_APP_URL=http://localhost:3000
export WEB_URL=http://localhost:3000
export RESEND_API_KEY=re_test_only
export RESEND_FROM_EMAIL='Review <review@example.test>'
export GOOGLE_CLIENT_ID=test-google-client
export GOOGLE_CLIENT_SECRET=test-google-secret
export CLOUDINARY_CLOUD_NAME=test-cloud
export CLOUDINARY_API_KEY=test-key
export CLOUDINARY_API_SECRET=test-secret
export PAYMENT_PROVIDER=mock
bun install --frozen-lockfile
bun run --filter @metastorage/database db:migrate
```

Expected: migrations áp dụng thành công. Redis DB 13 phải dành riêng cho lần chạy này; đổi sang test DB trống khác nếu đang được dùng. Không seed toàn bộ dữ liệu business. Runner `test:db` tự cài system settings test cần thiết.

**Step 3: Tạo fixture kiểm thử dùng lại dữ liệu sẵn có**

Trong file regression mới, dùng `describe.skipIf(!process.env.MY_STORAGE_LOCAL_DATABASE_URL)`, `beforeEach/afterEach` và `createFacilityOperationsFixture()`. Mỗi test có facility/users riêng để không phụ thuộc thứ tự chạy. Đăng ký:

```typescript
f = await createFacilityOperationsFixture();
await f.app.register(facilitiesRoutes, { prefix: "/api/facilities" });
await f.app.register(facilityTasksRoutes, { prefix: "/api/facility-tasks" });
await f.app.register(storageUnitsRoutes, { prefix: "/api/storage-units" });
await f.login();
```

Import route từ các module tương ứng trong `../../src/modules/`. Dùng `f.api()` để kiểm tra auth → route → service → PostgreSQL, không mock repository.

Cleanup theo FK: task reports → tasks → unit assignments → rentals → allocations → bookings → check-in slots do test tạo → `f.cleanup()`. Luôn cleanup trong `finally`/`afterEach`; chỉ `queryClient.end()` ở `afterAll`. Không dùng TRUNCATE hoặc xóa theo điều kiện toàn bảng.

## Task 1: Bảo vệ cam kết khi đổi loại ô kho — finding 1

**Files:**
- Modify: `apps/api/src/modules/storage-units/storage-units.repository.ts`
- Modify if needed for consistent lock ordering: `apps/api/src/modules/payments/payments.repository.ts`
- Test: `apps/api/tests/integration/flow5-review-regressions.test.ts`
- Extend concurrency coverage: `apps/api/tests/integration/booking-payment-start.test.ts`
- Read callers: `apps/api/src/modules/storage-units/storage-units.service.ts`, `apps/api/src/modules/storage-units/storage-units.routes.ts`

**Step 1: Viết test đỏ cho booking và hold theo loại cũ**

Tạo allocation loại `f.typeId` tại `f.facilityId` với `referenceId` ngẫu nhiên; `BOOKING` allocation phải đi cùng booking `CONFIRMED` thật trong test nghiệp vụ. Dùng lịch thuê tương lai. Sau đó:

```typescript
const response = await f.api("manager", "PATCH", `/storage-units/${f.unitId}`, {
  unitTypeId: f.otherTypeId,
});
expect(response.statusCode).toBe(409);
const [unit] = await db.select().from(storageUnits).where(eq(storageUnits.id, f.unitId));
expect(unit?.unitTypeId).toBe(f.typeId);
```

Các trường hợp: `BOOKING/ACTIVE`, `HOLD/ACTIVE` chưa hết hạn đều chặn; hold hết hạn, allocation `RELEASED`/`EXPIRED` không chặn; đổi floor hoặc giữ nguyên loại vẫn thành công. Thêm một ô dư cùng loại rồi vẫn kỳ vọng `409`, đúng chính sách người dùng đã chốt.

**Step 2: Chạy test để xác nhận lỗi hiện tại**

```bash
bun test --cwd apps/api tests/integration/flow5-review-regressions.test.ts --test-name-pattern 'type change'
```

Expected: các ca allocation hiệu lực fail vì API đang trả `200`.

**Step 3: Chốt thứ tự khóa dùng chung trước khi viết guard**

Chạy GitNexus impact với `--file` cho `updateUnit`, `prepareBookingPayment`, `processBookingPaymentEvent`; grep toàn bộ callers theo quy định repo. Đọc hai query checkout/webhook đang join offering/facility/unit type và dùng `.for("update")`.

Thứ tự đề xuất cho nhánh đổi loại: facility → offerings/shared types theo `unitTypeId` tăng dần → unit. Với checkout/webhook giữ booking → payment, sau đó khóa facility **trước** query offering hiện có. Hai dòng khóa tối thiểu, đặt ngay trước query offering ở cả hai entry point:

```typescript
await tx.select({ id: facilities.id }).from(facilities)
  .where(eq(facilities.id, booking.facilityId)).for("update");
```

Trong `updateUnit`, đọc identity không khóa trước transaction để biết facility/type, rồi khóa facility và hai offering theo thứ tự ổn định trước khi khóa lại unit. Re-read unit dưới khóa; nếu loại đã đổi so với identity thì trả conflict hiện có, không áp guard trên loại cũ đọc trước transaction. Giữ kiểm tra offering/shared type active ở loại đích; loại nguồn có thể đã inactive nên không lọc mất row khóa nguồn.

Không chỉ thêm khóa facility ở một phía: query join của checkout có thể giữ offering rồi chờ facility, tạo deadlock với writer giữ facility rồi chờ offering. Xác minh thứ tự thực tế bằng test đồng thời ở Step 5. Giữ thay đổi khóa trong cùng commit với guard.

**Step 4: Thêm guard nhỏ trong transaction đổi loại**

Chỉ chạy khi `input.unitTypeId !== unit.unitTypeId`. Sau khi đã khóa nguồn/đích, trước update, dùng query builder:

```typescript
const [commitment] = await tx.select({ id: capacityAllocations.id })
  .from(capacityAllocations)
  .where(and(
    eq(capacityAllocations.facilityId, unit.facilityId),
    eq(capacityAllocations.unitTypeId, unit.unitTypeId),
    eq(capacityAllocations.status, "ACTIVE"),
    or(
      eq(capacityAllocations.kind, "BOOKING"),
      and(
        eq(capacityAllocations.kind, "HOLD"),
        gt(capacityAllocations.expiresAt, new Date()),
      ),
    ),
  )).limit(1);
if (commitment) return { error: "UNIT_HAS_OPERATIONS" };
```

Tái sử dụng lỗi `UNIT_HAS_OPERATIONS` và message hiện có; không thêm status/DTO. Giữ guard rental/assignment, validation code trùng, authorization và xử lý không tìm thấy unit.

**Step 5: Kiểm chứng race với checkout thật**

Trong `booking-payment-start.test.ts`, tái dùng setup booking/payment hiện có; chạy checkout và đổi loại đồng thời khi chỉ có một ô loại nguồn. Bắt buộc kết quả: checkout thắng thì allocation được giữ và đổi loại bị chặn; đổi loại thắng thì checkout nhận lỗi capacity. Không được có allocation thành công mà loại nguồn còn 0 ô; không được có `500`, deadlock hoặc request treo. Dùng transaction điều khiển bằng promise/latch để kiểm chứng cả hai thứ tự commit, không dùng sleep ngẫu nhiên.

```bash
bun test --cwd apps/api tests/integration/flow5-review-regressions.test.ts
bun test --cwd apps/api tests/integration/booking-payment-start.test.ts
```

Expected: các ca trên pass, guard cũ và payment regressions không bị đổi kết quả.

**Step 6: Graph check và commit riêng**

```bash
node .gitnexus/run.cjs detect-changes --scope all --repo .
git add apps/api/src/modules/storage-units/storage-units.repository.ts apps/api/src/modules/payments/payments.repository.ts apps/api/tests/integration/flow5-review-regressions.test.ts apps/api/tests/integration/booking-payment-start.test.ts
git commit -m "fix: preserve committed capacity during unit type changes"
```

Chỉ stage file thực sự thay đổi. Không chấp nhận kết quả graph partial/truncated là clean.

## Task 2: Thu hồi membership khi task đã hoàn tất — finding 2

**Files:**
- Modify: `apps/api/src/modules/facilities/facility-assignments.repository.ts`
- Test: `apps/api/tests/integration/flow5-review-regressions.test.ts`
- Existing regression: `apps/api/tests/integration/flow5-management.test.ts`

**Step 1: Viết test đỏ bằng lifecycle API thật**

```typescript
const created = await f.api("manager", "POST", "/facility-tasks", {
  facilityId: f.facilityId, assignedStaffId: f.ids.staff,
  type: "INSPECT_UNIT", title: "Completed task does not block membership revoke",
});
expect(created.statusCode).toBe(201);
const taskId = created.json().data.id;
expect((await f.api("staff", "POST", `/facility-tasks/${taskId}/start`)).statusCode).toBe(200);
const submitted = await f.api("staff", "POST", `/facility-tasks/${taskId}/reports`, {
  content: "Done",
});
expect(submitted.statusCode).toBe(201);
const reportId = submitted.json().data.id;
expect((await f.api("manager", "POST",
  `/facility-tasks/${taskId}/reports/${reportId}/accept`)).statusCode).toBe(200);
const revoked = await f.api("admin", "DELETE",
  `/facilities/${f.facilityId}/assignments/${f.ids.staff}`);
expect(revoked.statusCode).toBe(200);
expect(revoked.json().data.isActive).toBe(false);
```

Đọc lại task/report và xác nhận vẫn tồn tại, vẫn giữ author/assignee/acceptor. Thử staff đọc task sau revoke: `403`. Tạo riêng các ca `ASSIGNED`, `IN_PROGRESS`, `AWAITING_APPROVAL` và booking `CONFIRMED`: revoke vẫn `409`.

**Step 2: Chạy đỏ**

```bash
bun test --cwd apps/api tests/integration/flow5-review-regressions.test.ts --test-name-pattern 'membership'
```

Expected: ca completed fail với `409` thay vì `200`.

**Step 3: Sửa đúng một predicate**

Import `ne` từ `@metastorage/database`, thêm vào query task trong `deactivateAssignmentWithWorkCheck`:

```typescript
ne(facilityTasks.status, "COMPLETED"),
```

Không đổi task assignment, không xóa lịch sử, không bỏ transaction/khóa user/membership.

**Step 4: Chạy xanh**

```bash
bun test --cwd apps/api tests/integration/flow5-review-regressions.test.ts
bun test --cwd apps/api tests/integration/flow5-management.test.ts
```

Expected: completed cho phép revoke; mọi công việc mở vẫn chặn.

**Step 5: Graph check và commit riêng**

```bash
node .gitnexus/run.cjs detect-changes --scope all --repo .
git add apps/api/src/modules/facilities/facility-assignments.repository.ts apps/api/tests/integration/flow5-review-regressions.test.ts
git commit -m "fix: allow membership revocation after task completion"
```

## Task 3: Phân biệt rental đã đóng với booking đã check-in — finding 3

**Files:**
- Modify: `apps/api/src/modules/facilities/facilities.repository.ts`
- Test: `apps/api/tests/integration/flow5-review-regressions.test.ts`
- Read lifecycle: `apps/api/src/modules/returns/returns.service.ts`, `apps/api/src/modules/returns/returns.repository.ts`

**Step 1: Viết test đỏ cho trạng thái cuối của luồng returns**

Tạo booking `CHECKED_IN`, rental `CLOSED` có `closedAt`, không có allocation active hoặc assignment active. Đây là dữ liệu kết thúc mà `ReturnsService.settle` lưu: booking không chuyển sang trạng thái mới.

```typescript
const response = await f.api("admin", "PATCH", `/facilities/${f.facilityId}`, {
  isActive: false,
});
expect(response.statusCode).toBe(200);
expect(response.json().data.isActive).toBe(false);
```

Mỗi ca có fixture riêng: rental ACTIVE/RETURN_PENDING/OVERDUE hoặc CHECKED_IN thiếu rental vẫn `409`; CONFIRMED vẫn `409`; hold chưa hết hạn vẫn `409`. Không đổi policy DRAFT trong bản sửa này.

**Step 2: Chạy đỏ**

```bash
bun test --cwd apps/api tests/integration/flow5-review-regressions.test.ts --test-name-pattern 'facility deactivation'
```

Expected: ca closed fail vì trả `409`.

**Step 3: Sửa query hiện có, không đổi lifecycle booking**

Import `rentals` và `ne`. Thêm left join rental theo booking ID, thay predicate status bằng:

```typescript
or(
  inArray(bookings.status, ["DRAFT", "CONFIRMED"]),
  and(
    eq(bookings.status, "CHECKED_IN"),
    or(isNull(rentals.id), ne(rentals.status, "CLOSED")),
  ),
),
```

Giữ query allocation phía sau. Không thêm `CHECKED_OUT`, không sửa snapshot/hợp đồng, không xóa booking lịch sử. `isNull` phải được import từ package database.

**Step 4: Chạy xanh**

```bash
bun test --cwd apps/api tests/integration/flow5-review-regressions.test.ts
bun test --cwd apps/api tests/integration/flow5-management.test.ts
```

Expected: đóng rental thì có thể ngừng cơ sở; nghiệp vụ đang mở vẫn bị chặn. Đây là sửa phân loại lịch sử; không tuyên bố đã sửa toàn bộ race của API deactivate hiện có, nơi check và update đang tách lệnh.

**Step 5: Graph check và commit riêng**

```bash
node .gitnexus/run.cjs detect-changes --scope all --repo .
git add apps/api/src/modules/facilities/facilities.repository.ts apps/api/tests/integration/flow5-review-regressions.test.ts
git commit -m "fix: ignore closed rentals when checking facility operations"
```

## Task 4: Làm mới lịch sử báo cáo cùng task — finding 4

**Files:**
- Modify: `apps/web/src/features/facility-management/hooks.ts`
- Test: `apps/web/e2e/flow5-integration.spec.ts`
- Reuse: `apps/web/e2e/support/flow5-fixture.ts`
- Read caller: `apps/web/src/features/facility-management/task-workspace.tsx`

**Step 1: Thêm E2E đỏ, FM mở detail trước khi FS báo cáo**

Thêm test sau vào suite hiện có; import thêm `f5now` nếu chưa có. Đây là kiểm thử browser với API fixture; backend persistence đã được kiểm tra riêng.

```typescript
test("FM sees a report submitted while task details stay open", async ({ page }) => {
  const state = flow5Fixture();
  const task = state.tasks[0];
  if (!task) throw new Error("Missing task fixture");
  task.status = "IN_PROGRESS";
  task.startedAt = f5now;
  await mockFlow5(page, state);
  await page.goto("/facility-manager/tasks");
  await page.getByRole("button", { name: "Xem chi tiết", exact: true }).click();
  const detail = page.getByRole("region", { name: task.title, exact: true });
  await expect(detail.getByText("Chưa có dữ liệu phù hợp.", { exact: true })).toBeVisible();
  // Install after the initial history request, before testing the polling window.
  await page.clock.install();
  task.status = "AWAITING_APPROVAL";
  state.reports.unshift({
    id: f5id(50), taskId: task.id, submittedBy: f5staff,
    submitterName: "Nhân viên một", content: "Report sent after FM opened details",
    submittedAt: f5now, acceptedBy: null, acceptedByName: null, acceptedAt: null,
  });
  await page.clock.runFor(31_000);
  await expect(detail.getByText("Report sent after FM opened details", { exact: true })).toBeVisible();
  await detail.getByRole("button", {
    name: "Chấp nhận báo cáo và hoàn tất task", exact: true,
  }).click();
  await expect(detail.getByText("Đã hoàn tất", { exact: true })).toBeVisible();
});
```

Nếu fake clock chưa bao phủ timer đã tạo, cài clock trước navigation và dùng `runFor` sau khi history đầu tiên đã xong; không thay bằng sleep cố định 31 giây. Thêm ca FS đang mở detail thấy acceptance cập nhật và không còn editor gửi báo cáo sau COMPLETED.

**Step 2: Chạy đỏ**

```bash
bun run --filter web test:e2e --config flow5.playwright.config.ts --grep 'details stay open'
```

Expected: không thấy report mới/nút duyệt vì hook history không poll.

**Step 3: Thêm một option cho query hiện có**

Trong `useTaskReportHistory`, giữ nguyên query key, signal, limit/offset và enabled; thêm:

```typescript
refetchInterval: 30_000,
```

Không sửa API client hay thêm state copy của history. TanStack chỉ poll query đang được quan sát; không bật `refetchIntervalInBackground`. Giữ nguyên invalidation sau submit/accept.

**Step 4: Chạy xanh và kiểm chứng UI**

```bash
bun run --filter web test:e2e --config flow5.playwright.config.ts --grep 'details stay open'
bun run --filter web test:e2e --config flow5.playwright.config.ts
```

Mở browser desktop và 390px sau tests: FM mở trước report → thấy report mới → duyệt không đóng detail; FS thấy completed; lỗi API hiển thị và hồi phục; draft nội dung không bị polling reset. Kiểm tra navigation, loading, validation, pagination và không nhân đôi report.

Expected: test mới pass cả hai viewport. Bốn snapshot fail baseline phải được đối chiếu ảnh actual/expected; chỉ sửa baseline sau khi xác định khác biệt và kiểm tra trực quan, không tăng tolerance để che lỗi.

**Step 5: Graph check và commit riêng**

```bash
node .gitnexus/run.cjs detect-changes --scope all --repo .
git add apps/web/src/features/facility-management/hooks.ts apps/web/e2e/flow5-integration.spec.ts
git commit -m "fix: refresh task reports while details remain open"
```

## Task 5: Tài liệu, regression và bàn giao

**Files:**
- Modify: `docs/flow5-task-assignment-api.md`
- Modify: `docs/flow5-web-testing.md`
- Modify: `docs/flow-5-backend-plan.md` nếu mô tả còn khẳng định mọi task đều chặn revoke.

**Step 1: Đồng bộ tài liệu theo hành vi cuối**

Ghi rõ policy đổi loại đã chốt; task hoàn tất không chặn revoke; rental closed không chặn deactivate; lịch sử report poll 30 giây. Sửa phần hướng dẫn migration trong API doc theo journal hiện tại: PR đang có `0047_handy_franklin_storm.sql`, không dùng các tên migration cũ đã bị gộp. Web testing doc đang nói chưa có API start/accept: cập nhật theo endpoint thực tế.

**Step 2: Chạy kiểm tra cần thiết một lần sau bản sửa cuối**

```bash
bun run check-types
bun run check
bun run --filter api test:db
bun run --filter web test:e2e --config flow5.playwright.config.ts
```

Expected: không skip DB suites, không phát sinh test fail mới. Runner database gồm Flow 5, checkout/payment, returns; nếu có lỗi baseline phải ghi rõ và xác định không do bản sửa. Không nói toàn bộ pass nếu snapshot vẫn fail.

**Step 3: Kiểm chứng browser với API/DB cô lập**

Chạy API và web trỏ DB test, tạo tài khoản fixture có thể đăng nhập; không seed/reset DB business. Xác nhận bốn case đã review, kiểm tra lại FM/FS/Admin/BOM theo đúng quyền. Không đổi quyền backend để làm nút hoạt động. Giữ ảnh/số liệu kết quả để review.

**Step 4: Graph check, diff và commit tài liệu nếu được phép**

```bash
node .gitnexus/run.cjs detect-changes --scope all --repo .
git diff --check
git status --short
git add docs/flow5-task-assignment-api.md docs/flow5-web-testing.md docs/flow-5-backend-plan.md
git commit -m "docs: document Flow 5 review corrections and validation"
```

Next.js có thể tự sửa `apps/web/next-env.d.ts` theo dist directory khi E2E chạy; kiểm tra và hoàn nguyên riêng thay đổi generated do lần test gây ra. Không stage artifact hoặc ghi đè thay đổi của người khác.

## Điều kiện hoàn tất

- Bốn tình huống lỗi đều có regression đỏ trước sửa và xanh sau sửa.
- Không mất booking capacity đã cam kết khi đổi loại, kể cả checkout đồng thời.
- Completed task/report vẫn được giữ sau revoke; staff mất quyền ngay theo guard hiện có.
- Rental đã closed không khiến cơ sở bị kẹt; rental mở vẫn chặn.
- FM thấy report và duyệt khi detail giữ mở; FS thấy trạng thái hoàn tất.
- Không migration, dependency, API hoặc abstraction mới.
- Báo cáo kết quả ghi rõ snapshot khác biệt, phần chưa kiểm chứng và rủi ro còn lại; không tự push/deploy.

## Giới hạn được giữ nguyên

Policy DRAFT bỏ dở và race check-then-update của facility deactivation không được chứng minh đã giải quyết bởi việc sửa predicate ở Task 3. Không gộp thay đổi policy hoặc refactor payment ngoài những khóa thực sự cần cho finding 1. Không thêm tính năng reject report, hủy task hay tự sinh tài liệu.
