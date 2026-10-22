# Kế hoạch và trạng thái tích hợp frontend Flow 3

Ngày rà soát: 21/10/2026. Nguồn phạm vi chính: [issue #139](https://github.com/vlnguyen910/metastorage/issues/139).
Kế hoạch gốc được cập nhật theo lần tích hợp UI web ở nhánh `feat/flow-3-implement`.
Backend không bị sửa; Stitch chỉ được dùng làm tham khảo layout, không chép HTML hoặc dữ liệu minh họa vào app.

Trạng thái tiếp tục triển khai ngày 22/10/2026: đã mở rộng Web cho guest đọc rental/payments/contracts,
Customer payments/contracts, FM hợp đồng, FS xử lý tài sản/ảnh/đề xuất sửa giờ, FM quyết định đổi giờ,
Admin checklist/calendar/settings, BOM rate và Customer/FM inbox. Duyệt settlement và refund hỗn hợp
vẫn khóa vì thiếu contract review/số dư theo nguồn. Mobile chưa tích hợp trong đợt này.
Mapping endpoint, phụ thuộc backend và cách test cập nhật tại `docs/flow-3-web-integration.md`;
các mục kế hoạch gốc bên dưới được giữ làm tài liệu tham chiếu.

## 1. Kết quả đọc code

| Phần | Hiện trạng kiểm chứng | Cách xử lý |
| --- | --- | --- |
| Backend trả kho | Có module `apps/api/src/modules/returns`, routes, service, repository, policy và shared input schemas | Tích hợp endpoints hiện có, không xây lại backend |
| Rental list | Đã sửa API client, hook phân trang current/history, consumer và mock response theo `{items, nextCursor}` | Dùng RentalPage cursor; không giả số lượng |
| Rental detail Web | Đã bỏ copy lỗi và nối yêu cầu trả kho; payment/contracts chưa hiển thị | Bổ sung khi tiếp tục tích hợp contract documents/payments |
| Guest | Đã có màn yêu cầu access link, exchange token và tracking cookie | Tái sử dụng; bổ sung rental/payments/contracts và private PDF. Không tạo luồng đăng nhập/tra cứu thứ hai |
| Returns client | Đã bổ sung các method client cho queue, request, slots, assignment, inspection, physical receipt và settlement; chưa có mock adapter | Dùng contracts hiện có; settlement chỉ đọc kết quả đã ghi nhận, chưa bật thao tác |
| Contract documents | Backend có upload/issue/list/private PDF; UI chưa tích hợp đầy đủ | FM upload và issue trong luồng booking trước handover; Customer/FS chỉ thấy issued theo quyền |
| FM/FS Web | Đã thêm mục điều hướng, queue, chi tiết, FM assignment; FS xác nhận lịch/ghi nhận thực nhận và checklist ảnh | Dùng facility assignment và staff list hiện có; queue response thiếu tên khách/ô kho nên không bịa thông tin |
| Mobile | Customer/FS có màn và demo workflow `/demo/*`; request/report không tương đương state machine backend | Giữ demo thành adapter riêng; tích hợp API thật thành một giai đoạn riêng, không coi adapter demo đã dùng được API thật |
| Các DTO trả kho | Có request/inspection/settlement DTO; detail còn được trả từ service bằng object tổng hợp | Đối chiếu và hoàn thiện typing response thiếu, không dùng `any` hoặc expose ORM models |
| Stitch | Đã rà C07-SHEET, C08, FM queue/detail và FS queue/checklist desktop; lọc PII, thông số, chính sách hoàn/IoT giả | Giữ layout StoreX hiện có; không nhúng HTML Stitch |

Các file tham chiếu: `docs/returns-api.md`, `docs/my-storage-api.md`,
`docs/rental-contracts-api.md`, `packages/contracts/src/returns{,.types}.ts`,
`apps/api/src/modules/returns/returns.service.ts`, `apps/web/src/features/rentals/*`,
`packages/api-client/src/mobile-workflows.ts`, `apps/mobile/src/features/demo/*`.

Graph đã được query/context cho ReturnsService; symbol được tìm thấy.
Index đang chậm 3 commit và keyword search bị thiếu FTS runtime trên Windows;
phạm vi này được kiểm chứng bổ sung bằng source trực tiếp. Không coi graph là đầy đủ.
Khi triển khai phải refresh index và chạy impact trước mỗi nhóm sửa code.

## 2. Các khoảng trống phải xử lý trước khi bật thao tác tương ứng

### 2.1. Response context cho FM/FS

`ReturnsService.queue()` hiện trả array request DTO. `get()` trả request,
actualReturnAt, inspections/photos, evidence, settlements, timeChanges, refunds,
audit. Chưa có tóm tắt booking/customer/unit/rental/deposit trước quyết toán,
và nhiều actor chỉ có ID. Không giả định FM/FS có thể gọi Customer-only rental detail.

Đề nghị backend đối chiếu và bổ sung context tối thiểu vào GET hiện có, có phân quyền:
booking code, mã ô kho, loại kho, tên người thuê khi cần vận hành, hạn thuê,
cọc đã lưu, tên nhân viên và điều kiện thao tác. Không thêm endpoint trùng chỉ để
lấy lại dữ liệu đó. Trong lúc chưa có, UI không bịa tên/giá từ mock để che thiếu dữ liệu.

Queue dùng `limit/offset/status` và trả mảng; không thiết kế tổng số, tìm kiếm toàn
hệ thống hoặc sắp xếp server-side khi response/query chưa hỗ trợ. Có thể dùng
“Tải thêm”; không hiển thị tổng giả.

### 2.2. Xem trước quyết toán

`POST /return-requests/:id/settlement` tính kết quả và đóng rental trong cùng thao tác.
Chưa tìm thấy endpoint preview; snapshot tài chính có trong detail sau khi đã settle.

Trước khi bật duyệt cần backend xác nhận dữ liệu review trước thao tác: giá trị cọc,
phí overdue, điều kiện đóng, khoản khấu trừ, tiền được hoàn và nợ. Đề xuất mở rộng
GET detail hiện có bằng preview theo contract được chốt, hoặc thống nhất cách review
khác với backend. Đây là đề xuất cần thống nhất, chưa phải API đã tồn tại.
Frontend không tự tạo công thức quyết toán chính thức hoặc duyệt khi người dùng
chưa xem được kết quả. Các phần còn thiếu hiển thị “Chưa xác định”, khóa nút và giải thích.

### 2.3. Guest và quyết định cũ

Issue #139 và code hiện tại dùng magic link. [Issue #77](https://github.com/vlnguyen910/metastorage/issues/77)
còn ghi email OTP và identity model khác với implementation hiện tại. Cần chủ dự án
đồng bộ tài liệu/issue hoặc xác nhận #139 thay thế quyết định cũ trước nghiệm thu guest.
Kế hoạch dùng magic link hiện có theo #139; không tự xây thêm OTP/claim/link account.

Guest chỉ có GET rental/payments/issued contracts trong phạm vi session đúng booking.
Không có API cho guest tạo/sửa/hủy return request; không đưa các nút này vào portal guest.
Magic link 24 giờ khác với phiên tracking: không hardcode thời gian session từ TTL của link;
dùng expiresAt server trả. Không tự liên kết guest booking với account do email giống nhau.

### 2.4. Cấu hình môi trường demo

Kiểm tra migration/seed cấu hình có sẵn, return-calendar, operating hours, slot 90 phút,
buffer 15 phút, checklist version, quyền facility/assignment và private storage.
Thiếu cấu hình phải báo đúng lỗi; không bỏ validation hoặc đổi giờ frontend để lách backend.
Dùng fixture scoped theo ID, không clear/reset database dùng chung.

## 3. Luồng và trạng thái phải thể hiện đúng

Luồng demo chính:

1. Rental đã ACTIVE sau handover → Customer gửi yêu cầu lịch trả.
2. Request PENDING → FM phân công FS → FS xác nhận lịch → CONFIRMED.
3. FS ghi nhận thời điểm thực nhận, kiểm tra theo checklist snapshot, thêm ảnh/tài sản.
4. Inspection PASS + đã thực nhận + tài sản xử lý xong → FM xem và duyệt quyết toán.
5. Khi backend xác nhận closure: request COMPLETED, rental CLOSED, unit AVAILABLE.
6. Nếu có khoản hoàn: trạng thái hoàn tiền theo dõi riêng; FM chỉ xác nhận sau chuyển
   khoản thủ công thực sự hoàn tất, có reference và bằng chứng.

Các nhánh bắt buộc:

- Chỉ Customer owner sửa/hủy request PENDING. PENDING chưa giữ slot.
- FS chỉ xác nhận/kiểm tra request đang được phân công tại facility hợp lệ.
- Ghi nhận actualReturnAt có thể từ CONFIRMED/INSPECTING/FAILED; không ép phải PASS
  rồi mới ghi nhận giờ thực nhận. Đây là sự kiện độc lập với hoàn tất inspection.
- FS hoàn tất PASS không đồng nghĩa request COMPLETED. “Đã kiểm tra — chờ quyết toán”
  là nhãn giao diện suy ra từ request INSPECTING + latest inspection PASS, không tạo enum mới.
- Serious issue → FAIL, request FAILED, unit MAINTENANCE. Retry tạo attempt mới,
  giữ attempt/bằng chứng cũ. FS không tự chọn unit AVAILABLE.
- Remaining property không tự làm FAIL. Phải lưu cách xử lý/bàn giao/lưu giữ,
  người nhận khi lưu giữ, thời gian và bằng chứng trước closure.
- Photo tối đa 5/inspection; issue cần note và ảnh. Snapshot severity thuộc checklist,
  FS không sửa độ nghiêm trọng để đạt PASS.
- Correction: FS đề xuất với lý do/bằng chứng → FM duyệt/từ chối. Hiển thị giờ cũ/đề xuất,
  lịch sử/revision; không ghi đè audit hoặc tự hoàn trả trạng thái trước đó.
- OVERDUE thuộc rental; không tự hủy open return request.
- Chỉ server quyết định số phí/cọc/refund/debt. Debt là ghi sổ, không tự thu.
- Rental CLOSED và refund hoàn tất là hai trạng thái độc lập.

## 4. Màn cần cho luồng trả kho

Thiết kế Web DESKTOP trước. Bảy workspace dưới đây không bắt buộc là bảy route mới;
có thể dùng tab trong rental detail và tái sử dụng component theo actor.

| Mã thiết kế | Actor / màn chính | Nội dung và hành động |
| --- | --- | --- |
| F3-C-RET-DETAIL | Customer / chi tiết yêu cầu trả kho | Lịch hẹn, status request, mốc thực nhận/inspection/closure/refund tách riêng; sửa/hủy chỉ PENDING; kết quả quyết toán đã có |
| F3-FS-RET-LIST | FS / danh sách được giao | Facility hiện tại, lịch hẹn, trạng thái, cờ cần rà soát; mở chi tiết; không xem yêu cầu không được assign |
| F3-FS-RET-DETAIL | FS / xử lý yêu cầu | Xác nhận lịch, ghi nhận thực nhận, xem attempt, bắt đầu/kiểm tra lại; đề xuất sửa giờ; không duyệt tiền |
| F3-FS-RET-INSPECT | FS / workspace biên bản | Bốn nhóm checklist động, issue/note/ảnh, tài sản còn lại, lưu nháp/hoàn tất, PASS/FAIL server trả, lịch sử attempts |
| F3-FM-RET-LIST | FM / hàng đợi facility | Status và phân công, cờ manual review; gán/đổi FS bằng modal dùng endpoint staff sẵn có |
| F3-FM-RET-DETAIL | FM / rà soát hồ sơ | Inspection/bằng chứng, actual-return, correction approvals, audit và điều kiện chuyển sang quyết toán |
| F3-FM-RET-SETTLE | FM / quyết toán và theo dõi hoàn tiền | Duyệt damage/unused-rent exception kèm lý do; review số liệu server; closure; lịch sử settlement revisions và confirmed refunds |

Tác vụ phụ dùng sheet/modal thay vì trang mới:

- Customer tạo/sửa lịch: date picker, slots server, lý do, cảnh báo báo trước 24 giờ,
  “Chờ xác nhận — chưa giữ lịch”; xác nhận hủy riêng.
- FM gán/đổi FS: nhân viên active thuộc facility và lý do.
- FS ghi nhận thực nhận: ngày giờ thực tế + timezone + lý do + xác nhận.
- FS đề xuất sửa giờ: giờ hiện tại/đề xuất, lý do, upload evidence.
- FS xử lý tài sản: disposition, người nhận/thời điểm/ảnh phù hợp.
- FM duyệt correction: trước/sau, bằng chứng, lý do quyết định.
- FM xác nhận refund đã chuyển: số tiền, allocation nếu contract yêu cầu, reference,
  bằng chứng và checkbox xác nhận thực tế. Không có nút “Hoàn tiền ngay”.

My Storage ngoài luồng trả kho: tái sử dụng màn list/detail; thêm Current/History,
payments, contracts, return section; guest dùng bản read-only. Cấu hình Admin/BOM
thuộc #139 nhưng thiết kế thành bộ riêng, không nhét vào FS/FM return workspace.

## 5. Kế hoạch triển khai theo đợt

### Đợt 0 — Chốt contract và màn

- Lập mapping endpoint → input schema → response DTO → actor → transition.
- Ghi nhận và giải quyết các gap ở mục 2 với backend owner; không tự đổi business.
- Duyệt bảy workspace và dialog, đúng bản desktop/ID; kiểm tra cả ảnh và HTML Stitch.
- Không thêm renewal, đổi/upgrade kho, identity document, khóa từ xa, payment gateway refund.

### Đợt 1 — API client và tương thích dữ liệu

- Sửa `rentals.mine(params)` → RentalPage; bổ sung payments, contracts, returns,
  guest rental reads, evidence/private PDF và config API còn thiếu.
- Dùng input contracts và bổ sung shared DTO response còn thiếu theo contract đã chốt.
- Cursor chuyển nguyên cặp `afterEndAt/afterId`; reset theo account/view. Queue trả kho
  dùng offset đúng API, không ép thành cursor.
- Tách query keys theo session/actor/facility/rental/request; cancel và xóa cache riêng
  tư khi logout/switch account/guest expiry. Không đưa token vào URL query hoặc localStorage.
- Version của request khác version inspection: dùng đúng expectedVersion tương ứng.
  Idempotency chỉ gửi ở endpoint hỗ trợ; không auto-retry mọi mutation.
- Đồng bộ web mock rental response mới; tránh để mock pass trong khi API thật lỗi.

### Đợt 2 — Customer và guest đọc dữ liệu

- My Storage current/history + load more; sửa nội dung “rental sau handover”.
- Rental detail: summary, payments/refunds, issued PDFs, timeline và return section.
- Tái sử dụng access-link/exchange/revoke; guest chỉ đọc đúng booking, expiry recovery.
- PDF authenticated blob, giữ private, revoke object URL khi không dùng.

### Đợt 3 — Lịch trả và phân công

- Customer tạo/sửa/hủy PENDING, slots loading/empty/error/conflict.
- FM queue/phân công; FS assigned queue/xác nhận; thông báo khi assignment đổi.
- Revalidate 409/422, tải detail/slots mới, giữ draft hợp lệ và giải thích khôi phục.
- Dùng facility context thực tế, không default facility đầu tiên cho mọi hành động.

### Đợt 4 — Thực nhận, inspection và evidence

- Workspace FS dùng checklist version snapshot và draft server.
- Ảnh tối đa 5, progress/error/retry; không báo đã lưu trước response thành công.
- Ghi giờ thực nhận, xử lý tài sản, PASS/FAIL/attempt mới, correction proposal.
- Re-fetch detail sau writes; ảnh riêng tư dùng endpoint đọc tương ứng,
  không lưu URL tạm thành dữ liệu nghiệp vụ vĩnh viễn.

### Đợt 5 — FM quyết toán, correction và refund

- Bật review/duyệt khi contract preview và điều kiện closure đã được thống nhất.
- Dùng số tiền string integer VND; trình bày cọc, phí, entitlement, paid refund,
  remaining refund và debt tách riêng; không lấy catalog giá hiện tại thay snapshot.
- Duyệt correction, hiển thị revisions; duyệt settlement và theo dõi closure từ server.
- Refund confirmation riêng, phải có completed-transfer reference/evidence;
  retry không tạo chuyển khoản mới, không đếm refund pending là tiền đã hoàn.

### Đợt 6 — Phần hỗ trợ đầy đủ của #139 và Mobile

- FM upload/issue hợp đồng ở luồng booking trước handover; read issued documents theo quyền.
- Admin checklist versions, facility return calendar và system-settings được cấp.
- BOM overdue rate/setting tài chính; dùng phiên bản và lịch sử. Không trùng form
  cấu hình đã có ở Flow 4; kiểm tra lại tại thời điểm tích hợp.
- Inbox Customer/FM với thông tin thật và trạng thái gửi thực tế.
- Mobile Expo: Customer rental/request và FS assigned queue/inspection dùng cùng client/contracts.
  Bỏ assumptions demo như tám ảnh hoặc quyền gửi yêu cầu đổi kho khỏi luồng API thật.
  Tách demo adapter khỏi API thật, không WebView và không thêm FM/Admin mobile ngoài scope.

## 6. Kiến trúc và nghiệm thu

- Route adapters mỏng; actor screens ở `modules`; domain hooks/forms ở feature rentals/returns;
  TanStack Query, React Hook Form + Zod tương thích phiên bản hiện có; không trộn schema
  của hai major Zod bằng cách ép `any`.
- Tái dùng shells, facility switcher, loading overlay/skeleton, dialog, upload, calendar UI.
  Calendar trả kho phải lấy slots riêng, không dùng danh sách ca check-in làm availability trả kho.
- Messages ở `*.messages.ts`, interfaces ở `*.types.ts`; không thêm thư viện khi stack đáp ứng.
- Validation/visibility phía UI chỉ hỗ trợ UX; backend luôn là quyết định cuối về quyền/trạng thái.

Nghiệm thu theo lát cắt hoạt động:

1. Current/history/cursor; owner khác 404; booking chưa handover không có rental.
2. Guest wrong/expired/revoked booking session; không rò cache/PDF; không có mutation return.
3. Customer request PENDING + sửa/hủy; dưới 24h/ngày nghỉ/config thiếu/slot conflict.
4. FM assign đúng facility; FS không được giao không thao tác; hai confirm xung đột.
5. Save/reload inspection, ảnh lỗi/ảnh thứ 6, serious FAIL/retry attempt, minor PASS,
   property unresolved block closure, actual receipt độc lập với PASS.
6. FM settle đúng quyền; số tiền/revisions server, closure atomic facts; refund độc lập,
   duplicate submit/network unknown outcome không tạo refund trùng.
7. Correction sau settle/refund, stale version 409, đổi role/facility/account giữa bước.
8. Admin/BOM config quyền riêng; issued PDF/handover gate và notifications.

Chạy type-check/lint/tests liên quan; API-backed E2E là nghiệm thu tích hợp,
mock E2E là bổ sung cho UI. Axe + keyboard + screenshots desktop/responsive web,
Expo emulator riêng cho mobile; không gọi emulation là thiết bị thật.

Demo nên có fixture liên kết sẵn: ACTIVE → PENDING → CONFIRMED → PASS chờ FM,
FAILED có ảnh/tài sản, CLOSED chờ refund, COMPLETED refund có chứng từ.
Không thêm nút đổi đồng hồ frontend để vượt validation API trong issue này.
