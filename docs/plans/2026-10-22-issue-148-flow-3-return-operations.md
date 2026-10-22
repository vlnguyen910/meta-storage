# Issue 148 — Return Operations Implementation Plan

**Goal:** Bổ sung context vận hành, preview quyết toán và số dư hoàn theo nguồn cho Flow 3, dựa trên backend hiện có.

**Architecture:** Mở rộng module `returns` theo Route → Service → Repository. Dùng chung phép tính và kiểm tra điều kiện giữa preview, settlement và financial correction; giữ transaction/row locks hiện có cho mutation. Đề xuất không cần migration vì dữ liệu nguồn và phân bổ refund đã được lưu.

**Tech Stack:** Fastify, Drizzle/PostgreSQL, Zod, TypeScript, Bun integration tests.

---

## 1. Baseline và kết quả review

Review ngày 2026-10-22 tại checkout `d11c010`. Issue #148 cập nhật lúc 09:54:48Z, chưa có comment. Đây là kế hoạch đề xuất, chưa triển khai hay chạy test.

Nguồn: [#148](https://github.com/vlnguyen910/metastorage/issues/148), [#139](https://github.com/vlnguyen910/metastorage/issues/139), [#33](https://github.com/vlnguyen910/metastorage/issues/33), [#34](https://github.com/vlnguyen910/metastorage/issues/34), [#77](https://github.com/vlnguyen910/metastorage/issues/77), [#113](https://github.com/vlnguyen910/metastorage/issues/113), `docs/returns-api.md`, `docs/db-diagram.md` và nhánh remote `feat/flow-3-implement` tại `2b71ac2`.

| Yêu cầu | Backend hiện tại | Phần cần sửa |
| --- | --- | --- |
| Context queue/detail | `ReturnsService.queue` (182), `get` (495) và `requestDto` (42) chỉ có ID, lịch và trạng thái request | Join booking/rental/unit/type/facility/staff và trả DTO có allowlist |
| FM facility, FS assignment | Đã có `manager`, `staff`, `reader`; queue lọc assignedStaffId | Giữ kiểm tra trước khi trả context; bổ sung assertions cho dữ liệu mới |
| Preview | Chưa có route; `assess` (1205) tính và insert settlement/audit; `settle` (1280) đóng rental/release occupancy | Tách tính toán và eligibility khỏi persistence; thêm POST preview |
| Stale settlement | Mutation mới kiểm tra version trong transaction; nhánh COMPLETED replay trả trước version check | Chốt và kiểm thử ngoại lệ replay; không coi mọi request settlement hiện đã check version |
| Refund input theo nguồn | `ConfirmReturnRefundSchema` đã có đủ fields yêu cầu; DB có hai cột allocation | Tái sử dụng, không thêm lại cột/input |
| Validate mixed/partial refund | `refundAllocation` và `confirmRefund` đã kiểm tổng, từng nguồn, payment cap, proof, uniqueness | Bổ sung coverage và rà soát replay khi bỏ các optional components |
| Refund response | Detail có lịch sử allocation; settlement chỉ có tổng remaining; confirm trả id/amount/time | Thêm summary dùng chung cho detail/preview/confirm |
| Swagger/shared response | Routes hiện chủ yếu khai báo input; shared DTO response chưa bao phủ toàn bộ detail | Khai báo response Zod/envelope thực tế cho các route bị ảnh hưởng |

Frontend remote xác nhận vấn đề: `apps/web/src/features/returns/return-finance-panel.tsx` khóa nút settlement và khóa refund khi có unused-rent refund. Nhánh này đã có `ReturnRequestDetailDto`, `ReturnRefundDto` và client `returnActions`; checkout hiện tại chưa có các bổ sung đó. Phải hợp nhất contracts khi tích hợp, tránh khai báo trùng hoặc xóa type đã dùng.

Các case mixed refund, retry đồng thời, over-refund, authorization, correction, property và rollback đã có trong `apps/api/tests/integration/returns.integration.test.ts` (đặc biệt 777, 990, 1052, 1141, 1226, 1345). Kế hoạch mở rộng suite này thay vì viết lại toàn bộ.

## 2. Các điểm cần thống nhất trước khi code

Đây là đề xuất để review, chưa phải quyết định nghiệp vụ đã được chấp thuận.

1. **Customer identity và contact:** schema hiện có `bookings.userId` nullable và contact theo booking, không có business Customer ID. #77 mô tả model Customer riêng nhưng diagram hiện hành và code dùng booking contact; #113 cũng xác nhận dùng contact của từng booking. Đề xuất `customer.id = booking.userId` nullable, ghi rõ đây là account ID, tên lấy `contactName`, vận hành dùng `contactPhone`; email chỉ thêm nếu FM/FS cần. Không tạo ID giả hoặc inner join users khiến guest biến mất. Nếu issue bắt buộc business Customer ID không null thì đây là thay đổi scope/schema cần quyết định riêng.
2. **Preview khi thiếu actualReturnAt/policy:** không thể tính phí chính xác. Đề xuất HTTP 200 với `canClose: false`, `blockingReasons` và `calculation: null`; khi đủ đầu vào thì calculation chứa toàn bộ tiền dạng string. Stale version 409, sai input 400, điều chỉnh tiền vượt giới hạn nghiệp vụ giữ 422. Không trả fee bằng 0 cho dữ liệu chưa biết.
3. **Refund legacy không rõ nguồn:** số tổng vẫn biết nhưng không thể trả cả bốn số nguồn chính xác. Đề xuất summary có `allocationKnown: false`, fields nguồn nullable và chặn confirmation cần số dư nguồn; không làm mất toàn bộ detail/history. Điều này cần thống nhất vì #148 hiện yêu cầu tất cả money là string. Không tự ghi lại lịch sử hoặc gán phần chưa biết thành 0.
4. **Replay/version:** refund replay cùng nghiệp vụ phải thành công dù request version đã tăng sau lần ghi đầu; expectedVersion là concurrency token, không phải fingerprint tài chính. Settlement COMPLETED hiện cũng replay trước version check: đề xuất cho phép replay thuần đọc có payload tương đương, mọi thao tác tạo/đổi settlement bắt buộc check version. Nếu #148 yêu cầu stale luôn 409 kể cả replay, cần cập nhật test và tài liệu tương ứng.
5. **Payload tương đương:** hiện refund replay chỉ so sánh source amounts khi client truyền chúng; payload bỏ components sau một mixed refund có thể được chấp nhận. Đề xuất validate quy tắc mixed refund cả khi replay, so sánh amount/reference/evidence/actor và normalized allocation dựa trên bản ghi gốc, không dựa trên số dư hiện tại. Nếu cần phân biệt payload từng byte, cần lưu fingerprint mới; đó không phải hành vi hiện có.

Các issue #33/#34 còn mở và chủ yếu chứa checklist quyết định cũ. Phạm vi #148 dùng policy đã thể hiện trong #139, docs và code; không tự mở rộng waiver, payment-provider refund, auto-collect debt hay guest access.

## 3. Thiết kế đề xuất

### Operational context

Queue giữ array/pagination/order hiện tại, mỗi item thêm `context`. Detail giữ `request`, `settlements`, `refunds`, audit và các fields hiện có, thêm `context` ở root. Đề xuất context vận hành chỉ dành FM/FS được phép; owner giữ dữ liệu cũ, không tự được thêm staff/contact PII. Không mở rộng `requestDto` chung theo cách bắt create/edit/list cũng phải join.

Context chọn rõ: booking(id,bookingCode), customer(id,name,phone theo quyết định trên), rental(id,status,expectedEndAt,depositSnapshot), unit(id,code,unitTypeName,sizeLabel), facility(id,name), assignedStaff(id,name)|null.

Nguồn: rental.physicalUnitId → storageUnits → unitTypes; booking contact; returnRequests.assignedStaffId → users; facility từ rental/request cùng phạm vi. Join phải bảo toàn một row/request, kể cả guest và chưa assign staff. Tiền rental dùng `wholeVnd(rental.depositAmount).toString()` vì cột hiện là numeric(14,2), không dùng Number. Queue không truy vấn riêng từng item.

### Settlement preview và phép tính

Tái sử dụng `SettleReturnSchema` làm input preview; không nhân bản validation. Response đề xuất:

```ts
{
  requestId,
  version,
  canClose,
  blockingReasons: [{ code, message }],
  calculation: null | {
    depositSnapshot, rateSnapshot, overdueFeeAmount, damageAmount,
    unusedRentRefundAmount, refundEntitlement, remainingRefund, debtAmount,
    remainingDepositRefund, remainingRentRefund,
    confirmedDepositRefund, confirmedRentRefund, allocationKnown
  }
}
```

Tách hàm tính tiền thuần trong `returns.policy.ts`, dùng BigInt/wholeVnd/overdueAmount hiện có. `assess` dùng kết quả để persist revision và audit; preview chỉ gọi phần tính và phần eligibility. `decideTime` cũng gọi `assess`, nên phải giữ snapshot và revision/SLA semantics của correction.

Eligibility dùng đúng gates của `settle`: request INSPECTING, inspection mới nhất PASS, có physical return, rental chưa CLOSED, property của mọi attempt đã xử lý và evidence hợp lệ; damage > 0 phải có evidence tương ứng; calendar/rate phải tồn tại. Không thêm gate chờ refund/debt=0 hoặc tự chặn mọi manual-review flag. Messages nằm trong `packages/contracts/src/returns.messages.ts`.

Preview có thể tái sử dụng `lockedRequest` để đọc nhất quán, chấp nhận giữ lock ngắn theo facility → booking → rental → request hiện tại. Đây là read-only về dữ liệu nghiệp vụ, không phải PostgreSQL READ ONLY transaction vì có row locks. Không gọi insert/update/audit/outbox/storage/provider. Mutation đọc lại version, rate, evidence và tính lại trong transaction; rate đổi có thể đổi kết quả dù request version chưa đổi. Không tạo preview token/cache có quyền duyệt.

### Refund summary

Thêm `refundSummary` ở detail root (null trước settlement) và confirm response; preview chứa cùng các fields trong calculation. Summary dựa trên latest revision; không biến settlement lịch sử thành snapshot số dư hiện tại. Giữ response fields cũ để tương thích.

```text
depositEntitlement = max(depositSnapshot - overdueFeeAmount - damageAmount, 0)
rentEntitlement = unusedRentRefundAmount
refundEntitlement = depositEntitlement + rentEntitlement
remainingRefund = max(refundEntitlement - tổng refund.amount đã xác nhận, 0)
remainingDepositRefund = max(depositEntitlement - confirmedDepositRefund, 0)
remainingRentRefund = max(rentEntitlement - confirmedRentRefund, 0)
```

Nguồn đã hoàn lấy immutable allocation; legacy chỉ xử lý theo policy hiện hành với originating settlement, không reinterpret theo latest revision. Bản ghi ambiguous áp dụng quyết định mục 2.3. Sau correction, tổng hai số dư nguồn có thể lớn hơn remainingRefund nếu một nguồn đã hoàn vượt entitlement mới; confirm phải giữ cả giới hạn tổng và từng nguồn, không tự chuyển tiền giữa nguồn. Debt giữ công thức hiện tại.

Confirm/replay trả cùng refund ID và snapshot summary hiện tại, kèm version hiện tại để client biết trạng thái; cùng retry không có nghĩa summary phải bất biến nếu sau đó có giao dịch mới. Reference/evidence/history giữ nguyên. Giữ cap trên payment total và unique constraints.

## 4. Phạm vi ảnh hưởng

GitNexus đã reindex đến checkout hiện tại; `impact ReturnsService --direction upstream --repo .` trả **HIGH**, 8 dependents, 4 trực tiếp, 3 process groups. Direct gồm returns routes và `SystemSettingsService.update`; gián tiếp có system-settings routes, app/index. `context assess` xác nhận callers `settle` và `decideTime`; `context refundAllocation` xác nhận `confirmRefund`.

Analyzer có cảnh báo giới hạn khám phá execution flows, nên không coi graph là danh sách đầy đủ. Các consumers bổ sung cần giữ tương thích: reports return accounting, rentals/guest payment history, contracts/client/Web trên nhánh Flow 3 và fixtures. Chưa có thay đổi code nào được thực hiện.

## 5. Các task triển khai theo thứ tự

### Task 1 — Chốt contract và cases

Files: `packages/contracts/src/returns.ts`, `returns.types.ts`, `returns.messages.ts`; `docs/returns-api.md`.

1. Chốt 5 điểm mục 2 trước khi triển khai behavior phụ thuộc.
2. Hợp nhất DTO detail/refund từ nhánh Flow 3, giữ exports hiện có trong `packages/contracts/src/index.ts`.
3. Định nghĩa Zod response cho context, summary, preview và confirm, dùng envelope `{ success, data }`; interfaces chỉ ở `.types.ts`.
4. Viết case input/output và nullable/unknown examples trong docs. Thống nhất với frontend trước khi triển khai integration client.

### Task 2 — Context queue/detail

Files: `apps/api/src/modules/returns/returns.repository.ts`, `returns.service.ts`, `returns.types.ts`, `returns.routes.ts`; `apps/api/tests/integration/returns.integration.test.ts`.

1. Run impact cho các symbols chuẩn bị sửa trên index mới; cảnh báo HIGH/CRITICAL và đối chiếu UNKNOWN bằng text search.
2. Bổ sung integration cases context và authorization vào fixtures hiện có; chạy focused cases để thấy thiếu fields.
3. Thêm Drizzle selects/joins và DTO mapping riêng cho queue/detail. Không join user như điều kiện bắt buộc của booking.
4. Gắn response schema đầy đủ; kiểm tra serializer không strip inspections/evidence/audit/refunds cũ.
5. Chạy lại cases; kiểm queue không duplicate rows, pagination/order không đổi, guest/unassigned/cross-facility đúng.

### Task 3 — Phép tính và source balances dùng chung

Files: `apps/api/src/modules/returns/returns.policy.ts`, `returns.service.ts`, `returns.types.ts`; `apps/api/tests/units/returns.policy.test.ts`; integration suite hiện có.

1. Thêm case phép tính đáng kể: fees vượt deposit, correction sau partial refund, source overspend, legacy ambiguous.
2. Tách calculation khỏi insert/audit trong `assess`; giữ callers settle/decideTime dùng kết quả chung.
3. Tách refund summary từ logic hiện có của confirmRefund; dùng cho detail/preview/confirm.
4. Bổ sung summary vào confirm/replay, kiểm tra payload equivalence theo quyết định đã chốt. Không thêm DB column nếu không cần fingerprint mới.
5. Chạy policy và integration cases; kiểm correction không ghi đè settlement/refund cũ, concurrent refund không vượt số dư.

### Task 4 — Preview và mutation revalidation

Files: `apps/api/src/modules/returns/returns.service.ts`, `returns.routes.ts`, `returns.types.ts`; contracts/messages; integration suite.

1. Viết cases authorization/stale/blocked/success/no-side-effect trước khi thêm route.
2. Tách eligibility không side effect, dùng từ preview và settle; giữ audit damage ở mutation.
3. Thêm `POST /return-requests/:requestId/settlement/preview` với input dùng lại SettleReturnSchema, response Zod và FM authorization.
4. Revalidate version và tính lại khi settle; xử lý replay theo quyết định mục 2.4.
5. Test preview rồi đổi request/evidence/policy; mutation phải dùng trạng thái hiện tại, không tin kết quả preview client gửi.
6. Assert không đổi counts/values của settlement, refund, rental, unit, assignments, capacity, audit, outbox và request.version khi preview, kể cả blocker/failure.

### Task 5 — Regression, OpenAPI và handoff

Files: `docs/returns-api.md`; tests hiện có; xem consumers `apps/api/src/modules/reports/reports.repository.ts`, rentals/guest history; remote Flow 3 contracts/client.

1. Document exact DTO, nullable cases, blockers, status codes, replay và timing của balances.
2. Assert generated OpenAPI có request + response schema đầy đủ cho 4 routes và mutation settlement nếu response đổi.
3. Chạy focused suites trên DB test cô lập; không chấp nhận suite skip do thiếu env là PASS.
4. Chạy type checks, lint scoped files. Chạy reports regression nếu thay cách đọc legacy allocation/correction.
5. Backend handoff phải nêu frontend cần nối preview và mở mixed refund dựa trên response. Acceptance criteria UI chỉ hoàn thành sau integration trên nhánh Flow 3 và browser verification FM/FS; backend test đơn thuần chưa đáp ứng toàn bộ issue.
6. Trước commit, chạy `node .gitnexus/run.cjs detect-changes --scope all --repo .`; xử lý partial/truncated, không dùng kết quả thiếu để kết luận an toàn.

## 6. Kiểm chứng dự kiến

Prerequisites: `NODE_ENV=test`, `DATABASE_URL` và `MY_STORAGE_LOCAL_DATABASE_URL` trỏ cùng DB loopback `metastorage_inspection_test_*`, đã migrate; `REDIS_URL` và `REDIS_TEST_URL` dùng Redis test riêng nếu chạy các cases outbox. Không dùng DB vận hành để tạo fixtures. Reports suite cần env riêng theo fixture của nó.

```bash
bun test --preload ./apps/api/tests/setup.ts apps/api/tests/units/returns.policy.test.ts
bun test --preload ./apps/api/tests/setup.ts apps/api/tests/integration/returns.integration.test.ts
bun run --filter api check-types
bun run --filter @metastorage/contracts check-types
```

Expected: cases thực sự chạy và pass; không skip các cases yêu cầu. Thêm reports integration khi phạm vi đổi ảnh hưởng cách diễn giải refund. Browser verification thực hiện sau khi có frontend integration: FM preview đủ/thiếu điều kiện, refresh stale version, mixed refund, retry, FS sai assignment và loading/error/reload.

## 7. Giới hạn của review và phạm vi

Đã đọc source, tests, issues và frontend remote; chưa chạy backend, DB tests hoặc browser. Không audit dữ liệu production nên chưa biết có bao nhiêu legacy refund thiếu allocation. Chưa sửa backend/frontend, chưa commit/push hay cập nhật issue.

Không thêm payment provider, tự thu debt, rewrite ledger, tạo Customer table hay đổi chính sách closure trong #148. Nếu lựa chọn ở mục 2 buộc schema mới, đọc/cập nhật diagram và Drizzle cùng nhau rồi generate migration bằng `bun run db:generate`; không sửa migration bằng tay.


## 8. Thực hiện ngày 2026-10-23

Yêu cầu thực hiện plan được áp dụng theo các đề xuất mục 2: nullable account ID và
contact phone; preview calculation null khi thiếu dữ liệu; source summary nullable
khi legacy chưa rõ; giữ replay thuần đọc; so sánh payload theo tác động nghiệp vụ.
Backend đã bổ sung context queue/detail, shared response contracts/OpenAPI, preview,
calculation/eligibility dùng chung, refund summary và kiểm tra mixed replay. Không
cần đổi database schema. Single-source replay dùng allocation đã lưu, độc lập với
số dư sau các giao dịch/correction khác.

Tests mở rộng suite hiện có cho authorization, guest/unassigned context, PII allowlist,
preview không side effects, thiếu configuration, blockers, input/stale validation,
mutation tính lại khi rate thay đổi, source balances/partial/mixed/legacy và OpenAPI.
Frontend/API-client trên nhánh Flow 3 cần bước tích hợp riêng để mở các controls.

Kết quả kiểm chứng: returns integration 29/29 (405 assertions), reports PostgreSQL
regression 12/12, return policy 5/5; API/contracts type checks và Biome đều pass.
Các suite database chạy trên DB test riêng đã migrate, không chạy trên database
vận hành. Swagger đã được mở bằng Chromium/Playwright: hiển thị input/output,
Try it out nhận 401 khi chưa đăng nhập và không có page error/loading bị treo.
Chưa kiểm tra browser flow FM/FS vì frontend Flow 3 nằm trên nhánh tích hợp riêng.

GitNexus detect-changes đã chạy với scope all và limit 1000; phân loại CRITICAL,
24 execution flows liên quan. Đây là cảnh báo phạm vi tài chính, không phải bằng
chứng tests thất bại hoặc bằng chứng mọi nhánh đã được kiểm chứng. Chưa commit/push.
