# Flow 3 Web Completion Implementation Plan

**Goal:** Hoàn thiện giao diện trả kho FM/FS và quyết toán/hoàn tiền bằng API đã merge trong PR #149, issue #148 thay thế #147.

**Architecture:** Giữ Next.js và feature returns hiện có. Centralized API client gọi backend; TanStack Query quản lý server state; React Hook Form và shared Zod contracts quản lý form. Backend quyết định quyền, trạng thái và mọi phép tính tài chính.

**Tech Stack:** Next.js, React, TypeScript, TanStack Query, React Hook Form, Zod, Tailwind, Vitest, Playwright và axe hiện có.

---

## Quyết định đã chốt

- Chỉ tích hợp API hiện tại; không thêm/sửa backend, migration, dependency hoặc Expo.
- Làm trên nhánh hiện tại `feat/flow-3-completion-23102026`, giữ mọi thay đổi có sẵn.
- Tái sử dụng queue/detail và workspace tài chính; không tạo thêm route cho quyết toán.
- Lấy preview mới trước xác nhận. Backend vẫn tính lại khi duyệt; frontend không bảo đảm tuyệt đối kết quả khớp preview nếu chính sách đổi giữa hai request. Thông báo rõ giới hạn này và luôn hiển thị kết quả đã lưu.
- Không tự commit/push. Tham chiếu @metastorage-frontend-quality; các lần commit về sau phải qua format và GitNexus, không bỏ hook.
- Không coi hoàn tất đợt này là hoàn tất toàn bộ #139: Mobile và các phạm vi khác vẫn theo kế hoạch riêng.

## Task 1 — API client và contract

**Files:** `packages/api-client/src/index.ts`, `packages/api-client/src/flow3.ts`; chỉ bổ sung typing tối thiểu trong `packages/contracts/src/returns.types.ts` nếu cần queue DTO chung.

1. Kiểm tra Git status, cập nhật index GitNexus và chạy impact trước sửa. Index hiện cũ, FTS lỗi; kết hợp context/impact với source khi UNKNOWN và cảnh báo HIGH/CRITICAL.
2. Thêm method `api.returns.previewSettlement(requestId, input, signal?)` gọi POST `/return-requests/:requestId/settlement/preview`, input `SettleReturn`, output `ReturnSettlementPreviewDto`.
3. Giữ `api.returns.settle` hiện có; cập nhật kiểu queue để giữ `context` thay vì làm mất qua `ReturnRequestDto[]`. Dùng `ReturnOperationalContextDto` đã có.
4. Sửa output `api.returnActions.confirmRefund` thành `ConfirmReturnRefundDto`, bao gồm version và refundSummary. Detail dùng `ReturnRequestDetailDto` hiện có; không tạo DTO hoặc response schema trùng.
5. Giữ nguyên URL GET `/facilities/:facilityId/return-requests` dù route backend đã được chuyển module. Không thêm API song song hoặc direct HTTP trong component.

## Task 2 — Context hồ sơ FM/FS

**Files:** queue/detail và các `*.types.ts`, `*.messages.ts` trong `apps/web/src/features/returns/`.

1. Queue hiển thị booking code, tên khách, mã/loại kho, lịch và trạng thái từ context. Search tiếp tục chỉ trên các trang đã tải, thêm booking code/tên khách/mã kho vào tập tìm kiếm; không giả lập server search.
2. Detail hiển thị contact cần thiết, rental/hạn thuê/cọc snapshot, unit, facility và assigned staff từ response. ID đầy đủ nằm ở phần kỹ thuật thu gọn.
3. Guest có `customer.id = null` vẫn hiển thị contact snapshot; thiếu tên dùng nhãn trung tính, không ghép từ mock hay truy vấn Customer-only.
4. Không yêu cầu context vận hành ở màn Customer vì backend trả null theo quyền. FS không được mở thao tác tài chính; cơ sở của detail lấy từ request/context và assignment phù hợp.

## Task 3 — Xem trước và duyệt quyết toán

**Files:** `return-finance-panel.tsx`; tạo hook/form/view con cùng feature và types/messages riêng, giữ panel cha gọn.

1. Thay thông báo chờ backend bằng form FM: khoản hư hỏng, tiền thuê hoàn theo ngoại lệ và lý do. Tiền là chuỗi integer VND; mặc định hai khoản nhập bằng 0, không gán sẵn khoản thu/hoàn khác. Dùng `SettleReturnSchema`.
2. Nút Xem trước gọi preview bằng version mới nhất. Đây là thao tác đọc: loading cục bộ, không overlay chặn toàn màn hình và không invalidate nghiệp vụ.
3. Hiển thị calculation server: cọc/rate snapshot, phí quá hạn, hư hỏng, tiền thuê được hoàn, tổng quyền hoàn, số dư, nợ; hiển thị blockers và cách quay lại bước kiểm tra/thực nhận/tài sản khi có thể.
4. `calculation = null` hiển thị Chưa xác định; không thay bằng 0. Chỉ cho duyệt khi `canClose`, calculation tồn tại và preview khớp input/request hiện tại.
5. Đổi input, version, nhận correction hoặc dữ liệu hồ sơ thay đổi sẽ hủy hiệu lực preview và đóng xác nhận. Hủy request preview cũ hoặc bỏ response đến muộn để không ghi đè bản mới.
6. Khi FM chọn Duyệt: lấy lại detail/version và gọi preview mới. Hiển thị dialog xác nhận kết quả mới nhất; nếu input/version thay đổi hoặc có blocker phải quay lại review. Báo rõ server tính lại theo chính sách tại lúc duyệt, rồi gọi settlement hiện có sau xác nhận cuối.
7. Settlement là mutation có global loading và chống double-submit. Thành công hiển thị settlement đã lưu, closure và refund tách riêng; không tự set CLOSED/AVAILABLE trước response server.
8. HTTP 409 giữ draft, tải detail mới và yêu cầu preview lại; 422 hiển thị lỗi để sửa. Timeout/5xx không tự retry settlement: tải detail để xác định outcome trước khi cho thao tác tiếp.

## Task 4 — Hoàn tiền theo nguồn và đồng bộ trạng thái

**Files:** refund form/hook con trong feature returns; `use-return-write.ts` và messages liên quan.

1. Dùng `detail.refundSummary` làm nguồn số dư hiện tại. Hiển thị riêng còn hoàn cọc, còn hoàn thuê, đã hoàn từng nguồn và tổng; giữ lịch sử revisions/refunds.
2. Khi summary null, chưa COMPLETED, hoặc `allocationKnown = false`, khóa xác nhận với lý do tương ứng. Giá trị nguồn null là Chưa xác định, không phải 0; vẫn cho xem tổng và lịch sử có thật.
3. Thay điều kiện khóa cũ dựa trên unusedRentRefundAmount bằng form nhập phần hoàn cọc và phần hoàn thuê. Luôn gửi hai trường phân bổ rõ ràng; tổng amount bằng tổng hai phần, dùng BigInt để cộng/so sánh số nguyên, không tự tính lại entitlement/phí.
4. Mỗi phần không âm, không vượt số dư nguồn, tổng dương và không vượt remainingRefund. Cần reference, evidence hợp lệ và checkbox xác nhận chuyển khoản thực tế đã hoàn tất; dùng `ConfirmReturnRefundSchema`. Không có nút tự chuyển tiền.
5. Upload evidence làm thay đổi request version: chờ upload/reload hoàn tất, giữ draft và selection, lấy version mới khi gửi. Cho dùng lại evidence REFUND đã upload sau reload khi người dùng chọn lại, không trộn TIME_CORRECTION.
6. Giữ idempotency key cho cùng payload khi mất phản hồi; chỉ đổi key khi thay giao dịch. Lưu pending attempt theo request và tài khoản trong sessionStorage để phục hồi reload, không lưu file base64 hoặc auth token. Khi phục hồi, tải detail, đối chiếu payload với giao dịch đã lưu trước khi gửi lại; không tự submit.
7. Sau refund dùng version/refundSummary server trả, tải lại detail và payments. Partial refund giữ form cho giao dịch tiếp theo; hoàn đủ thì đóng form. Corrections phải làm mới số dư và preview.
8. Tách lỗi ghi khỏi lỗi refresh trong `use-return-write`: một mutation đã thành công không được hiện thất bại chỉ vì refetch lỗi. Hiển thị kết quả đã ghi kèm cảnh báo tải lại và chặn bước tài chính tiếp theo tới khi có dữ liệu mới.
9. Invalidate query liên quan theo actor/facility/request; các mutation tài chính đồng bộ rental list/detail, queue, payments, inbox và reports vận hành đã có. Không rò cache hoặc pending attempt sang tài khoản khác.

## Task 5 — Kiểm chứng và bàn giao

**Tests:** mở rộng `apps/web/e2e/flow3-integration.spec.ts`; thêm integration test form/hook dùng fixture contract mới trong feature returns khi cần kiểm tra race và unknown outcome.

1. Cập nhật fixture context/refundSummary/preview/confirmation đúng response thật; test trước các hành vi hiện đang khóa hoặc thiếu, xác nhận fail đúng nguyên nhân rồi triển khai.
2. Kiểm tra FM/FS đúng cơ sở và assignment, guest contact ID null, Customer context null; không có nút tài chính cho FS.
3. Kiểm tra preview hợp lệ, blockers, calculation null, nhập mới vô hiệu preview, response đến muộn, 409 giữ draft, policy đổi khi xác nhận và kết quả settlement thực tế.
4. Kiểm tra closure độc lập refund; khoản không cần hoàn; debt chỉ hiển thị, không thu tiền.
5. Kiểm tra refund chỉ cọc, chỉ thuê, hỗn hợp, partial/nhiều lần, vượt từng nguồn/tổng, allocation unknown, chứng từ/version, double-click và retry cùng key. Kiểm tra reload phục hồi pending attempt và lỗi refresh sau mutation thành công.
6. Chạy `bun run check` trên checkout LF tương đương CI; chỉ format các file sửa, không bỏ hook vì CRLF. Chạy `bun run check-types`, `bun run --filter web test`, `bun run --filter web build`.
7. Chạy Playwright tập trung bằng `bunx playwright test --config flow3.playwright.config.ts` trong apps/web với Web API mode; kiểm tra desktop và 375/390/430px, axe, keyboard/focus/dialog, hover, loading và lỗi. Duyệt ảnh/UI sau test.
8. Kiểm chứng luồng ghi thật Customer → FM → FS → FM settle/refund trên API và PostgreSQL test cô lập theo hướng dẫn repo. Không reset/seed shared DB, không gửi email hoặc chuyển tiền thật. Nếu chưa có môi trường cô lập, ghi rõ fixture UI đã pass nhưng API-backed transaction chưa nghiệm thu; test bị skip không được tính pass.
9. Cập nhật `docs/flow-3-web-integration.md`: endpoint đã nối, cách demo từng role, giới hạn preview/policy, legacy allocation unknown và kết quả kiểm tra thực tế.

## Kết quả nghiệm thu

FM nhận diện được hồ sơ; FS hoàn tất kiểm tra; FM xem số tiền server tính rồi duyệt; backend trả closure và quyết toán đã lưu; FM ghi nhận các lần hoàn tiền theo nguồn, Customer xem kết quả. Các trường hợp chưa đủ điều kiện có lời giải thích và hướng phục hồi. Không còn thông báo chờ các API mà PR #149 đã cung cấp.
