# Storage Customer Backend Completion Implementation Plan

**Goal:** Chia phần backend/database còn thiếu của Storage Customer thành các issue độc lập, có dependency, decision gate và acceptance có thể kiểm chứng.

**Architecture:** Giữ Fastify modular monolith, Route → Service → Repository và PostgreSQL/Drizzle; contracts Zod dùng chung, frontend gọi centralized API client. Dùng booking ownership, capacity, payment adapters, return settlement, notification/storage hiện có. Policy chưa chốt được tách thành decision gate; không khóa schema hoặc viết runtime từ giả định.

**Tech Stack:** Bun, TypeScript, Fastify, Zod, Drizzle/PostgreSQL, Redis/BullMQ, SePay, Cloudinary, GitHub CLI, GitNexus.

---

## Phạm vi và nguồn

- Repository: `vlnguyen910/metastorage`, source pin `f5a0dac1e1fe87eae455551b16a23be3d1368968`, audit 2026-10-24.
- Dùng @writing-plans và @ponytail:ponytail để lập kế hoạch; @metastorage-backend-endpoint khi implementation bắt đầu.
- Chỉ lập kế hoạch/tạo GitHub issues trong đợt này; runtime code, migration, test execution, commit/push/deploy không thuộc tác vụ.
- Worktree: `/tmp/metastorage-customer-backend-plan`, branch `docs/customer-backend-issues-20261024`; working tree người dùng có thay đổi riêng ở package.json/next-env.d.ts được giữ nguyên.
- Đã đọc source/schema/diagram và issue cũ #13, #15, #26, #34, #43, #58–#60, #71–#74, #77, #91–#92, #96, #113, #120, #148. #58/#71 đóng `not_planned`; không coi đó là business approval.
- Local diagram/code đã supersede Customer table + OTP của #77/#92; current ownership là bookings.user_id và magic-link tracking. No-show deadline hiện là slot cuối ngày, supersede 2 giờ trong #13/#91. Giữ các quyết định mới này.
- Các tên bảng/API mới chỉ là proposal nếu decision gate còn TBD. Vì chưa có business approval, kế hoạch không cung cấp runtime implementation giả định; code minh họa dưới đây chỉ cho boundary đã xác định hoặc cách mở rộng integration fixture hiện có.

## Làn thực hiện

1. Làm ngay contract/design cho customer bookings, public availability và phần advance-booking rule đã chốt.
2. Chốt financial policy → charges/payments/reporting → renewal.
3. Chốt support policy → customer support → operational handling.
4. Claim và reschedule hoàn tất sau decision gate riêng; handover exceptions có phase policy trước mutation.
5. Web/Mobile integration được bàn giao qua shared client/API docs; không đánh dấu UI hoàn thiện từ backend tests.

## Checklist thực hiện chuẩn

Mỗi task có files, decision gate, test matrix và commands riêng bên dưới. Mỗi action phải nhỏ; làm một acceptance case theo chu kỳ red → implementation → green rồi commit sau checks. Review schema và graph trước edit, không chạy generated migration bằng tay.

## Ví dụ red test sau khi contract account list được duyệt

Đề xuất contract: `GET /api/bookings/mine?status=CONFIRMED` trả success envelope có `data.items`. Chốt DTO này trước khi triển khai. Trong suite mới, reuse auth/bootstrap/fixture pattern từ `apps/api/tests/integration/rentals-read.test.ts`; tạo ownerCookie và ids.owner, cùng helper createBooking ở fixture scope.

```typescript
test("owner can list their confirmed booking", async () => {
  const bookingId = await createBooking(ids.owner, "CONFIRMED");
  const response = await app.inject({
    method: "GET",
    url: "/api/bookings/mine?status=CONFIRMED",
    headers: { cookie: ownerCookie },
  });
  expect(response.statusCode).toBe(200);
  const body = response.json();
  expect(body.success).toBe(true);
  expect(body.data.items.map((row: { id: string }) => row.id)).toContain(bookingId);
  expect(JSON.stringify(body)).not.toContain("accessTokenHash");
  expect(JSON.stringify(body)).not.toContain("qrTokenHash");
});
```

Đây là phần test hoàn chỉnh đặt trong integration fixture, không phải suite độc lập. Mong đợi RED hiện tại: chưa có owner account-list route; request không thể nhận success list đúng DTO. Thêm case foreign booking, cursor và nhiều payments theo matrix của task 1. Với policy TBD, chỉ viết test sau khi outcome được duyệt; không dùng lỗi 400 chung làm bằng chứng validation vì có thể fail nhầm ở slot/operating hours.

## Danh sách issue

| Key | Issue | Phụ thuộc mới |
| --- | --- | --- |
| customer-bookings | [[Backend][Customer][P0] Bổ sung API booking của tài khoản customer](https://github.com/vlnguyen910/metastorage/issues/157) | — |
| availability | [[Backend][Catalog][P1] Cung cấp availability public theo toàn kỳ thuê](https://github.com/vlnguyen910/metastorage/issues/158) | — |
| reschedule | [[Backend][Booking][P2] Hoàn thiện đổi lịch và giới hạn đặt trước 30 ngày](https://github.com/vlnguyen910/metastorage/issues/159) | — |
| guest-claim | [[Backend][Access][P2] Cho phép lưu guest booking đã xác minh vào tài khoản](https://github.com/vlnguyen910/metastorage/issues/160) | customer-bookings |
| finance-decision | [[Decision][Customer][P1] Chốt policy gia hạn, khoản phải thu và thu công nợ](https://github.com/vlnguyen910/metastorage/issues/161) | — |
| charges-payments | [[Backend][Payments][P1] Thu khoản phải thu, phí phát sinh và đồng bộ báo cáo](https://github.com/vlnguyen910/metastorage/issues/162) | finance-decision |
| renewals | [[Backend][Renewal][P1] Gia hạn rental qua thanh toán và cập nhật lifecycle](https://github.com/vlnguyen910/metastorage/issues/163) | finance-decision, charges-payments |
| support-decision | [[Decision][Support][P1] Chốt phạm vi, quyền và lifecycle hỗ trợ customer](https://github.com/vlnguyen910/metastorage/issues/164) | — |
| support-customer | [[Backend][Support][P1] Tạo và theo dõi yêu cầu hỗ trợ của customer](https://github.com/vlnguyen910/metastorage/issues/165) | support-decision |
| support-operations | [[Backend][Support][P1] Phân công, phản hồi và xử lý ticket hỗ trợ](https://github.com/vlnguyen910/metastorage/issues/166) | support-decision, support-customer |
| handover-exceptions | [[Backend][Handover][P2] Chốt và xử lý ngoại lệ từ chối hoặc không thể bàn giao kho](https://github.com/vlnguyen910/metastorage/issues/167) | — |

## Task 1: [Backend][Customer][P0] Bổ sung API booking của tài khoản customer

## Bối cảnh và phạm vi

Audit source ngày 24/10/2026 tại commit `f5a0dac1e1fe87eae455551b16a23be3d1368968`. Issue này xử lý khoảng trống quan sát được trong code; trạng thái Closed của issue cũ không chứng minh tính năng đã được triển khai. Backend + database + shared contracts/API client + docs/tests trong phạm vi; Web/Mobile UI nằm ngoài phạm vi các issue backend này; cần bàn giao contract để lập việc tích hợp. Không thay đổi runtime trong bước lập kế hoạch.

## Mục tiêu

Customer đăng nhập đọc được danh sách và chi tiết booking của chính mình để thay thế các API reservation legacy đang thiếu.

## Liên quan và phụ thuộc

Lịch sử: #113, #120, #27.

Phụ thuộc: Không có issue mới bắt buộc; decision gate bên dưới vẫn áp dụng.

## Decision gate

- [ ] Chốt có hiển thị DRAFT trong account list không và default view/sort trước khi viết test cho các trường hợp đó.
- [ ] Chốt detail path/DTO trước khi sửa quyền /bookings/:id; không mở quyền chỉ dựa vào CUSTOMER role.

## Công việc backend

- [ ] Thêm GET /api/bookings/mine có phân trang ổn định và bộ lọc trạng thái được chốt; đăng ký route literal trước /bookings/:id.
- [ ] Thiết kế endpoint chi tiết owner riêng, hoặc mở rộng /bookings/:id với nhánh ownership rõ ràng; bảo toàn FM/FS facility scope hiện tại.
- [ ] Owner lấy từ session và bookings.user_id; danh sách/detail không phụ thuộc email contact. Trả DTO lịch/giá snapshot, payment status, assignment/handover progress đã được phép đọc.
- [ ] Bổ sung method api.bookings.mine và method đọc owner detail; bàn giao DTO/migration guide cho Web. Giữ API operational hiện tại hoạt động.

## Database

Chưa cần migration: bookings.user_id và index đã có. Đánh giá index ghép sau khi chốt filter/cursor và kiểm tra query; không thêm bảng Customer.

## Files cần đọc/sửa/tạo

- `Modify: apps/api/src/modules/bookings/bookings.routes.ts`
- `Modify: apps/api/src/modules/bookings/bookings.service.ts`
- `Modify: apps/api/src/modules/bookings/bookings.repository.ts`
- `Modify: apps/api/src/modules/bookings/bookings.messages.ts`
- `Modify: packages/contracts/src/bookings.ts`
- `Modify: packages/contracts/src/bookings.types.ts`
- `Modify: packages/contracts/src/index.ts`
- `Modify: packages/api-client/src/index.ts`
- `Create: apps/api/tests/integration/customer-bookings.test.ts`
- `Create: docs/customer-bookings-api.md`

## Acceptance criteria

- [ ] Unauthenticated không đọc private data; tài khoản khác không đọc booking kể cả biết ID/email.
- [ ] Một booking chỉ xuất hiện một lần khi có nhiều payment attempts; pagination không lặp/mất item khi các giá trị sort bằng nhau.
- [ ] Guest booking user_id=NULL không tự xuất hiện do email trùng; response không lộ accessTokenHash, qrTokenHash hoặc provider secrets.
- [ ] Shared client khớp response thật; tài liệu nêu rõ FE còn phải chuyển dashboard/list/detail khỏi api.reservations.

## Test cases nghiệp vụ

- [ ] Owner/other/guest, anonymous, staff scope regression.
- [ ] Nhiều payment attempts, cursor ties, empty page và dữ liệu nhạy cảm.

## Quy tắc thực hiện

- Dùng @metastorage-backend-endpoint, @writing-plans và @ponytail:ponytail khi triển khai. Route → Service → Repository, Zod contracts dùng chung, Drizzle query builder trước; message constants và dedicated types files theo AGENTS.md.
- Trước sửa symbol: GitNexus query/context/impact upstream, báo callers/processes/risk; HIGH/CRITICAL phải cảnh báo, UNKNOWN phải xác minh bằng text search. Index có thể thiếu flow; graph không thay thế source review.
- Mọi business rule TBD phải được xác nhận trước khi tạo schema hoặc tests phụ thuộc. Đề xuất trong issue chưa phải policy được duyệt.
- Schema: cập nhật docs/db-diagram.md cùng Drizzle, sinh migration bằng `bun run db:generate`; không sửa generated SQL trực tiếp. Giữ dữ liệu/snapshot/audit; không reset hoặc reseed database đang dùng.
- Ưu tiên integration tests route/service/PostgreSQL thật cho authorization, persistence, locks, transaction và replay. Mock tại external adapter boundary. Không tạo unit tests cho CRUD/pass-through; chỉ unit-test policy phức tạp nếu có ích.
- Cập nhật shared exports, API client, fixture/seed bị ảnh hưởng và tài liệu. FE implementation không nằm trong issue này; bàn giao endpoint/DTO/errors/dependencies rõ ràng.

## Kế hoạch thực hiện từng bước

1. Đọc các issue/docs/source ở trên; ghi các quyết định đã có và TBD, đối chiếu với code hiện tại.
2. Với mỗi TBD, viết một ví dụ input/state/outcome và xin xác nhận; tiếp tục phần độc lập. Dừng phần implementation phụ thuộc cho tới khi được chốt.
3. Chạy impact cho từng symbol sắp sửa và liệt kê consumer/fixture/export phải thay.
4. Chốt một DTO hoặc một transition mỗi lượt; cập nhật Zod input/output và OpenAPI tương ứng.
5. Với một acceptance case đã chốt, thêm một integration test nhỏ trong file nêu trên, dùng auth/DB fixture pattern hiện có.
6. Chạy riêng test mới; mong đợi FAIL vì endpoint/behavior chưa có, không chấp nhận lỗi môi trường như red test.
7. Nếu case cần schema: cập nhật diagram rồi Drizzle, generate/migrate trên DB test đã được cấu hình. Nếu không cần schema thì bỏ bước migration.
8. Implement một query/transition tối thiểu theo Route → Service → Repository; chạy lại case cho tới PASS.
9. Lặp bước 5–8 cho authorization, constraint/transaction và retry/concurrency trong test matrix. Không thêm behavior chưa được duyệt.
10. Cập nhật client/exports/docs/fixtures; chạy regression liên quan và type/lint checks bên dưới.
11. Trước mỗi commit: `node .gitnexus/run.cjs detect-changes --scope all --repo .`; nếu partial/truncated thì tăng giới hạn hoặc xác minh thêm và ghi rõ giới hạn.
12. Commit nhỏ sau khi checks của phần đó pass, ví dụ `feat: add customer booking read APIs`; issue chỉ đóng khi mọi AC đạt và integration chạy thực sự.

Mỗi bước tạo test/query/contract nên chia tiếp theo một case 2–5 phút; không coi toàn bộ module là một bước. Với decision-only issue, đầu ra là policy/decision matrix được duyệt; không thực hiện runtime steps 4–9.

## Lệnh kiểm chứng

Chạy từ repository root. Cấu hình DB/Redis test theo `docs/local-database-tests.md`; DB phải loopback riêng có tên `metastorage_inspection_test_*`, không dùng development/production. Các suite opt-in phải có env guard và chạy thật, không đếm skip là pass. Khi cần fixtures auth/mail/provider dùng credentials test.

```sh
bun test apps/api/tests/integration/customer-bookings.test.ts
bun run --filter api check-types
bun run --filter @metastorage/contracts check-types
bun run --filter @metastorage/database check-types
bun run --filter @metastorage/api-client check-types
bun run --filter api lint
bun run --filter @metastorage/contracts lint
bun run --filter @metastorage/database lint
bun run --filter @metastorage/api-client lint
git diff --check
```

Expected: selected test cases PASS, 0 skipped trong phạm vi yêu cầu; type/lint exit 0. Với decision-only issue chỉ `git diff --check` và review policy, không chạy suite runtime vô nghĩa. Regression phải chọn theo call graph của diff; không chạy toàn bộ suite để thay cho việc chọn đúng test. Nếu có UI thay đổi ở follow-up, chạy flow E2E và kiểm tra UI trong browser theo AGENTS.md trước khi nghiệm thu UI.

---

## Task 2: [Backend][Catalog][P1] Cung cấp availability public theo toàn kỳ thuê

## Bối cảnh và phạm vi

Audit source ngày 24/10/2026 tại commit `f5a0dac1e1fe87eae455551b16a23be3d1368968`. Issue này xử lý khoảng trống quan sát được trong code; trạng thái Closed của issue cũ không chứng minh tính năng đã được triển khai. Backend + database + shared contracts/API client + docs/tests trong phạm vi; Web/Mobile UI nằm ngoài phạm vi các issue backend này; cần bàn giao contract để lập việc tích hợp. Không thay đổi runtime trong bước lập kế hoạch.

## Mục tiêu

Visitor biết số lượng Unit Type có thể đặt tại facility trong kỳ thuê mong muốn trước khi tạo checkout.

## Liên quan và phụ thuộc

Lịch sử: #15, #120, #13.

Phụ thuộc: Không có issue mới bắt buộc; decision gate bên dưới vẫn áp dụng.

## Decision gate

- [ ] Chốt HTTP path/response dùng chung với consumer trước implementation. Capacity theo toàn kỳ và customer chọn Unit Type đã được quyết định.
- [ ] Đồng bộ mô tả public catalog cũ trong diagram với hành vi capacity được duyệt; không âm thầm đổi catalog inclusion/filter.

## Công việc backend

- [ ] Định nghĩa public endpoint/input facility + unit type (hoặc danh sách type) + ngày/slot + duration; tái sử dụng slot/timezone validation hiện có.
- [ ] Dùng getAvailableCapacity làm cùng nguồn tính với draft/start-payment; response có period, availableCount và asOf. Không expose booking/customer hoặc danh sách private assignments.
- [ ] Kiểm tra type/facility/offering active, kỳ thuê hợp lệ và operating hours theo policy hiện tại. Không tự tính occupied unit sẽ trống dựa trên expected return.
- [ ] Read không tạo draft/hold hoặc reserve physical unit; start-payment vẫn recheck dưới lock hiện tại. Shared client và docs mô tả count là snapshot.

## Database

Chưa cần migration; dùng storage_units, unit_assignments, capacity_allocations và bookings. Index mới chỉ khi truy vấn thực tế chứng minh cần.

## Files cần đọc/sửa/tạo

- `Modify: apps/api/src/modules/facilities/facilities.routes.ts`
- `Modify: apps/api/src/modules/storage-units/storage-units.service.ts`
- `Modify: apps/api/src/modules/storage-units/storage-units.repository.ts`
- `Modify: packages/contracts/src/facilities.ts`
- `Modify: packages/contracts/src/facilities.types.ts`
- `Modify: packages/api-client/src/index.ts`
- `Create: apps/api/tests/integration/customer-availability.test.ts`
- `Modify: docs/flow1-api-integration.md`
- `Modify: docs/db-diagram.md`

## Acceptance criteria

- [ ] Anonymous gọi thành công, API không yêu cầu account và không có side effect.
- [ ] Count đúng với active hold, expired hold, overlap/boundary và BOOKING đã assign; không trừ allocation hai lần.
- [ ] AVAILABLE/RESERVED/OCCUPIED/MAINTENANCE và inactive offering/type theo đúng capacity policy hiện tại.
- [ ] Regression last-capacity checkout vẫn đảm bảo chỉ một booking nhận được capacity.

## Test cases nghiệp vụ

- [ ] Anonymous/invalid period/inactive offering; hold expiry; overlap và hai interval nối tiếp.
- [ ] Assigned booking không double count; current rental/maintenance không được forecast thành available.

## Quy tắc thực hiện

- Dùng @metastorage-backend-endpoint, @writing-plans và @ponytail:ponytail khi triển khai. Route → Service → Repository, Zod contracts dùng chung, Drizzle query builder trước; message constants và dedicated types files theo AGENTS.md.
- Trước sửa symbol: GitNexus query/context/impact upstream, báo callers/processes/risk; HIGH/CRITICAL phải cảnh báo, UNKNOWN phải xác minh bằng text search. Index có thể thiếu flow; graph không thay thế source review.
- Mọi business rule TBD phải được xác nhận trước khi tạo schema hoặc tests phụ thuộc. Đề xuất trong issue chưa phải policy được duyệt.
- Schema: cập nhật docs/db-diagram.md cùng Drizzle, sinh migration bằng `bun run db:generate`; không sửa generated SQL trực tiếp. Giữ dữ liệu/snapshot/audit; không reset hoặc reseed database đang dùng.
- Ưu tiên integration tests route/service/PostgreSQL thật cho authorization, persistence, locks, transaction và replay. Mock tại external adapter boundary. Không tạo unit tests cho CRUD/pass-through; chỉ unit-test policy phức tạp nếu có ích.
- Cập nhật shared exports, API client, fixture/seed bị ảnh hưởng và tài liệu. FE implementation không nằm trong issue này; bàn giao endpoint/DTO/errors/dependencies rõ ràng.

## Kế hoạch thực hiện từng bước

1. Đọc các issue/docs/source ở trên; ghi các quyết định đã có và TBD, đối chiếu với code hiện tại.
2. Với mỗi TBD, viết một ví dụ input/state/outcome và xin xác nhận; tiếp tục phần độc lập. Dừng phần implementation phụ thuộc cho tới khi được chốt.
3. Chạy impact cho từng symbol sắp sửa và liệt kê consumer/fixture/export phải thay.
4. Chốt một DTO hoặc một transition mỗi lượt; cập nhật Zod input/output và OpenAPI tương ứng.
5. Với một acceptance case đã chốt, thêm một integration test nhỏ trong file nêu trên, dùng auth/DB fixture pattern hiện có.
6. Chạy riêng test mới; mong đợi FAIL vì endpoint/behavior chưa có, không chấp nhận lỗi môi trường như red test.
7. Nếu case cần schema: cập nhật diagram rồi Drizzle, generate/migrate trên DB test đã được cấu hình. Nếu không cần schema thì bỏ bước migration.
8. Implement một query/transition tối thiểu theo Route → Service → Repository; chạy lại case cho tới PASS.
9. Lặp bước 5–8 cho authorization, constraint/transaction và retry/concurrency trong test matrix. Không thêm behavior chưa được duyệt.
10. Cập nhật client/exports/docs/fixtures; chạy regression liên quan và type/lint checks bên dưới.
11. Trước mỗi commit: `node .gitnexus/run.cjs detect-changes --scope all --repo .`; nếu partial/truncated thì tăng giới hạn hoặc xác minh thêm và ghi rõ giới hạn.
12. Commit nhỏ sau khi checks của phần đó pass, ví dụ `feat: expose public rental period availability`; issue chỉ đóng khi mọi AC đạt và integration chạy thực sự.

Mỗi bước tạo test/query/contract nên chia tiếp theo một case 2–5 phút; không coi toàn bộ module là một bước. Với decision-only issue, đầu ra là policy/decision matrix được duyệt; không thực hiện runtime steps 4–9.

## Lệnh kiểm chứng

Chạy từ repository root. Cấu hình DB/Redis test theo `docs/local-database-tests.md`; DB phải loopback riêng có tên `metastorage_inspection_test_*`, không dùng development/production. Các suite opt-in phải có env guard và chạy thật, không đếm skip là pass. Khi cần fixtures auth/mail/provider dùng credentials test.

```sh
bun test apps/api/tests/integration/customer-availability.test.ts
bun run --filter api check-types
bun run --filter @metastorage/contracts check-types
bun run --filter @metastorage/database check-types
bun run --filter @metastorage/api-client check-types
bun run --filter api lint
bun run --filter @metastorage/contracts lint
bun run --filter @metastorage/database lint
bun run --filter @metastorage/api-client lint
git diff --check
```

Expected: selected test cases PASS, 0 skipped trong phạm vi yêu cầu; type/lint exit 0. Với decision-only issue chỉ `git diff --check` và review policy, không chạy suite runtime vô nghĩa. Regression phải chọn theo call graph của diff; không chạy toàn bộ suite để thay cho việc chọn đúng test. Nếu có UI thay đổi ở follow-up, chạy flow E2E và kiểm tra UI trong browser theo AGENTS.md trước khi nghiệm thu UI.

---

## Task 3: [Backend][Booking][P2] Hoàn thiện đổi lịch và giới hạn đặt trước 30 ngày

## Bối cảnh và phạm vi

Audit source ngày 24/10/2026 tại commit `f5a0dac1e1fe87eae455551b16a23be3d1368968`. Issue này xử lý khoảng trống quan sát được trong code; trạng thái Closed của issue cũ không chứng minh tính năng đã được triển khai. Backend + database + shared contracts/API client + docs/tests trong phạm vi; Web/Mobile UI nằm ngoài phạm vi các issue backend này; cần bàn giao contract để lập việc tích hợp. Không thay đổi runtime trong bước lập kế hoạch.

## Mục tiêu

Triển khai phần còn thiếu của policy booking đã chốt, giữ nguyên payment và no-show hiện tại.

## Liên quan và phụ thuộc

Lịch sử: #13, #91, #113.

Phụ thuộc: Không có issue mới bắt buộc; decision gate bên dưới vẫn áp dụng.

## Decision gate

- [ ] Chốt quyền reschedule của guest: checkout token hay verified tracking session; không tự mở rộng guest-session scope.
- [ ] Chốt cách xử lý booking đã assign/VERIFIED nhưng chưa handover và hạn 30 ngày tính từ lúc nào khi đổi lịch.
- [ ] Chốt tháng cuối ngày 29/30/31 theo một calendar-month policy dùng chung trước khi thêm logic date mới.

## Công việc backend

- [ ] Áp giới hạn tạo booking trước tối đa 30 ngày, ngày sớm nhất ngày mai theo Asia/Ho_Chi_Minh; cập nhật fixtures dùng ngày cố định xa trong tương lai.
- [ ] Reschedule chỉ CONFIRMED, chưa handover/rental active, trước lịch hiện tại ít nhất 24h, tối đa hai lần; giữ facility/type/duration và toàn bộ monetary snapshot.
- [ ] Recheck toàn kỳ mới, loại phần allocation của chính booking khỏi phép tính phù hợp; đổi schedule/rentalEndAt/allocation/history trong cùng transaction.
- [ ] Bảo vệ race reschedule với cancel/no-show/assign/verify; xác định invalidation/reassignment theo decision gate. Request retry không dùng thêm một lượt.

## Database

Đề xuất reschedule_count có CHECK 0..2 hoặc derive từ history; chốt một nguồn authoritative. History lưu before/after, actor/source, idempotency và thời điểm, FK và unique replay. Cập nhật diagram và generate migration.

## Files cần đọc/sửa/tạo

- `Modify: apps/api/src/modules/bookings/bookings.routes.ts`
- `Modify: apps/api/src/modules/bookings/bookings.service.ts`
- `Modify: apps/api/src/modules/bookings/bookings.repository.ts`
- `Modify: packages/contracts/src/bookings.ts`
- `Modify: packages/contracts/src/bookings.types.ts`
- `Modify: packages/database/src/schema/bookings.ts`
- `Create: packages/database/src/schema/booking-reschedule-history.ts`
- `Modify: packages/database/src/schema/index.ts`
- `Modify: packages/database/src/schema/relations.ts`
- `Modify: packages/api-client/src/index.ts`
- `Create: apps/api/tests/integration/booking-reschedule.test.ts`
- `Modify: apps/api/tests/integration/booking-drafts.test.ts`
- `Modify: apps/api/tests/integration/booking-payment-start.test.ts`
- `Modify: docs/booking-cancellation-policy.md`
- `Modify: docs/db-diagram.md`

## Acceptance criteria

- [ ] Đúng boundary 24h/30 ngày; lần thứ ba bị chặn; thất bại không thay schedule/count/history/allocations.
- [ ] Lưu lịch trước/sau, actor/source và idempotency; hai requests đồng thời không vượt hai lần hoặc giữ sai capacity.
- [ ] No-show vẫn dùng cuối slot cuối ngày theo code/docs hiện tại; không khôi phục grace 2 giờ từ issue cũ.
- [ ] Payment đã trả và contact snapshots bất biến.

## Test cases nghiệp vụ

- [ ] Boundary ngày Việt Nam; giữ nguyên giá và duration; capacity conflict rollback.
- [ ] Concurrent/replay và cancel/verify race; sai ownership; trạng thái đã bàn giao.

## Quy tắc thực hiện

- Dùng @metastorage-backend-endpoint, @writing-plans và @ponytail:ponytail khi triển khai. Route → Service → Repository, Zod contracts dùng chung, Drizzle query builder trước; message constants và dedicated types files theo AGENTS.md.
- Trước sửa symbol: GitNexus query/context/impact upstream, báo callers/processes/risk; HIGH/CRITICAL phải cảnh báo, UNKNOWN phải xác minh bằng text search. Index có thể thiếu flow; graph không thay thế source review.
- Mọi business rule TBD phải được xác nhận trước khi tạo schema hoặc tests phụ thuộc. Đề xuất trong issue chưa phải policy được duyệt.
- Schema: cập nhật docs/db-diagram.md cùng Drizzle, sinh migration bằng `bun run db:generate`; không sửa generated SQL trực tiếp. Giữ dữ liệu/snapshot/audit; không reset hoặc reseed database đang dùng.
- Ưu tiên integration tests route/service/PostgreSQL thật cho authorization, persistence, locks, transaction và replay. Mock tại external adapter boundary. Không tạo unit tests cho CRUD/pass-through; chỉ unit-test policy phức tạp nếu có ích.
- Cập nhật shared exports, API client, fixture/seed bị ảnh hưởng và tài liệu. FE implementation không nằm trong issue này; bàn giao endpoint/DTO/errors/dependencies rõ ràng.

## Kế hoạch thực hiện từng bước

1. Đọc các issue/docs/source ở trên; ghi các quyết định đã có và TBD, đối chiếu với code hiện tại.
2. Với mỗi TBD, viết một ví dụ input/state/outcome và xin xác nhận; tiếp tục phần độc lập. Dừng phần implementation phụ thuộc cho tới khi được chốt.
3. Chạy impact cho từng symbol sắp sửa và liệt kê consumer/fixture/export phải thay.
4. Chốt một DTO hoặc một transition mỗi lượt; cập nhật Zod input/output và OpenAPI tương ứng.
5. Với một acceptance case đã chốt, thêm một integration test nhỏ trong file nêu trên, dùng auth/DB fixture pattern hiện có.
6. Chạy riêng test mới; mong đợi FAIL vì endpoint/behavior chưa có, không chấp nhận lỗi môi trường như red test.
7. Nếu case cần schema: cập nhật diagram rồi Drizzle, generate/migrate trên DB test đã được cấu hình. Nếu không cần schema thì bỏ bước migration.
8. Implement một query/transition tối thiểu theo Route → Service → Repository; chạy lại case cho tới PASS.
9. Lặp bước 5–8 cho authorization, constraint/transaction và retry/concurrency trong test matrix. Không thêm behavior chưa được duyệt.
10. Cập nhật client/exports/docs/fixtures; chạy regression liên quan và type/lint checks bên dưới.
11. Trước mỗi commit: `node .gitnexus/run.cjs detect-changes --scope all --repo .`; nếu partial/truncated thì tăng giới hạn hoặc xác minh thêm và ghi rõ giới hạn.
12. Commit nhỏ sau khi checks của phần đó pass, ví dụ `feat: implement booking reschedule policy`; issue chỉ đóng khi mọi AC đạt và integration chạy thực sự.

Mỗi bước tạo test/query/contract nên chia tiếp theo một case 2–5 phút; không coi toàn bộ module là một bước. Với decision-only issue, đầu ra là policy/decision matrix được duyệt; không thực hiện runtime steps 4–9.

## Lệnh kiểm chứng

Chạy từ repository root. Cấu hình DB/Redis test theo `docs/local-database-tests.md`; DB phải loopback riêng có tên `metastorage_inspection_test_*`, không dùng development/production. Các suite opt-in phải có env guard và chạy thật, không đếm skip là pass. Khi cần fixtures auth/mail/provider dùng credentials test.

```sh
bun test apps/api/tests/integration/booking-reschedule.test.ts
bun run --filter api check-types
bun run --filter @metastorage/contracts check-types
bun run --filter @metastorage/database check-types
bun run --filter @metastorage/api-client check-types
bun run --filter api lint
bun run --filter @metastorage/contracts lint
bun run --filter @metastorage/database lint
bun run --filter @metastorage/api-client lint
git diff --check
```

Expected: selected test cases PASS, 0 skipped trong phạm vi yêu cầu; type/lint exit 0. Với decision-only issue chỉ `git diff --check` và review policy, không chạy suite runtime vô nghĩa. Regression phải chọn theo call graph của diff; không chạy toàn bộ suite để thay cho việc chọn đúng test. Nếu có UI thay đổi ở follow-up, chạy flow E2E và kiểm tra UI trong browser theo AGENTS.md trước khi nghiệm thu UI.

---

## Task 4: [Backend][Access][P2] Cho phép lưu guest booking đã xác minh vào tài khoản

## Bối cảnh và phạm vi

Audit source ngày 24/10/2026 tại commit `f5a0dac1e1fe87eae455551b16a23be3d1368968`. Issue này xử lý khoảng trống quan sát được trong code; trạng thái Closed của issue cũ không chứng minh tính năng đã được triển khai. Backend + database + shared contracts/API client + docs/tests trong phạm vi; Web/Mobile UI nằm ngoài phạm vi các issue backend này; cần bàn giao contract để lập việc tích hợp. Không thay đổi runtime trong bước lập kế hoạch.

## Mục tiêu

Customer chủ động lưu một guest booking đã chứng minh quyền truy cập vào account để xem trong My Storage.

## Liên quan và phụ thuộc

Lịch sử: #77, #92, #112, #113.

Phụ thuộc: https://github.com/vlnguyen910/metastorage/issues/157

## Decision gate

- [ ] Diagram hiện tại supersede Customer model/OTP trong #77/#92: giữ bookings.user_id và magic-link session, không dựng lại customers hoặc OTP chỉ vì issue cũ.
- [ ] Chốt proof freshness/reauth, policy khi đã có owner, cùng-owner replay và việc revoke guest session sau claim. Đây là gate trước implementation.

## Công việc backend

- [ ] Yêu cầu active CUSTOMER session và booking verification được duyệt; action Save to account explicit. Lấy userId từ auth session.
- [ ] Khóa booking, xác minh ownership hiện tại và cập nhật bookings.user_id cùng audit atomically; claim chỉ đúng một booking.
- [ ] Đảm bảo rental/payment account reads thấy booking đã claim qua ownership hiện tại; không sửa contact, payment/rental history hay issued PDF.
- [ ] Giữ public guest tracking và permissions hiện tại; shared client có method claim và error contract.

## Database

Ưu tiên bookings.user_id và booking_access_audit hiện có; chưa có lý do tạo bảng claim mới. Chỉ migration nếu audit đã duyệt cần field/constraint còn thiếu.

## Files cần đọc/sửa/tạo

- `Modify: apps/api/src/modules/guest-rental-access/guest-rental-access.routes.ts`
- `Modify: apps/api/src/modules/guest-rental-access/guest-rental-access.service.ts`
- `Modify: apps/api/src/modules/guest-rental-access/guest-rental-access.repository.ts`
- `Modify: apps/api/src/modules/guest-rental-access/guest-rental-access.types.ts`
- `Modify: packages/contracts/src/bookings.ts`
- `Modify: packages/api-client/src/index.ts`
- `Modify: packages/database/src/schema/booking-access-audit.ts (chỉ nếu audit hiện tại không đủ)`
- `Create: apps/api/tests/integration/guest-booking-claim.test.ts`
- `Modify: docs/booking-tracking.md`
- `Modify: docs/db-diagram.md`

## Acceptance criteria

- [ ] ID/email text hoặc login đơn thuần không đủ claim; không auto-attach khi đăng ký/OAuth/email verification.
- [ ] Hai account claim đồng thời không thể cùng thắng; same-owner retry không tạo ownership/audit sai.
- [ ] Không claim booking ngoài proof scope; tokens không nằm trong URL/log/audit.
- [ ] Sau claim đọc mine/rental được; dữ liệu booking khác giữ nguyên.

## Test cases nghiệp vụ

- [ ] Auth + proof matrix, expired/revoked proof, cross-booking denial.
- [ ] Concurrent claim, retry và post-claim My Storage ownership.

## Quy tắc thực hiện

- Dùng @metastorage-backend-endpoint, @writing-plans và @ponytail:ponytail khi triển khai. Route → Service → Repository, Zod contracts dùng chung, Drizzle query builder trước; message constants và dedicated types files theo AGENTS.md.
- Trước sửa symbol: GitNexus query/context/impact upstream, báo callers/processes/risk; HIGH/CRITICAL phải cảnh báo, UNKNOWN phải xác minh bằng text search. Index có thể thiếu flow; graph không thay thế source review.
- Mọi business rule TBD phải được xác nhận trước khi tạo schema hoặc tests phụ thuộc. Đề xuất trong issue chưa phải policy được duyệt.
- Schema: cập nhật docs/db-diagram.md cùng Drizzle, sinh migration bằng `bun run db:generate`; không sửa generated SQL trực tiếp. Giữ dữ liệu/snapshot/audit; không reset hoặc reseed database đang dùng.
- Ưu tiên integration tests route/service/PostgreSQL thật cho authorization, persistence, locks, transaction và replay. Mock tại external adapter boundary. Không tạo unit tests cho CRUD/pass-through; chỉ unit-test policy phức tạp nếu có ích.
- Cập nhật shared exports, API client, fixture/seed bị ảnh hưởng và tài liệu. FE implementation không nằm trong issue này; bàn giao endpoint/DTO/errors/dependencies rõ ràng.

## Kế hoạch thực hiện từng bước

1. Đọc các issue/docs/source ở trên; ghi các quyết định đã có và TBD, đối chiếu với code hiện tại.
2. Với mỗi TBD, viết một ví dụ input/state/outcome và xin xác nhận; tiếp tục phần độc lập. Dừng phần implementation phụ thuộc cho tới khi được chốt.
3. Chạy impact cho từng symbol sắp sửa và liệt kê consumer/fixture/export phải thay.
4. Chốt một DTO hoặc một transition mỗi lượt; cập nhật Zod input/output và OpenAPI tương ứng.
5. Với một acceptance case đã chốt, thêm một integration test nhỏ trong file nêu trên, dùng auth/DB fixture pattern hiện có.
6. Chạy riêng test mới; mong đợi FAIL vì endpoint/behavior chưa có, không chấp nhận lỗi môi trường như red test.
7. Nếu case cần schema: cập nhật diagram rồi Drizzle, generate/migrate trên DB test đã được cấu hình. Nếu không cần schema thì bỏ bước migration.
8. Implement một query/transition tối thiểu theo Route → Service → Repository; chạy lại case cho tới PASS.
9. Lặp bước 5–8 cho authorization, constraint/transaction và retry/concurrency trong test matrix. Không thêm behavior chưa được duyệt.
10. Cập nhật client/exports/docs/fixtures; chạy regression liên quan và type/lint checks bên dưới.
11. Trước mỗi commit: `node .gitnexus/run.cjs detect-changes --scope all --repo .`; nếu partial/truncated thì tăng giới hạn hoặc xác minh thêm và ghi rõ giới hạn.
12. Commit nhỏ sau khi checks của phần đó pass, ví dụ `feat: add verified guest booking account claim`; issue chỉ đóng khi mọi AC đạt và integration chạy thực sự.

Mỗi bước tạo test/query/contract nên chia tiếp theo một case 2–5 phút; không coi toàn bộ module là một bước. Với decision-only issue, đầu ra là policy/decision matrix được duyệt; không thực hiện runtime steps 4–9.

## Lệnh kiểm chứng

Chạy từ repository root. Cấu hình DB/Redis test theo `docs/local-database-tests.md`; DB phải loopback riêng có tên `metastorage_inspection_test_*`, không dùng development/production. Các suite opt-in phải có env guard và chạy thật, không đếm skip là pass. Khi cần fixtures auth/mail/provider dùng credentials test.

```sh
bun test apps/api/tests/integration/guest-booking-claim.test.ts
bun run --filter api check-types
bun run --filter @metastorage/contracts check-types
bun run --filter @metastorage/database check-types
bun run --filter @metastorage/api-client check-types
bun run --filter api lint
bun run --filter @metastorage/contracts lint
bun run --filter @metastorage/database lint
bun run --filter @metastorage/api-client lint
git diff --check
```

Expected: selected test cases PASS, 0 skipped trong phạm vi yêu cầu; type/lint exit 0. Với decision-only issue chỉ `git diff --check` và review policy, không chạy suite runtime vô nghĩa. Regression phải chọn theo call graph của diff; không chạy toàn bộ suite để thay cho việc chọn đúng test. Nếu có UI thay đổi ở follow-up, chạy flow E2E và kiểm tra UI trong browser theo AGENTS.md trước khi nghiệm thu UI.

---

## Task 5: [Decision][Customer][P1] Chốt policy gia hạn, khoản phải thu và thu công nợ

## Bối cảnh và phạm vi

Audit source ngày 24/10/2026 tại commit `f5a0dac1e1fe87eae455551b16a23be3d1368968`. Issue này xử lý khoảng trống quan sát được trong code; trạng thái Closed của issue cũ không chứng minh tính năng đã được triển khai. Backend + database + shared contracts/API client + docs/tests trong phạm vi; Web/Mobile UI nằm ngoài phạm vi các issue backend này; cần bàn giao contract để lập việc tích hợp. Không thay đổi runtime trong bước lập kế hoạch.

## Mục tiêu

Chốt đủ business rules và mô hình tiền để triển khai renewal/extra charges tương thích checkout, return và reports hiện tại.

## Liên quan và phụ thuộc

Lịch sử: #58, #59, #60, #96, #34, #36, #43, #148.

Phụ thuộc: Không có issue mới bắt buộc; decision gate bên dưới vẫn áp dụng.

## Decision gate

- [ ] Toàn bộ lựa chọn trên cần business review; việc tạo issue này chỉ cho phép phân tích/lập proposal.
- [ ] Quy định reminder/overdue hiện đã có trong system_settings/returns phải được tái sử dụng; chỉ bổ sung phần renewal còn thiếu.

## Công việc backend

- [ ] Chốt renewal eligibility/window/cutoff, approval/payment order, current vs new rate, deposit top-up, return/overdue/debt restrictions và end-of-month behavior.
- [ ] Đối chiếu ví dụ kho cuối cùng ở #96: cutoff được đề xuất chưa được xem là quyết định; nêu tác động tới capacity hiện chỉ bán inventory sẵn sàng.
- [ ] Chốt loại extra charge, người tạo/duyệt/waive, chứng cứ, khiếu nại, due date; quyết định partial payment, tại quầy, provider và currency cho MVP.
- [ ] Định nghĩa khoản phải thu khác payment attempt, sources RENEWAL/EXTRA/RETURN_DEBT, liên kết settlement revision; cách xử lý correction khi khoản nợ đã được thu.
- [ ] Chốt recognition của renewal/extra/deposit/refund trong reports và refund cap theo nguồn; giữ checkout initial-rent+deposit hiện tại trừ khi có quyết định đổi explicit.
- [ ] Chốt renewal agreement/phụ lục sau handover vì hợp đồng hiện tại immutable và không cho issue sau bàn giao.

## Database

Chưa generate migration hoặc khóa tên bảng/enum khi policy còn TBD. Đầu ra gồm diagram đề xuất đã duyệt và phạm vi migration cho implementation.

## Files cần đọc/sửa/tạo

- `Create: docs/customer-financial-policy.md`
- `Modify: docs/db-diagram.md (chỉ phần model đề xuất đã được duyệt)`
- `Read: docs/booking-payment.md`
- `Read: docs/returns-api.md`
- `Read: docs/system-settings.md`
- `Read: packages/database/src/schema/payments.ts`
- `Read: apps/api/src/modules/reports/reports.repository.ts`
- `Read: apps/api/src/modules/returns/returns.policy.ts`

## Acceptance criteria

- [ ] Có decision table: câu hỏi, lựa chọn được duyệt, người/ngày xác nhận, ví dụ tiền/kỳ thuê và state transitions.
- [ ] Ví dụ bao gồm last unit, month-end, payment muộn/failed/replay, renewal-return race và settlement correction sau collection.
- [ ] Mọi lựa chọn chưa chốt ghi TBD, issue implementation phụ thuộc vẫn blocked; closed/not_planned trên issue cũ không phải approval.
- [ ] Có model/contract proposal đủ cụ thể cho hai issue phụ thuộc và accounting examples không tính cọc thành tiền thuê.

## Test cases nghiệp vụ

- [ ] Review bảng tính ví dụ và transition/permission matrix; chưa thêm runtime test khi chưa có behavior được duyệt.

## Quy tắc thực hiện

- Dùng @metastorage-backend-endpoint, @writing-plans và @ponytail:ponytail khi triển khai. Route → Service → Repository, Zod contracts dùng chung, Drizzle query builder trước; message constants và dedicated types files theo AGENTS.md.
- Trước sửa symbol: GitNexus query/context/impact upstream, báo callers/processes/risk; HIGH/CRITICAL phải cảnh báo, UNKNOWN phải xác minh bằng text search. Index có thể thiếu flow; graph không thay thế source review.
- Mọi business rule TBD phải được xác nhận trước khi tạo schema hoặc tests phụ thuộc. Đề xuất trong issue chưa phải policy được duyệt.
- Schema: cập nhật docs/db-diagram.md cùng Drizzle, sinh migration bằng `bun run db:generate`; không sửa generated SQL trực tiếp. Giữ dữ liệu/snapshot/audit; không reset hoặc reseed database đang dùng.
- Ưu tiên integration tests route/service/PostgreSQL thật cho authorization, persistence, locks, transaction và replay. Mock tại external adapter boundary. Không tạo unit tests cho CRUD/pass-through; chỉ unit-test policy phức tạp nếu có ích.
- Cập nhật shared exports, API client, fixture/seed bị ảnh hưởng và tài liệu. FE implementation không nằm trong issue này; bàn giao endpoint/DTO/errors/dependencies rõ ràng.

## Kế hoạch thực hiện từng bước

1. Đọc các issue/docs/source ở trên; ghi các quyết định đã có và TBD, đối chiếu với code hiện tại.
2. Với mỗi TBD, viết một ví dụ input/state/outcome và xin xác nhận; tiếp tục phần độc lập. Dừng phần implementation phụ thuộc cho tới khi được chốt.
3. Chạy impact cho từng symbol sắp sửa và liệt kê consumer/fixture/export phải thay.
4. Chốt một DTO hoặc một transition mỗi lượt; cập nhật Zod input/output và OpenAPI tương ứng.
5. Với một acceptance case đã chốt, thêm một integration test nhỏ trong file nêu trên, dùng auth/DB fixture pattern hiện có.
6. Chạy riêng test mới; mong đợi FAIL vì endpoint/behavior chưa có, không chấp nhận lỗi môi trường như red test.
7. Nếu case cần schema: cập nhật diagram rồi Drizzle, generate/migrate trên DB test đã được cấu hình. Nếu không cần schema thì bỏ bước migration.
8. Implement một query/transition tối thiểu theo Route → Service → Repository; chạy lại case cho tới PASS.
9. Lặp bước 5–8 cho authorization, constraint/transaction và retry/concurrency trong test matrix. Không thêm behavior chưa được duyệt.
10. Cập nhật client/exports/docs/fixtures; chạy regression liên quan và type/lint checks bên dưới.
11. Trước mỗi commit: `node .gitnexus/run.cjs detect-changes --scope all --repo .`; nếu partial/truncated thì tăng giới hạn hoặc xác minh thêm và ghi rõ giới hạn.
12. Commit nhỏ sau khi checks của phần đó pass, ví dụ `docs: define customer financial policy`; issue chỉ đóng khi mọi AC đạt và integration chạy thực sự.

Mỗi bước tạo test/query/contract nên chia tiếp theo một case 2–5 phút; không coi toàn bộ module là một bước. Với decision-only issue, đầu ra là policy/decision matrix được duyệt; không thực hiện runtime steps 4–9.

## Lệnh kiểm chứng

Chạy từ repository root. Cấu hình DB/Redis test theo `docs/local-database-tests.md`; DB phải loopback riêng có tên `metastorage_inspection_test_*`, không dùng development/production. Các suite opt-in phải có env guard và chạy thật, không đếm skip là pass. Khi cần fixtures auth/mail/provider dùng credentials test.

```sh
git diff --check
bun run --filter api check-types
bun run --filter @metastorage/contracts check-types
bun run --filter @metastorage/database check-types
bun run --filter @metastorage/api-client check-types
bun run --filter api lint
bun run --filter @metastorage/contracts lint
bun run --filter @metastorage/database lint
bun run --filter @metastorage/api-client lint
git diff --check
```

Expected: selected test cases PASS, 0 skipped trong phạm vi yêu cầu; type/lint exit 0. Với decision-only issue chỉ `git diff --check` và review policy, không chạy suite runtime vô nghĩa. Regression phải chọn theo call graph của diff; không chạy toàn bộ suite để thay cho việc chọn đúng test. Nếu có UI thay đổi ở follow-up, chạy flow E2E và kiểm tra UI trong browser theo AGENTS.md trước khi nghiệm thu UI.

---

## Task 6: [Backend][Payments][P1] Thu khoản phải thu, phí phát sinh và đồng bộ báo cáo

## Bối cảnh và phạm vi

Audit source ngày 24/10/2026 tại commit `f5a0dac1e1fe87eae455551b16a23be3d1368968`. Issue này xử lý khoảng trống quan sát được trong code; trạng thái Closed của issue cũ không chứng minh tính năng đã được triển khai. Backend + database + shared contracts/API client + docs/tests trong phạm vi; Web/Mobile UI nằm ngoài phạm vi các issue backend này; cần bàn giao contract để lập việc tích hợp. Không thay đổi runtime trong bước lập kế hoạch.

## Mục tiêu

Customer thanh toán đúng khoản phải thu; webhook/reconcile, công nợ, refund và reports thống nhất theo nguồn tiền.

## Liên quan và phụ thuộc

Lịch sử: #18, #34, #36, #43, #148.

Phụ thuộc: https://github.com/vlnguyen910/metastorage/issues/161

## Decision gate

- [ ] BLOCKED cho đến khi finance-decision được duyệt. Field names/statuses và cấu trúc FK trong issue là đề xuất.
- [ ] Nếu partial/manual payment không thuộc MVP thì loại khỏi API và schema; không xây invoice engine hoặc sổ cái tổng quát.

## Công việc backend

- [ ] Chốt DTO và schema theo financial decision; một khoản phải thu liên kết rental và source cụ thể, nhiều attempts không biến thành nhiều nghĩa vụ.
- [ ] Tạo/read/duyệt/void charge theo permission đã chốt; tạo payment và status cho đúng obligation, không lấy amount/currency tin cậy từ client.
- [ ] Phân luồng checkout booking và charge trong payment completion/reconcile: charge thành công không đòi Booking DRAFT hoặc tạo booking/QR/handover.
- [ ] Sửa holdTokenHash/booking-or-draft CHECK và constraints cần thiết để charge không phải giả làm checkout hold; giữ idempotency/provider uniqueness.
- [ ] Tách rent/deposit/extra/renewal khi tính history/reports/refunds; xử lý outstanding debt theo payments đã xác nhận, giữ settlement snapshots và lịch sử transfers.
- [ ] Không mở một lần endpoint thu tiền mà chưa cập nhật accounting consumers: reports hiện giả định payment.total=booking.rentalFee+deposit.

## Database

Thêm rental_charges và liên kết payment/source theo approved model, CHECK số tiền/trạng thái, FK, unique idempotency, audit. Giữ monetary history; mở rộng migration theo additive design. Cập nhật schema exports và seed fixtures.

## Files cần đọc/sửa/tạo

- `Create: apps/api/src/modules/rental-charges/rental-charges.routes.ts`
- `Create: apps/api/src/modules/rental-charges/rental-charges.service.ts`
- `Create: apps/api/src/modules/rental-charges/rental-charges.repository.ts`
- `Create: apps/api/src/modules/rental-charges/rental-charges.messages.ts`
- `Create: apps/api/src/modules/rental-charges/rental-charges.types.ts`
- `Create: packages/contracts/src/rental-charges.ts`
- `Create: packages/contracts/src/rental-charges.types.ts`
- `Create: packages/contracts/src/rental-charges.messages.ts`
- `Create: packages/database/src/schema/rental-charges.ts`
- `Modify: packages/database/src/schema/payments.ts`
- `Modify: packages/database/src/schema/index.ts`
- `Modify: packages/database/src/schema/relations.ts`
- `Modify: apps/api/src/modules/payments/payments.service.ts`
- `Modify: apps/api/src/modules/payments/payments.repository.ts`
- `Modify: apps/api/src/modules/payments/payments.routes.ts`
- `Modify: apps/api/src/modules/payments/payments.types.ts`
- `Modify: apps/api/src/modules/returns/returns.service.ts`
- `Modify: apps/api/src/modules/returns/returns.policy.ts`
- `Modify: apps/api/src/modules/reports/reports.repository.ts`
- `Modify: apps/api/src/modules/rentals/rentals.service.ts`
- `Modify: packages/contracts/src/payments.ts`
- `Modify: packages/contracts/src/payments.types.ts`
- `Modify: packages/contracts/src/reports.types.ts`
- `Modify: packages/contracts/src/index.ts`
- `Modify: packages/api-client/src/index.ts`
- `Modify: apps/api/src/app.ts`
- `Create: apps/api/tests/integration/rental-charges.test.ts`
- `Modify: apps/api/tests/integration/booking-payment-start.test.ts`
- `Modify: docs/booking-payment.md`
- `Modify: docs/returns-api.md`
- `Modify: docs/db-diagram.md`

## Acceptance criteria

- [ ] Không thu trùng/vượt số phải trả theo policy; callback/reconcile lặp xử lý đúng một lần.
- [ ] Wrong amount/currency/provider credentials và sai owner/facility bị từ chối; cancelled/expired obligation xử lý theo policy.
- [ ] Booking CHECKED_IN vẫn thanh toán charge hợp lệ mà không chuyển lifecycle booking hoặc occupancy.
- [ ] Initial checkout/cancellation/no-show/refund regressions không đổi; mixed initial+renewal+extra report không double-count deposit/rent.
- [ ] Correction settlement sau collection và refund từ nhiều nguồn tuân decision; nhiều attempts không nhân đôi lịch sử rental.

## Test cases nghiệp vụ

- [ ] Provider mock tại adapter boundary, real DB locks/constraints; concurrent attempts + duplicate webhook.
- [ ] Initial rent+deposit và renewal+extra, settlement debt correction, refund caps, report totals và ownership.

## Quy tắc thực hiện

- Dùng @metastorage-backend-endpoint, @writing-plans và @ponytail:ponytail khi triển khai. Route → Service → Repository, Zod contracts dùng chung, Drizzle query builder trước; message constants và dedicated types files theo AGENTS.md.
- Trước sửa symbol: GitNexus query/context/impact upstream, báo callers/processes/risk; HIGH/CRITICAL phải cảnh báo, UNKNOWN phải xác minh bằng text search. Index có thể thiếu flow; graph không thay thế source review.
- Mọi business rule TBD phải được xác nhận trước khi tạo schema hoặc tests phụ thuộc. Đề xuất trong issue chưa phải policy được duyệt.
- Schema: cập nhật docs/db-diagram.md cùng Drizzle, sinh migration bằng `bun run db:generate`; không sửa generated SQL trực tiếp. Giữ dữ liệu/snapshot/audit; không reset hoặc reseed database đang dùng.
- Ưu tiên integration tests route/service/PostgreSQL thật cho authorization, persistence, locks, transaction và replay. Mock tại external adapter boundary. Không tạo unit tests cho CRUD/pass-through; chỉ unit-test policy phức tạp nếu có ích.
- Cập nhật shared exports, API client, fixture/seed bị ảnh hưởng và tài liệu. FE implementation không nằm trong issue này; bàn giao endpoint/DTO/errors/dependencies rõ ràng.

## Kế hoạch thực hiện từng bước

1. Đọc các issue/docs/source ở trên; ghi các quyết định đã có và TBD, đối chiếu với code hiện tại.
2. Với mỗi TBD, viết một ví dụ input/state/outcome và xin xác nhận; tiếp tục phần độc lập. Dừng phần implementation phụ thuộc cho tới khi được chốt.
3. Chạy impact cho từng symbol sắp sửa và liệt kê consumer/fixture/export phải thay.
4. Chốt một DTO hoặc một transition mỗi lượt; cập nhật Zod input/output và OpenAPI tương ứng.
5. Với một acceptance case đã chốt, thêm một integration test nhỏ trong file nêu trên, dùng auth/DB fixture pattern hiện có.
6. Chạy riêng test mới; mong đợi FAIL vì endpoint/behavior chưa có, không chấp nhận lỗi môi trường như red test.
7. Nếu case cần schema: cập nhật diagram rồi Drizzle, generate/migrate trên DB test đã được cấu hình. Nếu không cần schema thì bỏ bước migration.
8. Implement một query/transition tối thiểu theo Route → Service → Repository; chạy lại case cho tới PASS.
9. Lặp bước 5–8 cho authorization, constraint/transaction và retry/concurrency trong test matrix. Không thêm behavior chưa được duyệt.
10. Cập nhật client/exports/docs/fixtures; chạy regression liên quan và type/lint checks bên dưới.
11. Trước mỗi commit: `node .gitnexus/run.cjs detect-changes --scope all --repo .`; nếu partial/truncated thì tăng giới hạn hoặc xác minh thêm và ghi rõ giới hạn.
12. Commit nhỏ sau khi checks của phần đó pass, ví dụ `feat: collect rental charges with source aware reporting`; issue chỉ đóng khi mọi AC đạt và integration chạy thực sự.

Mỗi bước tạo test/query/contract nên chia tiếp theo một case 2–5 phút; không coi toàn bộ module là một bước. Với decision-only issue, đầu ra là policy/decision matrix được duyệt; không thực hiện runtime steps 4–9.

## Lệnh kiểm chứng

Chạy từ repository root. Cấu hình DB/Redis test theo `docs/local-database-tests.md`; DB phải loopback riêng có tên `metastorage_inspection_test_*`, không dùng development/production. Các suite opt-in phải có env guard và chạy thật, không đếm skip là pass. Khi cần fixtures auth/mail/provider dùng credentials test.

```sh
bun test apps/api/tests/integration/rental-charges.test.ts
bun run --filter api check-types
bun run --filter @metastorage/contracts check-types
bun run --filter @metastorage/database check-types
bun run --filter @metastorage/api-client check-types
bun run --filter api lint
bun run --filter @metastorage/contracts lint
bun run --filter @metastorage/database lint
bun run --filter @metastorage/api-client lint
git diff --check
```

Expected: selected test cases PASS, 0 skipped trong phạm vi yêu cầu; type/lint exit 0. Với decision-only issue chỉ `git diff --check` và review policy, không chạy suite runtime vô nghĩa. Regression phải chọn theo call graph của diff; không chạy toàn bộ suite để thay cho việc chọn đúng test. Nếu có UI thay đổi ở follow-up, chạy flow E2E và kiểm tra UI trong browser theo AGENTS.md trước khi nghiệm thu UI.

---

## Task 7: [Backend][Renewal][P1] Gia hạn rental qua thanh toán và cập nhật lifecycle

## Bối cảnh và phạm vi

Audit source ngày 24/10/2026 tại commit `f5a0dac1e1fe87eae455551b16a23be3d1368968`. Issue này xử lý khoảng trống quan sát được trong code; trạng thái Closed của issue cũ không chứng minh tính năng đã được triển khai. Backend + database + shared contracts/API client + docs/tests trong phạm vi; Web/Mobile UI nằm ngoài phạm vi các issue backend này; cần bàn giao contract để lập việc tích hợp. Không thay đổi runtime trong bước lập kế hoạch.

## Mục tiêu

Customer đủ điều kiện thanh toán kỳ tiếp theo và tiếp tục dùng đúng unit, không gia hạn trùng khi retry.

## Liên quan và phụ thuộc

Lịch sử: #58, #59, #60, #61, #96, #102.

Phụ thuộc: https://github.com/vlnguyen910/metastorage/issues/161, https://github.com/vlnguyen910/metastorage/issues/162

## Decision gate

- [ ] BLOCKED bởi financial policy và charge/payment contract; không tự chọn cutoff 6/7 ngày từ #96.
- [ ] Chốt định danh term/version cho notification dedupe; trạng thái OVERDUE và abandonedReviewAt sau renewal theo approved policy.

## Công việc backend

- [ ] Quote/request/approve nếu policy yêu cầu; tạo khoản phải thu qua module đã có, payment từ source RENEWAL.
- [ ] Lưu oldEnd/newEnd/months/rate/amount snapshot và trạng thái; apply sau đúng approval/payment order, không sửa snapshot booking ban đầu.
- [ ] Dưới lock kiểm tra lại version, return state, eligibility/capacity rồi áp dụng renewal đúng một lần; giữ physical unit và cập nhật allocation theo model đã duyệt.
- [ ] Audit mọi reader dùng booking.rentalEndAt so với rentals.expectedEndAt để chọn original/current term đúng nghĩa; cập nhật lịch nhắc hạn, overdue và abandoned review.
- [ ] Xử lý outbox reminder đã enqueue theo kỳ cũ: worker kiểm tra event/term trước khi gửi để không nhắc hết hạn sai sau renewal.
- [ ] Xử lý paid-but-cannot-apply và return/cron race theo policy; hợp đồng gia hạn thực hiện theo quyết định, không sửa issued PDF gốc.

## Database

Đề xuất rental_renewals lưu lịch sử và unique apply/payment/source; rentals.expected_end_at là current term. Version nếu cần optimistic concurrency. Migration gồm FK/amount/period constraints và nguồn term để nhắc hạn; giữ snapshot kỳ đầu.

## Files cần đọc/sửa/tạo

- `Create: apps/api/src/modules/renewals/renewals.routes.ts`
- `Create: apps/api/src/modules/renewals/renewals.service.ts`
- `Create: apps/api/src/modules/renewals/renewals.repository.ts`
- `Create: apps/api/src/modules/renewals/renewals.policy.ts`
- `Create: apps/api/src/modules/renewals/renewals.messages.ts`
- `Create: apps/api/src/modules/renewals/renewals.types.ts`
- `Create: packages/database/src/schema/rental-renewals.ts`
- `Modify: packages/database/src/schema/rentals.ts (nếu cần version)`
- `Create: packages/contracts/src/renewals.ts`
- `Create: packages/contracts/src/renewals.types.ts`
- `Create: packages/contracts/src/renewals.messages.ts`
- `Modify: packages/contracts/src/index.ts`
- `Modify: packages/database/src/schema/index.ts`
- `Modify: packages/database/src/schema/relations.ts`
- `Modify: apps/api/src/modules/rentals/rental-lifecycle.service.ts`
- `Modify: apps/api/src/modules/rentals/rental-lifecycle.repository.ts`
- `Modify: apps/api/src/modules/rentals/rentals.repository.ts`
- `Modify: apps/api/src/modules/payments/payments.service.ts`
- `Modify: apps/api/src/modules/payments/payments.repository.ts`
- `Modify: apps/api/src/modules/returns/returns.service.ts`
- `Modify: apps/api/src/modules/contracts/contracts.service.ts (theo policy phụ lục)`
- `Modify: apps/api/src/common/cron/plugin.ts`
- `Modify: apps/worker/src/notifications/outbox.service.ts`
- `Modify: packages/api-client/src/index.ts`
- `Modify: apps/api/src/app.ts`
- `Create: apps/api/tests/integration/rental-renewal.test.ts`
- `Create: docs/rental-renewal-api.md`
- `Modify: docs/db-diagram.md`

## Acceptance criteria

- [ ] Retry callback, request và apply không cộng thêm kỳ hoặc phát thông báo trùng.
- [ ] Hai renewals đồng thời hoặc renewal-return/expiry race cho kết quả nhất quán, không release unit đang thuê.
- [ ] Failed/pending payment không tự gia hạn; successful flow đổi đúng current end theo calendar policy.
- [ ] Current rental/list/guest reads, reports, reminders và settlement dùng đúng kỳ; original paid booking/contract history được giữ.

## Test cases nghiệp vụ

- [ ] Boundary cutoff/month-end/leap year; approval/payment order; replay/concurrency.
- [ ] Race expiry/return, late provider success, reminder đã enqueue và current vs original term reads.

## Quy tắc thực hiện

- Dùng @metastorage-backend-endpoint, @writing-plans và @ponytail:ponytail khi triển khai. Route → Service → Repository, Zod contracts dùng chung, Drizzle query builder trước; message constants và dedicated types files theo AGENTS.md.
- Trước sửa symbol: GitNexus query/context/impact upstream, báo callers/processes/risk; HIGH/CRITICAL phải cảnh báo, UNKNOWN phải xác minh bằng text search. Index có thể thiếu flow; graph không thay thế source review.
- Mọi business rule TBD phải được xác nhận trước khi tạo schema hoặc tests phụ thuộc. Đề xuất trong issue chưa phải policy được duyệt.
- Schema: cập nhật docs/db-diagram.md cùng Drizzle, sinh migration bằng `bun run db:generate`; không sửa generated SQL trực tiếp. Giữ dữ liệu/snapshot/audit; không reset hoặc reseed database đang dùng.
- Ưu tiên integration tests route/service/PostgreSQL thật cho authorization, persistence, locks, transaction và replay. Mock tại external adapter boundary. Không tạo unit tests cho CRUD/pass-through; chỉ unit-test policy phức tạp nếu có ích.
- Cập nhật shared exports, API client, fixture/seed bị ảnh hưởng và tài liệu. FE implementation không nằm trong issue này; bàn giao endpoint/DTO/errors/dependencies rõ ràng.

## Kế hoạch thực hiện từng bước

1. Đọc các issue/docs/source ở trên; ghi các quyết định đã có và TBD, đối chiếu với code hiện tại.
2. Với mỗi TBD, viết một ví dụ input/state/outcome và xin xác nhận; tiếp tục phần độc lập. Dừng phần implementation phụ thuộc cho tới khi được chốt.
3. Chạy impact cho từng symbol sắp sửa và liệt kê consumer/fixture/export phải thay.
4. Chốt một DTO hoặc một transition mỗi lượt; cập nhật Zod input/output và OpenAPI tương ứng.
5. Với một acceptance case đã chốt, thêm một integration test nhỏ trong file nêu trên, dùng auth/DB fixture pattern hiện có.
6. Chạy riêng test mới; mong đợi FAIL vì endpoint/behavior chưa có, không chấp nhận lỗi môi trường như red test.
7. Nếu case cần schema: cập nhật diagram rồi Drizzle, generate/migrate trên DB test đã được cấu hình. Nếu không cần schema thì bỏ bước migration.
8. Implement một query/transition tối thiểu theo Route → Service → Repository; chạy lại case cho tới PASS.
9. Lặp bước 5–8 cho authorization, constraint/transaction và retry/concurrency trong test matrix. Không thêm behavior chưa được duyệt.
10. Cập nhật client/exports/docs/fixtures; chạy regression liên quan và type/lint checks bên dưới.
11. Trước mỗi commit: `node .gitnexus/run.cjs detect-changes --scope all --repo .`; nếu partial/truncated thì tăng giới hạn hoặc xác minh thêm và ghi rõ giới hạn.
12. Commit nhỏ sau khi checks của phần đó pass, ví dụ `feat: renew paid rentals atomically`; issue chỉ đóng khi mọi AC đạt và integration chạy thực sự.

Mỗi bước tạo test/query/contract nên chia tiếp theo một case 2–5 phút; không coi toàn bộ module là một bước. Với decision-only issue, đầu ra là policy/decision matrix được duyệt; không thực hiện runtime steps 4–9.

## Lệnh kiểm chứng

Chạy từ repository root. Cấu hình DB/Redis test theo `docs/local-database-tests.md`; DB phải loopback riêng có tên `metastorage_inspection_test_*`, không dùng development/production. Các suite opt-in phải có env guard và chạy thật, không đếm skip là pass. Khi cần fixtures auth/mail/provider dùng credentials test.

```sh
bun test apps/api/tests/integration/rental-renewal.test.ts
bun run --filter api check-types
bun run --filter @metastorage/contracts check-types
bun run --filter @metastorage/database check-types
bun run --filter @metastorage/api-client check-types
bun run --filter api lint
bun run --filter @metastorage/contracts lint
bun run --filter @metastorage/database lint
bun run --filter @metastorage/api-client lint
git diff --check
```

Expected: selected test cases PASS, 0 skipped trong phạm vi yêu cầu; type/lint exit 0. Với decision-only issue chỉ `git diff --check` và review policy, không chạy suite runtime vô nghĩa. Regression phải chọn theo call graph của diff; không chạy toàn bộ suite để thay cho việc chọn đúng test. Nếu có UI thay đổi ở follow-up, chạy flow E2E và kiểm tra UI trong browser theo AGENTS.md trước khi nghiệm thu UI.

---

## Task 8: [Decision][Support][P1] Chốt phạm vi, quyền và lifecycle hỗ trợ customer

## Bối cảnh và phạm vi

Audit source ngày 24/10/2026 tại commit `f5a0dac1e1fe87eae455551b16a23be3d1368968`. Issue này xử lý khoảng trống quan sát được trong code; trạng thái Closed của issue cũ không chứng minh tính năng đã được triển khai. Backend + database + shared contracts/API client + docs/tests trong phạm vi; Web/Mobile UI nằm ngoài phạm vi các issue backend này; cần bàn giao contract để lập việc tích hợp. Không thay đổi runtime trong bước lập kế hoạch.

## Mục tiêu

Có policy đủ rõ để xây support cho vấn đề unit, lock, access code, payment và stored items.

## Liên quan và phụ thuộc

Lịch sử: #71, #72, #73, #74, #40.

Phụ thuộc: Không có issue mới bắt buộc; decision gate bên dưới vẫn áp dụng.

## Decision gate

- [ ] Issue #71–#74 đóng không chứng minh policy được chốt; tham chiếu lại như lịch sử.
- [ ] Access code support không tự mở rộng PIN/NFC/IoT đã ngoài scope check-in.

## Công việc backend

- [ ] Chốt category và context: cần rental/booking/payment hay có ticket không gắn rental; guest có quyền gửi/đọc/phản hồi hay chỉ account.
- [ ] Chốt ai tiếp nhận từng category, đặc biệt payment ngoài facility staff scope; assignment/reassignment/escalation permission.
- [ ] Chốt statuses, transitions, ai resolve/close/reopen, required reason/evidence và public reply vs internal note.
- [ ] Chốt attachment types/limits/private access, severity ai phân loại, SLA/manual escalation; quyết định phần nào thực sự thuộc MVP.
- [ ] Định nghĩa notification recipients/channels theo policy; đánh giá reuse adapters/outbox/facility membership, không tự thêm realtime/tự động SLA engine.

## Database

Đầu ra model ticket/message/attachment/audit đã duyệt; không generate migration hoặc enums khi trạng thái còn TBD.

## Files cần đọc/sửa/tạo

- `Create: docs/customer-support-policy.md`
- `Read: docs/facility-staff-operations-policy.md`
- `Read: docs/flow5-task-assignment-api.md`
- `Read: packages/database/src/schema/facility-tasks.ts`
- `Read: packages/database/src/schema/notification-outbox.ts`
- `Modify: docs/db-diagram.md (sau khi duyệt model)`

## Acceptance criteria

- [ ] Có permission/state table và ví dụ cho đủ năm nhóm vấn đề.
- [ ] Có decision về guest, internal notes, attachments, severity và SLA; ngoài MVP ghi explicit, chưa chọn ghi TBD.
- [ ] Model đáp ứng customer conversation và operational audit; ticket không tự đổi occupancy hoặc reset access code.
- [ ] Owner xác nhận trước khi implementation phụ thuộc bắt đầu.

## Test cases nghiệp vụ

- [ ] Review permission/state scenarios và các ví dụ cross-facility/privacy; chưa tạo runtime tests.

## Quy tắc thực hiện

- Dùng @metastorage-backend-endpoint, @writing-plans và @ponytail:ponytail khi triển khai. Route → Service → Repository, Zod contracts dùng chung, Drizzle query builder trước; message constants và dedicated types files theo AGENTS.md.
- Trước sửa symbol: GitNexus query/context/impact upstream, báo callers/processes/risk; HIGH/CRITICAL phải cảnh báo, UNKNOWN phải xác minh bằng text search. Index có thể thiếu flow; graph không thay thế source review.
- Mọi business rule TBD phải được xác nhận trước khi tạo schema hoặc tests phụ thuộc. Đề xuất trong issue chưa phải policy được duyệt.
- Schema: cập nhật docs/db-diagram.md cùng Drizzle, sinh migration bằng `bun run db:generate`; không sửa generated SQL trực tiếp. Giữ dữ liệu/snapshot/audit; không reset hoặc reseed database đang dùng.
- Ưu tiên integration tests route/service/PostgreSQL thật cho authorization, persistence, locks, transaction và replay. Mock tại external adapter boundary. Không tạo unit tests cho CRUD/pass-through; chỉ unit-test policy phức tạp nếu có ích.
- Cập nhật shared exports, API client, fixture/seed bị ảnh hưởng và tài liệu. FE implementation không nằm trong issue này; bàn giao endpoint/DTO/errors/dependencies rõ ràng.

## Kế hoạch thực hiện từng bước

1. Đọc các issue/docs/source ở trên; ghi các quyết định đã có và TBD, đối chiếu với code hiện tại.
2. Với mỗi TBD, viết một ví dụ input/state/outcome và xin xác nhận; tiếp tục phần độc lập. Dừng phần implementation phụ thuộc cho tới khi được chốt.
3. Chạy impact cho từng symbol sắp sửa và liệt kê consumer/fixture/export phải thay.
4. Chốt một DTO hoặc một transition mỗi lượt; cập nhật Zod input/output và OpenAPI tương ứng.
5. Với một acceptance case đã chốt, thêm một integration test nhỏ trong file nêu trên, dùng auth/DB fixture pattern hiện có.
6. Chạy riêng test mới; mong đợi FAIL vì endpoint/behavior chưa có, không chấp nhận lỗi môi trường như red test.
7. Nếu case cần schema: cập nhật diagram rồi Drizzle, generate/migrate trên DB test đã được cấu hình. Nếu không cần schema thì bỏ bước migration.
8. Implement một query/transition tối thiểu theo Route → Service → Repository; chạy lại case cho tới PASS.
9. Lặp bước 5–8 cho authorization, constraint/transaction và retry/concurrency trong test matrix. Không thêm behavior chưa được duyệt.
10. Cập nhật client/exports/docs/fixtures; chạy regression liên quan và type/lint checks bên dưới.
11. Trước mỗi commit: `node .gitnexus/run.cjs detect-changes --scope all --repo .`; nếu partial/truncated thì tăng giới hạn hoặc xác minh thêm và ghi rõ giới hạn.
12. Commit nhỏ sau khi checks của phần đó pass, ví dụ `docs: define customer support policy`; issue chỉ đóng khi mọi AC đạt và integration chạy thực sự.

Mỗi bước tạo test/query/contract nên chia tiếp theo một case 2–5 phút; không coi toàn bộ module là một bước. Với decision-only issue, đầu ra là policy/decision matrix được duyệt; không thực hiện runtime steps 4–9.

## Lệnh kiểm chứng

Chạy từ repository root. Cấu hình DB/Redis test theo `docs/local-database-tests.md`; DB phải loopback riêng có tên `metastorage_inspection_test_*`, không dùng development/production. Các suite opt-in phải có env guard và chạy thật, không đếm skip là pass. Khi cần fixtures auth/mail/provider dùng credentials test.

```sh
git diff --check
bun run --filter api check-types
bun run --filter @metastorage/contracts check-types
bun run --filter @metastorage/database check-types
bun run --filter @metastorage/api-client check-types
bun run --filter api lint
bun run --filter @metastorage/contracts lint
bun run --filter @metastorage/database lint
bun run --filter @metastorage/api-client lint
git diff --check
```

Expected: selected test cases PASS, 0 skipped trong phạm vi yêu cầu; type/lint exit 0. Với decision-only issue chỉ `git diff --check` và review policy, không chạy suite runtime vô nghĩa. Regression phải chọn theo call graph của diff; không chạy toàn bộ suite để thay cho việc chọn đúng test. Nếu có UI thay đổi ở follow-up, chạy flow E2E và kiểm tra UI trong browser theo AGENTS.md trước khi nghiệm thu UI.

---

## Task 9: [Backend][Support][P1] Tạo và theo dõi yêu cầu hỗ trợ của customer

## Bối cảnh và phạm vi

Audit source ngày 24/10/2026 tại commit `f5a0dac1e1fe87eae455551b16a23be3d1368968`. Issue này xử lý khoảng trống quan sát được trong code; trạng thái Closed của issue cũ không chứng minh tính năng đã được triển khai. Backend + database + shared contracts/API client + docs/tests trong phạm vi; Web/Mobile UI nằm ngoài phạm vi các issue backend này; cần bàn giao contract để lập việc tích hợp. Không thay đổi runtime trong bước lập kế hoạch.

## Mục tiêu

Customer gửi ticket, đọc trao đổi và bằng chứng trong đúng rental/booking context được phép.

## Liên quan và phụ thuộc

Lịch sử: #71, #72, #27, #112.

Phụ thuộc: https://github.com/vlnguyen910/metastorage/issues/164

## Decision gate

- [ ] BLOCKED bởi support policy. Phạm vi guest/attachments/internal notes phải theo decision, không tự suy diễn.
- [ ] Kết quả issue này là customer APIs; queue/assignment/resolve hoàn thiện ở issue support operations.

## Công việc backend

- [ ] Create/list/detail/public reply theo approved policy; owner/facility suy từ rental/booking, không tin userId/facilityId client.
- [ ] Lưu request idempotency, actor/source, nội dung và trạng thái đầu; list cursor ổn định.
- [ ] Uploads theo attachment policy, dùng storage adapter hiện có; kiểm tra quyền cả upload lẫn read, private identifiers thay public URLs.
- [ ] Shared DTO tách public conversation và internal notes nếu policy có; giữ nguồn lịch sử khi rental đóng hoặc account bị thay đổi theo retention policy.

## Database

Đề xuất support_tickets/support_messages và attachments/audit đúng scope đã duyệt, FK/retention policy, unique idempotency và indexes owner/facility/status. Schema transaction cùng ticket creation/history.

## Files cần đọc/sửa/tạo

- `Create: apps/api/src/modules/support/support.routes.ts`
- `Create: apps/api/src/modules/support/support.service.ts`
- `Create: apps/api/src/modules/support/support.repository.ts`
- `Create: apps/api/src/modules/support/support.messages.ts`
- `Create: apps/api/src/modules/support/support.types.ts`
- `Create: packages/contracts/src/support.ts`
- `Create: packages/contracts/src/support.types.ts`
- `Create: packages/contracts/src/support.messages.ts`
- `Create: packages/database/src/schema/support.ts`
- `Modify: packages/database/src/schema/index.ts`
- `Modify: packages/database/src/schema/relations.ts`
- `Modify: packages/contracts/src/index.ts`
- `Modify: packages/api-client/src/index.ts`
- `Modify: apps/api/src/app.ts`
- `Create: apps/api/tests/integration/customer-support.test.ts`
- `Create: docs/customer-support-api.md`
- `Modify: docs/db-diagram.md`

## Acceptance criteria

- [ ] Đủ unit/lock/access-code/payment/items categories đã duyệt; hợp lệ tạo đúng context.
- [ ] Customer khác/guest chưa đủ quyền không đọc hoặc ghi dù biết ticket/file ID; không cho giả actor/context.
- [ ] Retry create không tạo ticket/file reference trùng; lỗi upload/database không mất evidence đã được tham chiếu.
- [ ] List/detail không lộ staff-only notes hoặc secrets; module có API documentation và shared client.

## Test cases nghiệp vụ

- [ ] Owner/other/guest matrix, closed rental policy, context forgery, retries.
- [ ] Private file access/MIME-size limits và orphan cleanup nếu có attachments.

## Quy tắc thực hiện

- Dùng @metastorage-backend-endpoint, @writing-plans và @ponytail:ponytail khi triển khai. Route → Service → Repository, Zod contracts dùng chung, Drizzle query builder trước; message constants và dedicated types files theo AGENTS.md.
- Trước sửa symbol: GitNexus query/context/impact upstream, báo callers/processes/risk; HIGH/CRITICAL phải cảnh báo, UNKNOWN phải xác minh bằng text search. Index có thể thiếu flow; graph không thay thế source review.
- Mọi business rule TBD phải được xác nhận trước khi tạo schema hoặc tests phụ thuộc. Đề xuất trong issue chưa phải policy được duyệt.
- Schema: cập nhật docs/db-diagram.md cùng Drizzle, sinh migration bằng `bun run db:generate`; không sửa generated SQL trực tiếp. Giữ dữ liệu/snapshot/audit; không reset hoặc reseed database đang dùng.
- Ưu tiên integration tests route/service/PostgreSQL thật cho authorization, persistence, locks, transaction và replay. Mock tại external adapter boundary. Không tạo unit tests cho CRUD/pass-through; chỉ unit-test policy phức tạp nếu có ích.
- Cập nhật shared exports, API client, fixture/seed bị ảnh hưởng và tài liệu. FE implementation không nằm trong issue này; bàn giao endpoint/DTO/errors/dependencies rõ ràng.

## Kế hoạch thực hiện từng bước

1. Đọc các issue/docs/source ở trên; ghi các quyết định đã có và TBD, đối chiếu với code hiện tại.
2. Với mỗi TBD, viết một ví dụ input/state/outcome và xin xác nhận; tiếp tục phần độc lập. Dừng phần implementation phụ thuộc cho tới khi được chốt.
3. Chạy impact cho từng symbol sắp sửa và liệt kê consumer/fixture/export phải thay.
4. Chốt một DTO hoặc một transition mỗi lượt; cập nhật Zod input/output và OpenAPI tương ứng.
5. Với một acceptance case đã chốt, thêm một integration test nhỏ trong file nêu trên, dùng auth/DB fixture pattern hiện có.
6. Chạy riêng test mới; mong đợi FAIL vì endpoint/behavior chưa có, không chấp nhận lỗi môi trường như red test.
7. Nếu case cần schema: cập nhật diagram rồi Drizzle, generate/migrate trên DB test đã được cấu hình. Nếu không cần schema thì bỏ bước migration.
8. Implement một query/transition tối thiểu theo Route → Service → Repository; chạy lại case cho tới PASS.
9. Lặp bước 5–8 cho authorization, constraint/transaction và retry/concurrency trong test matrix. Không thêm behavior chưa được duyệt.
10. Cập nhật client/exports/docs/fixtures; chạy regression liên quan và type/lint checks bên dưới.
11. Trước mỗi commit: `node .gitnexus/run.cjs detect-changes --scope all --repo .`; nếu partial/truncated thì tăng giới hạn hoặc xác minh thêm và ghi rõ giới hạn.
12. Commit nhỏ sau khi checks của phần đó pass, ví dụ `feat: add customer support request APIs`; issue chỉ đóng khi mọi AC đạt và integration chạy thực sự.

Mỗi bước tạo test/query/contract nên chia tiếp theo một case 2–5 phút; không coi toàn bộ module là một bước. Với decision-only issue, đầu ra là policy/decision matrix được duyệt; không thực hiện runtime steps 4–9.

## Lệnh kiểm chứng

Chạy từ repository root. Cấu hình DB/Redis test theo `docs/local-database-tests.md`; DB phải loopback riêng có tên `metastorage_inspection_test_*`, không dùng development/production. Các suite opt-in phải có env guard và chạy thật, không đếm skip là pass. Khi cần fixtures auth/mail/provider dùng credentials test.

```sh
bun test apps/api/tests/integration/customer-support.test.ts
bun run --filter api check-types
bun run --filter @metastorage/contracts check-types
bun run --filter @metastorage/database check-types
bun run --filter @metastorage/api-client check-types
bun run --filter api lint
bun run --filter @metastorage/contracts lint
bun run --filter @metastorage/database lint
bun run --filter @metastorage/api-client lint
git diff --check
```

Expected: selected test cases PASS, 0 skipped trong phạm vi yêu cầu; type/lint exit 0. Với decision-only issue chỉ `git diff --check` và review policy, không chạy suite runtime vô nghĩa. Regression phải chọn theo call graph của diff; không chạy toàn bộ suite để thay cho việc chọn đúng test. Nếu có UI thay đổi ở follow-up, chạy flow E2E và kiểm tra UI trong browser theo AGENTS.md trước khi nghiệm thu UI.

---

## Task 10: [Backend][Support][P1] Phân công, phản hồi và xử lý ticket hỗ trợ

## Bối cảnh và phạm vi

Audit source ngày 24/10/2026 tại commit `f5a0dac1e1fe87eae455551b16a23be3d1368968`. Issue này xử lý khoảng trống quan sát được trong code; trạng thái Closed của issue cũ không chứng minh tính năng đã được triển khai. Backend + database + shared contracts/API client + docs/tests trong phạm vi; Web/Mobile UI nằm ngoài phạm vi các issue backend này; cần bàn giao contract để lập việc tích hợp. Không thay đổi runtime trong bước lập kế hoạch.

## Mục tiêu

Người phụ trách tiếp nhận và xử lý ticket tới kết quả theo quyền/lifecycle đã duyệt.

## Liên quan và phụ thuộc

Lịch sử: #73, #74, #40, #71.

Phụ thuộc: https://github.com/vlnguyen910/metastorage/issues/164, https://github.com/vlnguyen910/metastorage/issues/165

## Decision gate

- [ ] BLOCKED bởi support policy và schema/customer API.
- [ ] Outbox hiện bắt buộc booking/facility: chỉ mở rộng sau khi xác định ticket context; không giả booking cho ticket độc lập.

## Công việc backend

- [ ] Facility queue theo scope và queue payment theo role được duyệt; staff chỉ đọc ticket được giao/được phép.
- [ ] Assign/reassign eligible active staff, public response và internal note chỉ khi policy cho phép.
- [ ] Resolve/close/reopen/escalate theo state machine, expectedVersion và audit cùng transaction; dùng reason bắt buộc theo decision.
- [ ] Notifications sau commit, dedupe theo ticket event/recipient, giữ private notes khỏi customer payload; chỉ làm SLA tracking/escalation thuộc approved MVP.
- [ ] Tái sử dụng facility assignments và adapters; không đồng nhất ticket với facility_task làm thay đổi check-in/inspection permissions.

## Database

Mở rộng support schema với assignment/version/history và notification references cần thiết; dữ liệu conversation từ issue customer được tái sử dụng. Chỉ thêm bảng khi có dữ liệu độc lập thực sự cần lưu.

## Files cần đọc/sửa/tạo

- `Modify: apps/api/src/modules/support/support.routes.ts`
- `Modify: apps/api/src/modules/support/support.service.ts`
- `Modify: apps/api/src/modules/support/support.repository.ts`
- `Create: apps/api/src/modules/support/support.policy.ts`
- `Modify: packages/contracts/src/support.ts`
- `Modify: packages/contracts/src/support.types.ts`
- `Modify: packages/database/src/schema/support.ts`
- `Modify: apps/api/src/modules/notifications/lifecycle-notifications.service.ts`
- `Modify: apps/api/src/modules/notifications/lifecycle-notifications.repository.ts`
- `Modify: packages/contracts/src/lifecycle-notifications.ts`
- `Modify: packages/database/src/schema/notification-outbox.ts (nếu approved notification contract cần)`
- `Modify: apps/worker/src/notifications/outbox.service.ts`
- `Modify: packages/api-client/src/index.ts`
- `Create: apps/api/tests/integration/support-operations.test.ts`
- `Modify: docs/customer-support-api.md`
- `Modify: docs/db-diagram.md`

## Acceptance criteria

- [ ] Wrong facility/inactive staff/unassigned actor bị từ chối; đúng role xử lý được.
- [ ] Hai transition cạnh tranh hoặc stale version không mất cập nhật; replay không gửi hai notification.
- [ ] Customer thấy public reply và trạng thái đúng; internal note không xuất hiện trong API/email customer.
- [ ] Không tự đóng ticket khi chỉ assign; ticket handling không tự release unit/đổi payment/handover state.

## Test cases nghiệp vụ

- [ ] Role/facility/assignment matrix; transition/stale/concurrency/replay.
- [ ] Notification recipients, private-note separation, email failure retry và retention.

## Quy tắc thực hiện

- Dùng @metastorage-backend-endpoint, @writing-plans và @ponytail:ponytail khi triển khai. Route → Service → Repository, Zod contracts dùng chung, Drizzle query builder trước; message constants và dedicated types files theo AGENTS.md.
- Trước sửa symbol: GitNexus query/context/impact upstream, báo callers/processes/risk; HIGH/CRITICAL phải cảnh báo, UNKNOWN phải xác minh bằng text search. Index có thể thiếu flow; graph không thay thế source review.
- Mọi business rule TBD phải được xác nhận trước khi tạo schema hoặc tests phụ thuộc. Đề xuất trong issue chưa phải policy được duyệt.
- Schema: cập nhật docs/db-diagram.md cùng Drizzle, sinh migration bằng `bun run db:generate`; không sửa generated SQL trực tiếp. Giữ dữ liệu/snapshot/audit; không reset hoặc reseed database đang dùng.
- Ưu tiên integration tests route/service/PostgreSQL thật cho authorization, persistence, locks, transaction và replay. Mock tại external adapter boundary. Không tạo unit tests cho CRUD/pass-through; chỉ unit-test policy phức tạp nếu có ích.
- Cập nhật shared exports, API client, fixture/seed bị ảnh hưởng và tài liệu. FE implementation không nằm trong issue này; bàn giao endpoint/DTO/errors/dependencies rõ ràng.

## Kế hoạch thực hiện từng bước

1. Đọc các issue/docs/source ở trên; ghi các quyết định đã có và TBD, đối chiếu với code hiện tại.
2. Với mỗi TBD, viết một ví dụ input/state/outcome và xin xác nhận; tiếp tục phần độc lập. Dừng phần implementation phụ thuộc cho tới khi được chốt.
3. Chạy impact cho từng symbol sắp sửa và liệt kê consumer/fixture/export phải thay.
4. Chốt một DTO hoặc một transition mỗi lượt; cập nhật Zod input/output và OpenAPI tương ứng.
5. Với một acceptance case đã chốt, thêm một integration test nhỏ trong file nêu trên, dùng auth/DB fixture pattern hiện có.
6. Chạy riêng test mới; mong đợi FAIL vì endpoint/behavior chưa có, không chấp nhận lỗi môi trường như red test.
7. Nếu case cần schema: cập nhật diagram rồi Drizzle, generate/migrate trên DB test đã được cấu hình. Nếu không cần schema thì bỏ bước migration.
8. Implement một query/transition tối thiểu theo Route → Service → Repository; chạy lại case cho tới PASS.
9. Lặp bước 5–8 cho authorization, constraint/transaction và retry/concurrency trong test matrix. Không thêm behavior chưa được duyệt.
10. Cập nhật client/exports/docs/fixtures; chạy regression liên quan và type/lint checks bên dưới.
11. Trước mỗi commit: `node .gitnexus/run.cjs detect-changes --scope all --repo .`; nếu partial/truncated thì tăng giới hạn hoặc xác minh thêm và ghi rõ giới hạn.
12. Commit nhỏ sau khi checks của phần đó pass, ví dụ `feat: handle support ticket assignment and resolution`; issue chỉ đóng khi mọi AC đạt và integration chạy thực sự.

Mỗi bước tạo test/query/contract nên chia tiếp theo một case 2–5 phút; không coi toàn bộ module là một bước. Với decision-only issue, đầu ra là policy/decision matrix được duyệt; không thực hiện runtime steps 4–9.

## Lệnh kiểm chứng

Chạy từ repository root. Cấu hình DB/Redis test theo `docs/local-database-tests.md`; DB phải loopback riêng có tên `metastorage_inspection_test_*`, không dùng development/production. Các suite opt-in phải có env guard và chạy thật, không đếm skip là pass. Khi cần fixtures auth/mail/provider dùng credentials test.

```sh
bun test apps/api/tests/integration/support-operations.test.ts
bun run --filter api check-types
bun run --filter @metastorage/contracts check-types
bun run --filter @metastorage/database check-types
bun run --filter @metastorage/api-client check-types
bun run --filter api lint
bun run --filter @metastorage/contracts lint
bun run --filter @metastorage/database lint
bun run --filter @metastorage/api-client lint
git diff --check
```

Expected: selected test cases PASS, 0 skipped trong phạm vi yêu cầu; type/lint exit 0. Với decision-only issue chỉ `git diff --check` và review policy, không chạy suite runtime vô nghĩa. Regression phải chọn theo call graph của diff; không chạy toàn bộ suite để thay cho việc chọn đúng test. Nếu có UI thay đổi ở follow-up, chạy flow E2E và kiểm tra UI trong browser theo AGENTS.md trước khi nghiệm thu UI.

---

## Task 11: [Backend][Handover][P2] Chốt và xử lý ngoại lệ từ chối hoặc không thể bàn giao kho

## Bối cảnh và phạm vi

Audit source ngày 24/10/2026 tại commit `f5a0dac1e1fe87eae455551b16a23be3d1368968`. Issue này xử lý khoảng trống quan sát được trong code; trạng thái Closed của issue cũ không chứng minh tính năng đã được triển khai. Backend + database + shared contracts/API client + docs/tests trong phạm vi; Web/Mobile UI nằm ngoài phạm vi các issue backend này; cần bàn giao contract để lập việc tích hợp. Không thay đổi runtime trong bước lập kế hoạch.

## Mục tiêu

Có kết quả rõ ràng khi customer từ chối unit hoặc cơ sở không thể bàn giao, không áp nhầm mất cọc của customer cancellation.

## Liên quan và phụ thuộc

Lịch sử: #26, #13, #20, #24, #25, #127.

Phụ thuộc: Không có issue mới bắt buộc; decision gate bên dưới vẫn áp dụng.

## Decision gate

- [ ] BLOCKED ở giai đoạn implementation bởi policy H2–H5 còn TBD. User review là bắt buộc trước schema/runtime.
- [ ] PIN/NFC, ký điện tử và post-handover unit transfer không nằm trong issue này.

## Công việc backend

- [ ] Giai đoạn 1: chốt actor/reason/evidence và outcome cho failed inspection, customer refusal, không có same-type replacement, cùng-type reassign, upgrade/downgrade và provider failure.
- [ ] Tái sử dụng same-type assignment hiện có; không làm lại luồng đã có. Chốt financial difference, cọc/thuê refund và người phê duyệt.
- [ ] Giai đoạn 2 chỉ sau policy: API hành động, audit và versioning; transaction cập nhật booking/assignment/verification/inspection/capacity đúng outcome.
- [ ] Provider money movement qua payment workflow đã duyệt; tách exception do cơ sở khỏi customer-initiated cancellation, không tự forfeiture deposit.
- [ ] Nếu chọn upgrade/downgrade có khoản thu mới, ghi dependency vào charge/payment issue trước implementation; nếu defer thì acceptance chỉ bao phủ outcomes đã duyệt.

## Database

Dùng assignment/inspection history hiện có; chỉ thêm exception/audit data khi thông tin chưa có chỗ lưu phù hợp. Không sửa issued contract hoặc tiền booking cũ để che chênh lệch. Schema cuối chờ policy.

## Files cần đọc/sửa/tạo

- `Create: docs/handover-exceptions-policy.md`
- `Modify: apps/api/src/modules/bookings/bookings.routes.ts`
- `Modify: apps/api/src/modules/bookings/bookings.service.ts`
- `Modify: apps/api/src/modules/bookings/bookings.repository.ts`
- `Modify: apps/api/src/modules/inspections/inspections.service.ts`
- `Modify: apps/api/src/modules/inspections/handover.policy.ts`
- `Modify: apps/api/src/modules/payments/payments.service.ts`
- `Modify: apps/api/src/modules/payments/payments.repository.ts`
- `Modify: packages/contracts/src/bookings.ts`
- `Modify: packages/contracts/src/bookings.types.ts`
- `Modify: packages/database/src/schema/bookings.ts (chỉ theo approved outcome)`
- `Create: packages/database/src/schema/handover-exceptions.ts (chỉ nếu approved audit cần)`
- `Modify: packages/database/src/schema/index.ts`
- `Modify: packages/api-client/src/index.ts`
- `Create: apps/api/tests/integration/handover-exceptions.test.ts`
- `Modify: docs/db-diagram.md`
- `Modify: docs/flow2-ui.md`

## Acceptance criteria

- [ ] Policy có các ví dụ và approval trace; TBD không được biến thành runtime default.
- [ ] Refusal/failed inspection không thể tạo rental ACTIVE hoặc mark CHECKED_IN khi chưa đủ handover gate.
- [ ] Retry và concurrent handover/exception không vừa tạo rental vừa hoàn tiền/release unit.
- [ ] Audit giữ inspection/contract/payment snapshots; đổi assignment vô hiệu verification cũ theo semantics hiện có.
- [ ] Nhánh không thể phục vụ khách áp refund đúng cause; không dùng policy mất cọc mặc định.

## Test cases nghiệp vụ

- [ ] Refuse/fail/no replacement; same-type swap regression; payment/refund outcome theo decision.
- [ ] Concurrent exception-vs-handover, stale expectedVersion và retry; unauthorized staff.

## Quy tắc thực hiện

- Dùng @metastorage-backend-endpoint, @writing-plans và @ponytail:ponytail khi triển khai. Route → Service → Repository, Zod contracts dùng chung, Drizzle query builder trước; message constants và dedicated types files theo AGENTS.md.
- Trước sửa symbol: GitNexus query/context/impact upstream, báo callers/processes/risk; HIGH/CRITICAL phải cảnh báo, UNKNOWN phải xác minh bằng text search. Index có thể thiếu flow; graph không thay thế source review.
- Mọi business rule TBD phải được xác nhận trước khi tạo schema hoặc tests phụ thuộc. Đề xuất trong issue chưa phải policy được duyệt.
- Schema: cập nhật docs/db-diagram.md cùng Drizzle, sinh migration bằng `bun run db:generate`; không sửa generated SQL trực tiếp. Giữ dữ liệu/snapshot/audit; không reset hoặc reseed database đang dùng.
- Ưu tiên integration tests route/service/PostgreSQL thật cho authorization, persistence, locks, transaction và replay. Mock tại external adapter boundary. Không tạo unit tests cho CRUD/pass-through; chỉ unit-test policy phức tạp nếu có ích.
- Cập nhật shared exports, API client, fixture/seed bị ảnh hưởng và tài liệu. FE implementation không nằm trong issue này; bàn giao endpoint/DTO/errors/dependencies rõ ràng.

## Kế hoạch thực hiện từng bước

1. Đọc các issue/docs/source ở trên; ghi các quyết định đã có và TBD, đối chiếu với code hiện tại.
2. Với mỗi TBD, viết một ví dụ input/state/outcome và xin xác nhận; tiếp tục phần độc lập. Dừng phần implementation phụ thuộc cho tới khi được chốt.
3. Chạy impact cho từng symbol sắp sửa và liệt kê consumer/fixture/export phải thay.
4. Chốt một DTO hoặc một transition mỗi lượt; cập nhật Zod input/output và OpenAPI tương ứng.
5. Với một acceptance case đã chốt, thêm một integration test nhỏ trong file nêu trên, dùng auth/DB fixture pattern hiện có.
6. Chạy riêng test mới; mong đợi FAIL vì endpoint/behavior chưa có, không chấp nhận lỗi môi trường như red test.
7. Nếu case cần schema: cập nhật diagram rồi Drizzle, generate/migrate trên DB test đã được cấu hình. Nếu không cần schema thì bỏ bước migration.
8. Implement một query/transition tối thiểu theo Route → Service → Repository; chạy lại case cho tới PASS.
9. Lặp bước 5–8 cho authorization, constraint/transaction và retry/concurrency trong test matrix. Không thêm behavior chưa được duyệt.
10. Cập nhật client/exports/docs/fixtures; chạy regression liên quan và type/lint checks bên dưới.
11. Trước mỗi commit: `node .gitnexus/run.cjs detect-changes --scope all --repo .`; nếu partial/truncated thì tăng giới hạn hoặc xác minh thêm và ghi rõ giới hạn.
12. Commit nhỏ sau khi checks của phần đó pass, ví dụ `feat: handle approved handover exceptions`; issue chỉ đóng khi mọi AC đạt và integration chạy thực sự.

Mỗi bước tạo test/query/contract nên chia tiếp theo một case 2–5 phút; không coi toàn bộ module là một bước. Với decision-only issue, đầu ra là policy/decision matrix được duyệt; không thực hiện runtime steps 4–9.

## Lệnh kiểm chứng

Chạy từ repository root. Cấu hình DB/Redis test theo `docs/local-database-tests.md`; DB phải loopback riêng có tên `metastorage_inspection_test_*`, không dùng development/production. Các suite opt-in phải có env guard và chạy thật, không đếm skip là pass. Khi cần fixtures auth/mail/provider dùng credentials test.

```sh
bun test apps/api/tests/integration/handover-exceptions.test.ts
bun run --filter api check-types
bun run --filter @metastorage/contracts check-types
bun run --filter @metastorage/database check-types
bun run --filter @metastorage/api-client check-types
bun run --filter api lint
bun run --filter @metastorage/contracts lint
bun run --filter @metastorage/database lint
bun run --filter @metastorage/api-client lint
git diff --check
```

Expected: selected test cases PASS, 0 skipped trong phạm vi yêu cầu; type/lint exit 0. Với decision-only issue chỉ `git diff --check` và review policy, không chạy suite runtime vô nghĩa. Regression phải chọn theo call graph của diff; không chạy toàn bộ suite để thay cho việc chọn đúng test. Nếu có UI thay đổi ở follow-up, chạy flow E2E và kiểm tra UI trong browser theo AGENTS.md trước khi nghiệm thu UI.

---

## Kết quả tạo issue

- [157](https://github.com/vlnguyen910/metastorage/issues/157) [Backend][Customer][P0] Bổ sung API booking của tài khoản customer
- [158](https://github.com/vlnguyen910/metastorage/issues/158) [Backend][Catalog][P1] Cung cấp availability public theo toàn kỳ thuê
- [159](https://github.com/vlnguyen910/metastorage/issues/159) [Backend][Booking][P2] Hoàn thiện đổi lịch và giới hạn đặt trước 30 ngày
- [160](https://github.com/vlnguyen910/metastorage/issues/160) [Backend][Access][P2] Cho phép lưu guest booking đã xác minh vào tài khoản
- [161](https://github.com/vlnguyen910/metastorage/issues/161) [Decision][Customer][P1] Chốt policy gia hạn, khoản phải thu và thu công nợ
- [162](https://github.com/vlnguyen910/metastorage/issues/162) [Backend][Payments][P1] Thu khoản phải thu, phí phát sinh và đồng bộ báo cáo
- [163](https://github.com/vlnguyen910/metastorage/issues/163) [Backend][Renewal][P1] Gia hạn rental qua thanh toán và cập nhật lifecycle
- [164](https://github.com/vlnguyen910/metastorage/issues/164) [Decision][Support][P1] Chốt phạm vi, quyền và lifecycle hỗ trợ customer
- [165](https://github.com/vlnguyen910/metastorage/issues/165) [Backend][Support][P1] Tạo và theo dõi yêu cầu hỗ trợ của customer
- [166](https://github.com/vlnguyen910/metastorage/issues/166) [Backend][Support][P1] Phân công, phản hồi và xử lý ticket hỗ trợ
- [167](https://github.com/vlnguyen910/metastorage/issues/167) [Backend][Handover][P2] Chốt và xử lý ngoại lệ từ chối hoặc không thể bàn giao kho

Đã tạo và đọc lại cả 11 issue trên GitHub: tất cả OPEN; title/body khớp bản đã soạn; mọi dependency URL đã được xác minh. File Modify chưa có trong baseline của support operations được tạo bởi prerequisite support customer, không phải file hiện có bị thiếu. Chưa triển khai runtime hoặc migration.

Bản kế hoạch được soạn trong worktree riêng và bàn giao tại `docs/plans/2026-10-24-customer-backend-completion.md` của working tree chính. Không commit/push; không sửa runtime, schema hoặc dữ liệu. Không chạy tests trong tác vụ tạo backlog.
