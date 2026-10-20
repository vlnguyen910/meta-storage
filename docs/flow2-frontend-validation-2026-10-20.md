# Flow 2 frontend — kiểm tra ngày 2026-10-20

Phạm vi: luồng chính đã thống nhất trong `docs/plans/flow2-backend-completion.md`.
FM gán/đổi ô kho cùng loại, phân công Staff và theo dõi; Staff xác minh booking,
lưu checklist, khóa biên bản rồi xác nhận khách nhận kho. Nâng/hạ loại kho và
xử lý từ chối/hoàn tiền còn TBD. Không sửa backend nghiệp vụ hoặc schema DB.

## Phần hoàn thiện

- Checklist bốn mục theo contract backend, lưu nháp thiếu/FAIL; bốn PASS mới được khóa.
  Ghi chú và ảnh tùy chọn; không suy diễn PASS cho hồ sơ cũ.
- Khóa biên bản và bàn giao là hai bước riêng. Màn hình FM ghi rõ đang chờ bàn giao
  hoặc đã bàn giao, kèm thông tin người thực hiện/thời gian từ API.
- Staff nhận `STAFF_TASK_ASSIGNED` qua WebSocket cookie session, đúng người nhận;
  cập nhật danh sách, chống toast trùng, không tự chuyển khỏi form đang làm.
- Mất mạng/kết nối có trạng thái và phục hồi; polling giữ nguyên. Policy 1008 dừng
  retry tự động; rời Staff shell hoặc đổi tài khoản đóng kết nối.
- URL WebSocket được tạo tại `packages/api-client`, sử dụng cấu hình API hiện tại.

## Bằng chứng backend thật trên DB test riêng

DB: `metastorage_inspection_test_flow2_alignment`; booking `BK-TEST-07CD37BA`.
Không thao tác bàn giao booking của người dùng trong `storex_local`.

Browser Chromium đi qua Next.js 3101 → API 4111, không mock HTTP/WebSocket:

1. Đăng nhập manager và Staff bằng hai browser context cookie session riêng.
2. Manager gọi assign-staff; Staff thấy thông báo và booking xuất hiện ngay.
3. Staff lưu bốn PASS, không ghi chú/ảnh, khóa biên bản. Booking vẫn CONFIRMED.
4. Staff xác nhận khách nhận kho; tải lại vẫn thấy thuê kho đang hoạt động.
5. Đọc lại DB bằng Drizzle: booking CHECKED_IN, inspection COMPLETED, bốn PASS,
   handedOverAt có giá trị, rental ACTIVE, unit OCCUPIED.

Ảnh và log tại `/tmp/storex-real-staff-notification.png`,
`/tmp/storex-real-final-handover.png`, `/tmp/storex-real-browser.log`,
`/tmp/storex-real-handover.log`, `/tmp/storex-flow2-db-proof.log`.
Các server test 3101/4111 đã được dừng. Server người dùng 3000/8080 giữ chạy.

## Kiểm tra tự động

- Web unit/component: 70/70 PASS.
- Workspace type-check: 8/8 tasks PASS; web type-check sau sửa kết nối: PASS.
- Root build: 3/3 tasks PASS; web build sau sửa trạng thái kết nối/contrast: PASS.
- Flow 2 E2E: lượt toàn bộ gần nhất 37 PASS, 2 FAIL tại kiểm tra số kết nối.
  Sau sửa phép đo và contrast dashboard, hai test kết nối desktop/mobile PASS
  (axe không có vi phạm), test FM theo dõi bàn giao PASS. Test manager navigation
  timeout khi chạy cùng build, chạy lại riêng PASS. Toàn bộ 39 kịch bản đã có
  lượt xác nhận PASS; không ghi nhận một lượt chạy toàn bộ 39/39 sau các sửa cuối.
- Đã xem ảnh browser desktop/mobile và kiểm tra lại HCM03 trên localhost:
  Staff kết nối realtime, FM thấy trạng thái chờ bàn giao; không có pageerror.
- Biome: PASS, 610 files; `git diff --check`: PASS.

Lượt E2E đầu có hai timeout chờ UI xác thực khi chạy cùng build và browser test riêng;
hai test trạng thái kết nối ban đầu đếm thiếu kết nối khởi tạo lại của React Strict Mode.
Đã sửa phép đo phục hồi kết nối để không phụ thuộc callback khởi tạo Strict Mode đến trễ; giữ kiểm tra không retry sau policy rejection và bổ sung kiểm tra policy rejection sau
chu kỳ offline/online. Axe sau đó phát hiện chữ phụ dashboard thiếu contrast; đã tăng độ đậm
từ #707975 sang #5c6661 và kiểm tra lại desktop/mobile. Không tăng timeout để che lỗi.

Backend integration/CI/CD không được chạy lại trong phạm vi frontend này; xem
`docs/ci-cd-validation-2026-10-19.md` cho kết quả và các lỗi backend còn tồn tại.
Kiểm tra browser thật ở trên không thay thế toàn bộ backend integration suite,
Cloudinary/SePay/email thật hoặc WebSocket trên hạ tầng deploy.


## Chạy lại integration phần 3 (2026-10-20)

Đã chạy lại bốn suite riêng bằng Bun 1.4.2 trên
`metastorage_inspection_test_ci_20261019` và Redis logical DB 14:

| Suite | Kết quả | Assertions |
| --- | --- | --- |
| inspections.integration.test.ts | PASS | 50 |
| handover.integration.test.ts | PASS | 48 |
| flow2-assignment.integration.test.ts | PASS | 26 |
| flow2-websocket.integration.test.ts | PASS | 30 |

Tổng 4/4 test, 154 assertions, không fail trong lượt này. Không sửa backend hoặc
hai test từng lỗi để đạt kết quả này. Lượt chạy này dùng Bun 1.4.2, khác phiên bản
1.3.14 được ghim trong CI; không thay thế kết quả CI remote. Người dùng báo đã
chạy xong phần 1 (CI chuẩn) và phần 2 (E2E). Không thao tác dữ liệu storex_local.
Log chi tiết: `/tmp/storex-part3-*.log`.

## Sửa sau review PR #136

- Giữ ghi chú, checklist và version gốc khi refetch hoặc lưu gặp 409. Tải snapshot
  máy chủ để đối chiếu; Staff chủ động chọn giữ bản nháp trên version mới hoặc bỏ
  bản nháp để nạp server. Không tự gửi lại. Không áp draft vào biên bản đã khóa
  hoặc có ngữ cảnh assignment/verification/checklist khác.
- Giữ màn chỉnh sửa khi refetch history lỗi nhưng còn cache, tránh unmount làm mất draft.
- Gỡ các thay đổi Flow 2 khóa hoặc gắn nhãn API vào workspace BOM/Admin. Hai prototype
  độc lập được giữ theo quyết định đã chốt; tích hợp Web Flow 4 thuộc PR #134 riêng.
- Web tests hiện tại: 79 PASS, gồm 9 ca hồi quy mới dùng hook thật; type-check 8/8.
- Browser Edge emulation dùng response fixture có kiểm soát: tái hiện 409 và giữ
  một PASS/ghi chú chưa lưu; đối chiếu rồi hoàn tất inspection và handover riêng;
  xác nhận BOM/Admin mở với nhãn minh họa. Axe không có lỗi ở conflict/handover,
  không tràn ngang ở 375/390/430px, không pageerror.
- Lượt sửa này không chạy bộ E2E, không ghi dữ liệu backend thật và không thay thế
  bằng chứng integration PostgreSQL/WebSocket ở các lượt trước.
