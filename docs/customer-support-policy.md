# Customer Support policy — #164

Ngày cập nhật: 24/10/2026. Chủ issue: Tkaz095.

**Trạng thái: APPROVED — 24/10/2026.** Người phụ trách xác nhận: “Bản policy tôi
duyệt, hãy làm các việc còn lại”. C01–C15, R1–R5, bảng quyền/trạng thái và thiết
kế đi kèm được dùng làm căn cứ hoàn thiện phần Support trong docs/db-diagram.md.
Đây là phê duyệt thiết kế cho #165/#166; chưa có Support runtime/schema/migration.

## 1. Phạm vi và căn cứ

- [#164 — policy, quyền và lifecycle](https://github.com/vlnguyen910/metastorage/issues/164):
  bảng quyền/trạng thái, năm category, notes/ảnh, severity, SLA, notifications,
  model ticket/message/attachment/audit và review privacy.
- [#165 — customer APIs](https://github.com/vlnguyen910/metastorage/issues/165):
  tạo/list/detail/public replies, ảnh private, ownership và idempotency.
- [#166 — operations APIs](https://github.com/vlnguyen910/metastorage/issues/166):
  queue, phân công, báo cáo/duyệt, đóng/mở lại, audit và notifications.
- Các issue cũ #71–#74/#40 là lịch sử, trạng thái Closed không chứng minh policy
  hay endpoint đã được triển khai.
- Đối chiếu ban đầu tại feature HEAD 7f65be8 và origin/dev c8369ee. PR tài liệu
  được tách từ dev dceb0a5; các source role/task/outbox/context liên quan không
  đổi giữa hai snapshot dev này. Diff PR chỉ chứa ba tài liệu Support.
- Đã đọc docs/facility-staff-operations-policy.md,
  docs/flow5-task-assignment-api.md, docs/db-diagram.md, schema facility_tasks,
  facility_assignments, bookings, rentals, users và notification_outbox.

### BOM là vai trò nào?

BOM là Business Operations Manager — **Quản lý vận hành kinh doanh**.
Constant UserRole.BUSINESS_OPERATIONS_MANAGER trong packages/contracts/src/users.ts
có giá trị runtime **BUSINESS_OPERATION_MANAGER** (không tự đổi tên giá trị).
Tên tiếng Việt được xác nhận trong
apps/web/src/features/administration/admin.messages.ts.

Vai trò này quản lý chính sách giá/cọc/phí và báo cáo nhiều cơ sở; xem
docs/flow-4-pricing-api.md, docs/flow-4-reports-api.md và pricing.routes.ts.
BOM không phải FM. FM/FS dùng phân công cơ sở đang active; BOM hiện không dùng
membership FM/FS để xác định phạm vi. Quyền Support của BOM vẫn phải theo bảng
policy, không tự kế thừa mọi quyền tài chính thành quyền toàn bộ ticket.

Khi chuẩn bị PR, đã dựng index GitNexus riêng cho repository metastorage trên
dev dceb0a5. Impact upstream của ba file chỉ tới các tài liệu liên quan, risk
LOW và không có execution process bị ảnh hưởng trong kết quả phân tích diff.
Đối chiếu thêm source theo các đường dẫn issue chỉ định; graph không thay thế
source review hoặc chứng minh một API Support đã tồn tại.

## 2. Các quyết định người phụ trách đã xác nhận

| ID | Quyết định |
| --- | --- |
| C01 | Chỉ CUSTOMER đã đăng nhập; không hỗ trợ guest, kể cả phiên magic-link booking |
| C02 | Ticket bắt buộc gắn booking thuộc customer; facility và context lấy từ DB, không tin actor/facility do client chỉ định |
| C03 | UNIT, LOCK, ACCESS_CODE, STORED_ITEMS chỉ được gửi sau khi khách thực sự nhận kho và phát hiện vấn đề |
| C04 | Bốn nhóm về kho: FM đúng chi nhánh tiếp nhận và gán FS thủ công; không dùng phương án FM tự xử lý thay phân công |
| C05 | Khi FM gán FS, ticket chuyển IN_PROGRESS ngay; FS xử lý, gửi báo cáo, FM duyệt báo cáo về kho |
| C06 | PAYMENT do BOM phụ trách; được tiếp nhận cả pending/failed hoặc booking đã hủy nếu booking thuộc customer |
| C07 | FM/FS được xem PAYMENT trong chi nhánh; FS không xem ticket chưa được giao; đổi người thì FS cũ mất quyền xem ticket |
| C08 | FM/BOM đúng phạm vi được đóng sau hỗ trợ; customer được đóng ticket của mình khi không cần hỗ trợ nữa |
| C09 | Chỉ FM/BOM được mở lại; customer và FS không có quyền này |
| C10 | Customer đóng ticket thì FS dừng ngay công việc hỗ trợ đó; không tính đây là FS hoàn tất thành công |
| C11 | Chỉ BOM/FM được viết và đọc ghi chú nội bộ theo phạm vi quyền ticket/chi nhánh; FS/customer không được đọc/ghi |
| C12 | File đính kèm chỉ nhận ảnh, giới hạn 10 ảnh; phạm vi đếm/định dạng/dung lượng được duyệt trong R2 |
| C13 | Có mức độ ưu tiên; thông báo FM/FS/BOM ở kênh thông báo của role tương ứng |
| C14 | Customer tự động nhận email sau gửi thành công; trong 12 giờ có FS được giao tới xử lý vấn đề về kho |
| C15 | Không có trạng thái chờ khách bổ sung; thông tin giao dịch nằm trong form/email theo mô tả người phụ trách |

C14 thay cách diễn giải cũ chỉ hẹn liên hệ trong 12 giờ. Đây là thời hạn bố trí FS
tới xử lý, không phải cam kết mọi vấn đề được giải quyết xong trong 12 giờ.
Đóng/mở lại ticket không tự đổi occupancy, thanh toán, hoàn tiền, bàn giao,
hợp đồng, bảo trì hoặc reset mã truy cập. Không mở rộng PIN/NFC/IoT.

## 3. Quy tắc bổ sung đã duyệt: R1–R5

Các lựa chọn này được trình thành một gói và đã được người phụ trách duyệt cùng
policy ngày 24/10/2026. C01–C15 cùng R1–R5 là policy có hiệu lực cho #165/#166.

| ID | Quy tắc đã duyệt |
| --- | --- |
| R1 — phạm vi quyền | BOM xử lý PAYMENT của mọi chi nhánh theo vai trò vận hành toàn hệ thống; không mặc định quản lý bốn nhóm về kho. FM xem PAYMENT tại cơ sở nhưng không quyết định tài chính. Để FS xem PAYMENT mà vẫn tuân C07, FM được giao FS hỗ trợ thông tin tại chỗ trên ticket PAYMENT; BOM vẫn xử lý/đóng/mở lại phần PAYMENT. Không lấy booking.assignedStaffId làm quyền xem Support. Admin không có quyền nghiệp vụ Support tự động |
| R2 — ảnh và trao đổi | Tối đa 10 ảnh trên toàn ticket, kể cả các lần trao đổi/báo cáo; JPEG/PNG/WebP, 5 MiB/ảnh. Ảnh private, theo quyền message chứa ảnh. Message/report append-only; không có API sửa/xóa MVP. Không bắt buộc ảnh cho mọi ticket |
| R3 — trạng thái/kết quả | Dùng OPEN → IN_PROGRESS → CLOSED. FS báo cáo không đổi trạng thái ticket; FM duyệt báo cáo mới nhất của phân công hiện tại. Với nhóm về kho, duyệt và đóng có thể là một transaction. Mở lại về OPEN, bỏ phân công hiện tại để FM giao lại, không tự khởi động công việc cũ. Đổi FS trong lúc IN_PROGRESS giữ trạng thái nhưng báo cáo cũ không được dùng làm kết quả của người mới. Lý do bắt buộc khi đổi người, đóng, mở lại; nội dung giải quyết được công khai cho customer |
| R4 — ưu tiên/12 giờ | NORMAL/HIGH, FM phân loại nhóm về kho và BOM phân loại PAYMENT; HIGH lên trước trong hàng đợi, cùng mốc tối đa 12 giờ. Tính 12 giờ liên tục từ lúc server tạo ticket thành công, không reset khi đổi người. Cần lưu riêng lúc giao và lúc FS thực sự tới/bắt đầu xử lý; giao việc đơn thuần chưa chứng minh đáp ứng C14. PAYMENT không bắt buộc FS tới: BOM bắt đầu liên hệ/xử lý trong 12 giờ. Theo dõi thủ công qua queue quá hạn; chưa tự chuyển cấp, auto-dispatch, realtime mới hoặc SLA engine |
| R5 — context/lịch sử/kênh | Nhóm về kho phải có rental chứng minh bàn giao; chỉ tạo mới khi rental chưa đóng, vẫn đọc lịch sử sau đóng. PAYMENT không bắt buộc có transaction thành công hoặc paymentId. Không mở thêm luồng claim/đổi chủ booking; owner theo userId đã lưu. Customer nhận email xác nhận và public updates; vận hành nhận inbox riêng từng user/role, không broadcast mọi role. Event/recipient chi tiết tại mục 7; ảnh/notes không được gửi ra email trái quyền |

C07 vẫn được giữ: FS chỉ thấy PAYMENT khi được giao ticket đó. R1 giải quyết
điểm giao nhau giữa “FS xem PAYMENT trong chi nhánh” và “FS không xem ticket chưa
giao”; R1 đã duyệt chỉ cấp quyền theo phân công hiện tại, không mở quyền xem
mọi PAYMENT cùng cơ sở.
R4 phân biệt thời điểm assign với thời điểm FS có mặt/bắt đầu; không dùng một
timestamp để tuyên bố đã đến xử lý. Nếu khách đóng trước hạn, lưu đóng do khách
và ngừng tính công việc đang chờ; không ghi nhận đã xử lý thành công.
MVP không có action chuyển cấp sang role khác; FM/BOM theo dõi queue quá hạn và
xử lý thủ công trong đúng nhóm quyền. Thêm escalation workflow là follow-up,
không suy ra quyền BOM xử lý bốn nhóm về kho từ việc ticket quá hạn.

## 4. Năm nhóm và context

| Category | Người nhận | Context/input/outcome minh họa |
| --- | --- | --- |
| UNIT | FM cơ sở → FS | Sau bàn giao, khách báo thấm nước trong kho đã nhận; server nối rental → physicalUnitId → facility của booking, tiếp nhận đúng cơ sở |
| LOCK | FM cơ sở → FS | Khóa hỏng ở ô kho của khách sau nhận; ảnh tùy chọn. Không tự tạo quyền mở khóa/chìa mới khi chỉ tạo hoặc đóng ticket |
| ACCESS_CODE | FM cơ sở → FS | Khách báo không vào được kho đã nhận. Không ghi raw mã bí mật vào message/email; Support không tự reset mã |
| STORED_ITEMS | FM cơ sở → FS | Khách báo đồ trong kho đã nhận bị ảnh hưởng; ảnh minh họa tùy chọn, không tự hứa bồi thường |
| PAYMENT | BOM | Booking của khách có vấn đề giao dịch pending/failed/đã hủy; paymentId tùy chọn, nếu có phải thuộc booking. Ảnh biên lai không tự xác nhận giao dịch thành công |

Điều kiện C03 kiểm tra bằng bằng chứng bàn giao/rental đã tồn tại cho đúng
booking và ô kho, không chỉ lấy ngày bắt đầu dự kiến hoặc payment SUCCESS làm
bằng chứng đã nhận. Không nhận kho của customer khác dù biết booking/unit ID.
R5 đã duyệt: không tạo mới nhóm về kho sau khi rental đóng; lịch sử ticket cũ
vẫn được đọc theo quyền hiện tại.

## 5. Bảng quyền đã duyệt (C01–C15 và R1–R5)

Tài khoản phải ACTIVE. FM/FS cần membership active, còn hạn, đúng role và facility.
BOM dùng quyền role đã xác minh; phạm vi Support theo R1 đã duyệt.

| Thao tác | Customer | FM | FS | BOM | Admin |
| --- | --- | --- | --- | --- | --- |
| Tạo | Booking của mình, context C03/C06 | Không tạo hộ (R1) | Không | Không | Không |
| Đọc public ticket/ảnh | Ticket của mình | Ticket đúng cơ sở, kể cả PAYMENT | Chỉ ticket hiện được giao, cùng cơ sở; gồm PAYMENT theo R1 | PAYMENT toàn hệ thống theo R1 | Không tự có quyền (R1) |
| Public reply/ảnh | Ticket đang mở của mình (R2/R3) | Theo phạm vi cơ sở | Được giao và ticket mở; không quyết định tài chính | PAYMENT đang mở | Không |
| Ghi/đọc INTERNAL_NOTE | Không | Đúng cơ sở | Không, kể cả note do người khác gửi về task | PAYMENT theo phạm vi R1 | Không |
| Assign/reassign | Không | FS hợp lệ cùng cơ sở; PAYMENT theo R1 | Không | Không tự giao việc tại cơ sở (R1) | Không |
| Báo cáo thực hiện | Không | Đọc/duyệt nhóm về kho | Phân công hiện tại, ticket IN_PROGRESS | Xử lý PAYMENT theo R1 | Không |
| Duyệt báo cáo/đóng đã xử lý | Không | Bốn nhóm về kho | Không | PAYMENT | Không |
| Đóng vì không cần nữa | Ticket của mình | Không đóng thay lý do của khách | Không | Không đóng thay lý do của khách | Không |
| Mở lại | Không | Bốn nhóm về kho đúng cơ sở | Không | PAYMENT | Không |
| Đổi ưu tiên | Không | Bốn nhóm về kho | Không | PAYMENT | Không |

Sau reassign, FS cũ mất quyền đọc cả public history, báo cáo cũ của mình và URL
ảnh. Audit vẫn giữ tác giả cũ cho người còn quyền. FS hiện tại có thể xem lịch sử
public/report cần xử lý nhưng không được xem INTERNAL_NOTE.
Quyền xem PAYMENT không cấp quyền refund/xác nhận thanh toán. Mỗi thao tác domain
vẫn kiểm tra permission riêng của API thanh toán.

## 6. Bảng trạng thái Support đã duyệt (R3)

| Hành động | Trước → sau | Actor | Điều kiện/kết quả |
| --- | --- | --- | --- |
| Tạo | — → OPEN | Customer | Ownership/context hợp lệ; message đầu và audit cùng transaction |
| Giao FS | OPEN → IN_PROGRESS | FM | FS active, membership cùng cơ sở; lưu actor/thời điểm/phân công; đúng C05 |
| Đổi FS | IN_PROGRESS → IN_PROGRESS | FM | Version đúng; lý do bắt buộc; FS cũ mất quyền ngay; giữ toàn bộ history |
| Bắt đầu PAYMENT | OPEN → IN_PROGRESS | BOM | Quyền PAYMENT; lưu lần bắt đầu xử lý, không thay payment thực tế |
| Public reply/note | Giữ nguyên | Theo mục 5 | Public và internal DTO riêng; không có WAITING_CUSTOMER |
| FS bắt đầu/tới xử lý | Giữ IN_PROGRESS | FS hiện được giao | Ghi thời điểm tác nghiệp riêng để kiểm tra C14; không coi assign là đã tới |
| FS gửi report | Giữ IN_PROGRESS | FS hiện được giao | Append report; không tự đóng; đánh dấu report mới nhất chưa được FM duyệt |
| FM duyệt report | IN_PROGRESS → CLOSED cho nhóm về kho | FM | Report mới nhất của phân công hiện tại; lưu FM/time/nội dung giải quyết và lý do đóng; atomic |
| BOM xử lý xong | IN_PROGRESS → CLOSED | BOM | Có kết quả public và lý do; không chờ FS/khách duyệt |
| Customer không cần | OPEN/IN_PROGRESS → CLOSED | Owner | Lý do đóng theo R3; FS dừng việc; không chấm report/task là hoàn tất |
| Mở lại | CLOSED → OPEN | FM/BOM đúng nhóm | Lý do bắt buộc; bỏ phân công hiện tại theo R3, cần FM giao lại |
| Đổi mức ưu tiên | Giữ trạng thái mở | FM/BOM đúng nhóm | NORMAL/HIGH theo R4, audit lý do |

Mọi mutation dùng expectedVersion, transaction và audit; request stale nhận
conflict. Closure và report cạnh tranh phải serialize: nếu khách đóng trước,
report mới bị từ chối; nếu report lưu trước, closure giữ report nhưng không tự
duyệt. Retry không tạo thêm ticket/event và không gửi email trùng.

## 7. Thông báo và thời hạn

**Đã chốt:** customer nhận email tự động; FM/FS/BOM nhận thông báo qua kênh của
role tương ứng. Ma trận sau là contract thông báo đã duyệt trong R5.

| Sự kiện | Customer (EMAIL) | Vận hành (IN_APP, đúng user/role) |
| --- | --- | --- |
| Tạo nhóm về kho | Xác nhận tiếp nhận + mã ticket + hẹn FS trong 12 giờ | FM active của đúng cơ sở |
| Tạo PAYMENT | Xác nhận tiếp nhận; lời hẹn BOM xử lý theo R4 | BOM active |
| Giao FS | Thông tin cập nhật public nếu có | FS mới; không gửi cả chi nhánh |
| Đổi FS | Cập nhật public tối thiểu | FS mới; FS cũ chỉ nhận thu hồi, không chứa nội dung ticket |
| FS report | Không gửi report nội bộ/ghi chú tự động cho customer | FM đúng cơ sở |
| Public reply | Email public khi vận hành trả lời | Customer trả lời thì gửi người phụ trách hiện tại và FM/BOM đúng nhóm |
| INTERNAL_NOTE | Không gửi | Chỉ người có quyền note BOM/FM; không gửi FS |
| Đóng/mở lại | Email trạng thái và lý do public | FM/BOM phụ trách, FS liên quan; vẫn kiểm tra quyền khi mở |
| Đổi ưu tiên | Không tự gửi email riêng cho thay đổi nội bộ | FM/BOM phụ trách và FS đang được giao; không broadcast role |

Mẫu email cho vấn đề kho, phản ánh quyết định mới nhất:

> Cảm ơn bạn đã gửi phiếu hỗ trợ. Chúng tôi đã tiếp nhận yêu cầu và sẽ phân công nhân viên đến xử lý trong vòng 12 giờ.

Không hứa FS tới cho PAYMENT nếu chỉ cần BOM kiểm tra giao dịch. Mẫu PAYMENT
theo R4 đã duyệt: cảm ơn/xác nhận và hẹn người phụ trách liên hệ, bắt đầu xử lý
trong 12 giờ. Không hứa đã giải quyết xong trong thời gian này.

Lưu event cùng transaction; dispatch sau commit, dùng outbox/retry hiện có.
Dedupe theo ticket + event/version + recipient + channel. Hỏng email không rollback
ticket đã tạo. Không gửi internal notes hoặc private URLs thẳng vào email public.
Inbox phải xét lại quyền hiện tại, không chỉ tin recipient snapshot lúc tạo.

## 8. Model và tương thích với source

Model chi tiết tại [customer-support-model.md](customer-support-model.md); thiết
kế canonical tại [db-diagram.md — Customer Support](db-diagram.md#customer-support-approved-design-2026-10-24-164).
Các bảng thiết kế: support_tickets, support_messages, support_attachments,
support_work_reports, support_audit, support_idempotency; notification_outbox
được mở rộng cho Support trong #166.
Audit chứa assignment history; không cần một bảng assignment history trùng dữ liệu.

Công việc FS ở đây là công việc của ticket Support. **Model đã thống nhất:** không tự
tạo facility_task hoặc thay booking.assignedStaffId. Tái sử dụng membership,
cách kiểm tra assignee, báo cáo và FM duyệt; không đồng nhất hai lifecycle.
facility_tasks hiện thiếu trạng thái dừng/hủy và bắt đầu khác C05; ép dùng trực
tiếp sẽ thay đổi Flow 5 không cần thiết. Nếu UI task chung cần hiển thị Support,
query ghép công việc Support với task hiện tại sau, không mở quyền check-in.

Source hiện tại còn các khoảng trống, chưa được sửa trong #164:

- /notifications mới allow CUSTOMER/FM; chưa có inbox Support cho FS/BOM.
- notification_outbox yêu cầu recipientEmail và chưa có channel; không thể dùng
  nguyên trạng rồi gửi email cho vận hành thay vì inbox.
- Staff websocket hiện chỉ cho booking task, ephemeral một instance; không phải
  durable Support inbox. MVP reuse inbox/outbox, không thêm realtime.
- origin/dev c8369ee có rentalTermVersion ở outbox; khi #166 mở rộng phải giữ
  cột và semantics hiện có, không ghi đè theo schema nhánh feature cũ.
- Storage adapter hiện có cần xác minh private image upload/read; không coi
  public Cloudinary URL là bằng chứng đã có authorization.

## 9. Ma trận review nghiệp vụ

Đây là review input/state/outcome, chưa viết runtime tests.

| Case | Kết quả theo policy đã duyệt |
| --- | --- |
| Guest có magic link hợp lệ | Không dùng Support (C01) |
| Customer tạo với booking của người khác/giả facility | Từ chối; owner/facility do server lấy (C02) |
| Booking mới xác nhận, chưa bàn giao, báo khóa | Không nhận nhóm về kho (C03) |
| Đã nhận đúng unit, phát hiện hỏng khóa | OPEN gửi FM cơ sở; FM giao FS → IN_PROGRESS (C03–C05) |
| Rental đã đóng tạo mới UNIT | Theo R5: không tạo mới; history vẫn đọc được |
| Payment pending/failed/booking đã hủy | Cho phép owner gửi PAYMENT; BOM xử lý (C06) |
| FM xem ticket PAYMENT cơ sở khác | Từ chối (C07) |
| FS chưa được giao, kể cả PAYMENT cùng cơ sở | Từ chối (C07 và xác nhận mới nhất) |
| Reassign A → B, A dùng URL report/ảnh cũ | A mất quyền, B được quyền hiện tại, audit tác giả A giữ nguyên (C07) |
| FS báo cáo | Ticket giữ IN_PROGRESS; FM duyệt, không tự hoàn tất (C05/R3) |
| Customer đóng khi FS làm | FS dừng ngay; report chưa duyệt không coi thành công (C10) |
| Customer/FS/Admin mở lại | Từ chối; chỉ FM/BOM (C09) |
| FS/customer gọi API note hoặc ảnh của note | Không thấy dữ liệu (C11) |
| 10 ảnh hợp lệ, ảnh thứ 11, PDF giả ảnh | Theo C12/R2: nhận tối đa 10, từ chối vượt giới hạn và file không phải ảnh |
| Hai FM cùng gán/đóng cùng version | Chỉ một version hợp lệ; request còn lại conflict (R3) |
| Retry tạo ticket/email | Một ticket và một logical email; không mất ảnh đã được commit |
| Email provider lỗi | Ticket và audit vẫn tồn tại; outbox retry, không hứa email đã gửi |
| Assign lúc 1 giờ, FS bắt đầu lúc 13 giờ | Không đánh đồng assign với đã tới xử lý; xem R4 về mốc 12 giờ |
| Khóa/vô hiệu hóa actor hoặc hết hạn membership | Thu hồi quyền hiện tại; giữ lịch sử |
| Đóng ticket | Không tự đổi unit/payment/rental/handover/access code |
| Không có FM hợp lệ tại cơ sở | Không tự chuyển quyền sang Admin/BOM; ghi nhận queue tồn và thiếu người nhận để vận hành xử lý |

## 10. Đầu ra và điều kiện hoàn tất #164

- [x] Đọc lại #164/#165/#166; giữ đúng decision-only scope.
- [x] Tổng hợp quyết định mới nhất; loại cách hiểu cũ về thời điểm tạo/12 giờ.
- [x] Có bảng category/context, permission/state và review cases.
- [x] Hoàn thiện model và đánh giá reuse membership/tasks/outbox.
- [x] Gom các lựa chọn R1–R5 và nhận phê duyệt policy.
- [x] Người phụ trách duyệt policy; bảng quyền/trạng thái và model được thống nhất theo policy.
- [x] Sau duyệt policy/model, cập nhật phần Support trong docs/db-diagram.md.
- [x] Chốt trạng thái policy APPROVED; bảng bàn giao ở mục 10 của model cho #165 trước #166.
- [x] Kiểm tra cuối: whitespace, liên kết, đồng bộ model/diagram và các review scenarios.

Kết quả kiểm chứng ngày 24/10/2026: git diff --check sạch; các tài liệu mới được
kiểm tra cả trước và sau staging; liên kết file/anchor và code fences hợp lệ.
Đã review đủ năm category cùng các case ownership, khác chi nhánh, thu hồi
assignee, private notes/ảnh, report/close, deadline và notification retry.
GitNexus impact/detect-changes chạy trên index riêng cho đúng checkout; diff
chỉ gồm ba tài liệu Markdown, không có thay đổi runtime. Index toàn repo có
giới hạn process discovery; không dùng kết quả để tuyên bố đã audit mọi flow.

#164 chỉ kiểm tra tài liệu và whitespace. Không chạy DB tests, migration, seed,
API, frontend hoặc gửi email thật cho bước decision này. Không tự đóng issue,
commit/push hoặc ghi comment lên GitHub khi chưa được yêu cầu.

## 11. Nhật ký quyết định

| Ngày | Nội dung có hiệu lực |
| --- | --- |
| 24/10/2026 | Ticket bắt buộc booking, chỉ customer đăng nhập, BOM phụ trách PAYMENT |
| 24/10/2026 | Nhận PAYMENT pending/failed/booking đã hủy sau khi giải thích ticket là yêu cầu hỗ trợ |
| 24/10/2026 | FM giao FS, FS báo cáo, FM duyệt; customer được đóng, FS dừng; chỉ FM/BOM reopen |
| 24/10/2026 | FM/FS xem PAYMENT theo chi nhánh; FS cũ mất quyền sau đổi người; chỉ BOM/FM note |
| 24/10/2026 | Chỉ ảnh; email xác nhận tự động, mẫu ban đầu hẹn liên hệ 12 giờ |
| 24/10/2026 | Xác nhận mới nhất: tạo nhóm về kho sau nhận kho; gán FS chuyển ticket IN_PROGRESS; FS không xem ticket chưa giao; tối đa 10 ảnh |
| 24/10/2026 | Theo ưu tiên, vận hành nhận thông báo ở kênh role; trong 12 giờ có FS được giao tới xử lý, thay diễn giải chỉ hẹn liên hệ |
| 24/10/2026 | Người phụ trách xác nhận “Bản policy tôi duyệt, hãy làm các việc còn lại”: duyệt gói R1–R5; hoàn thiện model và đưa thiết kế vào canonical diagram, bàn giao #165/#166 |
