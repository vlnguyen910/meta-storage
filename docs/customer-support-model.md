# Customer Support — model và bàn giao #164 → #165/#166

Ngày: 24/10/2026. **Trạng thái: ALIGNED WITH APPROVED POLICY.**

Người phụ trách đã duyệt policy và yêu cầu hoàn tất phần còn lại ngày 24/10/2026.
Model này thống nhất theo C01–C15 và R1–R5 đã duyệt trong
[customer-support-policy.md](customer-support-policy.md), được đưa vào
[canonical diagram](db-diagram.md#customer-support-approved-design-2026-10-24-164).
Đây là thiết kế đã bàn giao cho #165/#166, chưa phải schema/migration/runtime.

## 1. Nguồn và quy tắc thiết kế

Đã đọc docs/db-diagram.md trước khi thiết kế. Phần canonical Support được cập
nhật sau khi người phụ trách duyệt policy và yêu cầu hoàn tất tài liệu, theo
[#164](https://github.com/vlnguyen910/metastorage/issues/164).
Không tạo Support enum/schema/migration trong #164; không seed/reset DB.

Đối chiếu ban đầu tại feature HEAD 7f65be8 và origin/dev c8369ee. Nhánh PR tài
liệu tách từ dev dceb0a5; các source role/task/outbox/context dưới đây không đổi
giữa hai snapshot dev đã kiểm tra:

| Nguồn hiện có | Điều sử dụng / giới hạn |
| --- | --- |
| contracts/users.ts, database/schema/users.ts | CUSTOMER, FACILITY_MANAGER, FACILITY_STAFF, BUSINESS_OPERATION_MANAGER, SYSTEM_ADMIN đã có; không tạo thêm role BOM |
| bookings.ts | userId có thể null do guest; chỉ customer đăng nhập có ownership thật mới dùng Support. facilityId do server lấy; assignedStaffId của booking không phải phân công Support |
| rentals.ts | bookingId unique, facilityId, physicalUnitId, createdAt là căn cứ nối sau bàn giao; không lấy booking.start date làm bằng chứng đã nhận kho |
| facility-assignments.ts | FM/FS một active facility, kiểm tra role/account active/membership còn hạn; không gán membership FACILITY_MANAGER cho BOM để vượt quyền |
| facility-tasks.ts | Task có ASSIGNED/IN_PROGRESS/AWAITING_APPROVAL/COMPLETED; chưa có stopped/cancelled; không thể dùng trực tiếp để thể hiện customer đóng rồi FS dừng |
| notification-outbox.ts | booking/facility bắt buộc, recipientEmail bắt buộc, unique eventKey/recipientKey; dev mới có rentalTermVersion cần giữ |
| lifecycle-notifications.routes.ts | Inbox hiện allow CUSTOMER/FM; mở cho FS/BOM và lọc Support là việc #166, chưa có trong runtime |
| notifications.service.ts | Websocket STAFF_TASK_ASSIGNED thuộc booking, ephemeral; không phải durable Support notifications |

BOM là quản lý vận hành kinh doanh, runtime role BUSINESS_OPERATION_MANAGER;
source financial permissions đã có ở pricing/payments/reports. Quyền Support
global PAYMENT trong R1 đã được duyệt, không mặc định cho toàn bộ
category từ những quyền financial khác.

## 2. Quan hệ tổng thể

| Quan hệ | Ý nghĩa |
| --- | --- |
| booking → nhiều support_tickets | Một booking có thể phát sinh nhiều yêu cầu; không giới hạn một ticket/booking |
| rental/unit/payment → ticket context tùy category | Server kiểm tra cùng booking/facility; PAYMENT không bắt buộc có rental hoặc payment đã thành công |
| ticket → nhiều support_messages | Nội dung đầu, public replies, internal notes, nội dung report |
| message → nhiều support_attachments | Ảnh theo quyền message; tổng ảnh đã gắn trên ticket không vượt 10 theo R2 |
| ticket → nhiều support_work_reports | Lưu báo cáo FS và lần FM chấp nhận; không sửa nội dung report cũ |
| ticket → nhiều support_audit | Lịch sử tạo, phân công, tiến độ, ưu tiên, report, duyệt, đóng/mở lại |
| ticket event → nhiều notification_outbox rows | Mỗi recipient/channel có logical delivery riêng, commit cùng nghiệp vụ |
| actor + operation + key → support_idempotency | Retry không tạo thêm ticket/message/report/email |

Support có phân công hiện tại trên ticket; assignment history nằm trong audit.
Không thêm bảng assignment trùng mục đích. Không tạo facility_task tự động;
item việc của FS là ticket Support được giao. UI có thể tổng hợp nguồn Support
và facility tasks qua contract riêng ở follow-up, không có UI implementation ở #164–#166.

## 3. support_tickets

Các tên dưới đây thuộc thiết kế canonical; chưa tạo enum runtime.

| Cột thiết kế | Kiểu / ràng buộc | Ý nghĩa |
| --- | --- | --- |
| id | UUID PK | ID server |
| booking_id | UUID NOT NULL FK bookings RESTRICT | Context bắt buộc |
| owner_user_id | UUID NOT NULL FK users RESTRICT | Customer đã xác thực; kiểm chứng với booking.userId |
| facility_id | UUID NOT NULL FK facilities RESTRICT | Snapshot server từ booking; không cho client chuyển cơ sở |
| rental_id | UUID nullable FK rentals RESTRICT | Nhóm về kho cần rental của booking; PAYMENT có thể null |
| storage_unit_id | UUID nullable FK storage_units RESTRICT | Lấy physicalUnitId của rental đã nhận, không nhập unit tùy ý |
| payment_id | UUID nullable FK payments RESTRICT | Chỉ nếu cần đối chiếu giao dịch; phải cùng booking |
| category | UNIT/LOCK/ACCESS_CODE/STORED_ITEMS/PAYMENT | Theo policy |
| subject | varchar, giới hạn kỹ thuật 200 | Tóm tắt; nội dung đầu trong message |
| status | OPEN/IN_PROGRESS/CLOSED, default OPEN | R3; không WAITING_CUSTOMER hoặc ASSIGNED của facility_tasks |
| priority | NORMAL/HIGH, default NORMAL | R4; manager/BOM thay đổi theo quyền |
| assigned_staff_id | UUID nullable FK users RESTRICT | Support assignee, không sửa booking.assignedStaffId |
| assigned_by, assigned_at | UUID FK users / timestamptz nullable | Phân công hiện tại |
| assignment_version | integer NOT NULL default 0, >= 0 | Tăng khi giao/đổi/bỏ phân công, tách với ticket version |
| version | integer NOT NULL default 0, >= 0 | Optimistic concurrency của mutation |
| first_assigned_at | timestamptz nullable | Lần đầu FM giao; không reset khi reassign |
| first_onsite_started_at | timestamptz nullable | Lần đầu FS ghi nhận đã tới/bắt đầu xử lý; khác first_assigned_at |
| first_bom_response_at | timestamptz nullable | PAYMENT: lần BOM phản hồi/bắt đầu xử lý thực tế theo R4 |
| action_due_at | timestamptz NOT NULL | R4: created_at + 12 giờ; không tự reset |
| closed_by, closed_at | UUID FK users / timestamptz nullable | Người đóng và thời điểm |
| closure_kind | RESOLVED/CUSTOMER_WITHDREW nullable | Phân biệt xử lý xong và khách không cần nữa |
| close_reason | text nullable | R3 bắt buộc khi đóng; không chứa internal note/secret |
| created_at, updated_at | timestamptz NOT NULL | Server time |

Ràng buộc: CLOSED phải có bộ trường close đầy đủ; trạng thái mở không giữ close
metadata hiện tại. Reopen giữ lần đóng trước trong audit, xóa current closure
và current assignee, tăng assignment_version/version. Reassign không đổi owner,
facility/context hoặc xóa report.

Application transaction kiểm tra booking/rental/unit/payment linkage dưới khóa
dòng; các FK đơn thuần không chứng minh tất cả cùng context. Bổ sung composite FK
khi schema đích có unique pair phù hợp; không hứa đã có DB constraint chưa sinh.

Không dùng assignee làm quyền tài chính. Nhóm về kho IN_PROGRESS phải có assignee;
PAYMENT có thể IN_PROGRESS do BOM bắt đầu dù không giao FS. R1 đã duyệt cho FM
giao FS hỗ trợ thông tin trên PAYMENT; thao tác tài chính/đóng ticket vẫn của BOM.

Index dự kiến: (owner_user_id, created_at DESC, id DESC),
(facility_id, category, status, created_at DESC, id DESC),
(assigned_staff_id, status, created_at DESC, id DESC),
(category, status, priority, action_due_at, id).
Chọn lại index bằng query thực tế khi #165/#166 triển khai; không tối ưu giả định.

## 4. support_messages và support_work_reports

### Message

Cột: id UUID PK, ticket_id UUID FK RESTRICT, author_id UUID FK users RESTRICT,
kind PUBLIC_REPLY/INTERNAL_NOTE/STAFF_REPORT, content text, created_at timestamptz.
Giới hạn content kỹ thuật 1..5000 ký tự trimmed.

Message PUBLIC_REPLY đầu tiên lưu cùng ticket và audit. STAFF_REPORT chỉ là nội
dung báo cáo cho người vận hành có quyền; customer không tự nhìn thấy report
hoặc ảnh của report. Public kết quả giải quyết được tạo riêng khi FM/BOM đóng.
INTERNAL_NOTE chỉ BOM/FM ghi/đọc theo policy, không dùng note để FS gửi báo cáo.

Index (ticket_id, created_at, id) cho cursor ổn định; query customer lọc
PUBLIC_REPLY ngay trong repository/DTO. Không trả tất cả rồi nhờ UI lọc.
Message append-only theo R2; actor và createdAt không do client quyết định.

### Work report

Cột: id UUID PK, ticket_id UUID FK RESTRICT, message_id UUID UNIQUE FK messages,
assignment_version integer, submitted_by UUID FK users, submitted_at timestamptz,
accepted_by UUID FK users nullable, accepted_at timestamptz nullable.

Content nằm ở message STAFF_REPORT; không sao chép sang cột text khác.
Unique (ticket_id, id) trên message và composite FK (ticket_id, message_id)
bảo đảm report cùng ticket. accepted_by/accepted_at cùng null hoặc cùng
có giá trị. Partial unique (ticket_id, assignment_version) khi accepted_at
khác null: không chấp nhận hai kết quả khác nhau của một lần phân công.

FS chỉ report khi ticket IN_PROGRESS và là assignee hiện tại, membership hợp lệ.
FM duyệt report mới nhất của assignment_version hiện tại, không duyệt report
của người cũ hoặc report đã bị superseded. Duyệt, ghi actor/time, public kết quả,
đóng ticket nhóm về kho, audit và outbox trong cùng transaction.
PAYMENT vẫn do BOM quyết định kết quả; report FS theo R1 nếu có không thay thế
quyền BOM đóng PAYMENT.

## 5. support_attachments: chỉ ảnh, tối đa 10

Cột: id UUID PK, ticket_id UUID NOT NULL FK RESTRICT, message_id UUID NOT NULL
FK RESTRICT, uploaded_by UUID FK users RESTRICT, object_key text UNIQUE,
original_filename text, mime_type text, byte_size integer, checksum text,
created_at timestamptz. Composite FK (ticket_id, message_id) tham chiếu message
theo unique (ticket_id, id), không ghép ảnh với message khác ticket.
Không lưu public URL hoặc raw bytes trong DTO thường.

R2 đã duyệt JPEG/PNG/WebP, 5 MiB/ảnh và tối đa 10 ảnh trên toàn ticket, bao gồm
các message/report. Giới hạn tổng ngăn lách số lượng qua nhiều message. Không cho SVG,
PDF/video giả extension thành ảnh. Kiểm tra loại nội dung thực và kích thước;
file private và URL đọc có hạn chỉ được cấp sau kiểm tra quyền message hiện tại.

Không đánh đồng quyền xem ticket với quyền ảnh INTERNAL_NOTE/STAFF_REPORT.
FS cũ bị reassign phải mất quyền ảnh cũ, kể cả mình đã upload.
MVP không có hard-delete ảnh hoặc tự “thay ảnh” làm mất audit.

Khóa ticket trước khi finalize attachments, đếm ảnh toàn ticket và insert trong
cùng transaction để hai lần upload không cùng vượt mốc 10. Staged object chưa
gắn phải thuộc actor/operation; không chấp nhận arbitrary object key từ client.
Retry cùng key không đếm ảnh hai lần. Upload ngoài DB transaction; thất bại
definite rollback chỉ cleanup object mới chắc chắn chưa tham chiếu. Khi commit
outcome chưa xác định, không xóa object có thể đã commit; reconciliation chỉ
xóa sau kiểm tra không có reference. Không reset DB để xử lý orphan.

## 6. support_audit và support_idempotency

### Audit

Cột: id UUID PK, ticket_id UUID FK RESTRICT, actor_id UUID FK users RESTRICT,
action text, previous_version integer nullable, next_version integer,
old_status/new_status nullable, previous_staff_id/next_staff_id UUID nullable,
assignment_version integer nullable, reason text nullable, details JSONB allowlist,
occurred_at timestamptz. Message/report/notification IDs có thể là reference trong
details; không nhét raw secret/file URLs hoặc toàn bộ request vào JSONB.

Lưu assignment/reassignment, priority, start onsite/BOM, report submission,
acceptance, customer withdrawal, resolved closure và reopen cùng transaction
tương ứng. Audit append-only, không có public endpoint tự động trả toàn bộ audit
cho customer. RESTRICT giữ lịch sử; không cascade xóa theo unit/rental/account.

### Idempotency

Bảng feature nhỏ support_idempotency: actor_id UUID FK, operation text,
idempotency_key text, request_hash text, ticket_id UUID FK nullable tới khi kết
quả đã hoàn tất, result_reference JSONB allowlist, created_at timestamptz.
Unique (actor_id, operation, idempotency_key).

Cùng key/cùng hash trả kết quả cũ sau khi kiểm tra quyền hiện tại; khác hash nhận
conflict. Ownership và scope phải kiểm lại khi replay, không dùng cached response
lách reassign/revocation. Row kết quả hoàn tất và audit commit cùng ticket.
Không trả “thành công” cho operation chưa commit; xử lý concurrent key dưới unique
constraint/transaction, không check-then-insert ngoài transaction.
Không cache nội dung note/ảnh vào result_reference cho replay trái quyền.

## 7. Notifications: reuse outbox nhưng bổ sung contract

Thiết kế mở rộng notification_outbox dành cho #166:

- support_ticket_id nullable FK Support, chỉ bắt buộc với Support event.
- channel EMAIL/IN_APP, preserve/default EMAIL cho dữ liệu lifecycle cũ.
- recipient_email nullable khi IN_APP; CHECK yêu cầu email thật cho EMAIL.
- Giữ recipient_user_id/recipient_role; IN_APP cần user ID.
- Giữ booking_id/facility_id NOT NULL lấy context thật từ ticket.
- Giữ rental_term_version và toàn bộ delivery/lease/retry semantics trên dev.
- Event Support: SUPPORT_CREATED, SUPPORT_ASSIGNED, SUPPORT_REASSIGNED,
  SUPPORT_REPORTED, SUPPORT_PUBLIC_REPLIED, SUPPORT_CLOSED, SUPPORT_REOPENED,
  SUPPORT_PRIORITY_CHANGED, SUPPORT_INTERNAL_NOTE_CREATED. Sự kiện note chỉ gửi
  người có quyền note; không dùng enum booking giả.

Giữ dedupe hiện có (event_key, recipient_key), encode channel trong logical
event_key hoặc recipient_key nhất quán; không gửi cùng sự kiện hai lần do retry.
Ví dụ logical key support:<ticketId>:<version>:<action>:<channel>, recipient
user:<userId>. Reassign gửi recipient thu hồi tối thiểu cho FS cũ, không chứa
nội dung ticket bị mất quyền.

Query inbox bổ sung FS/BOM và support_ticket_id projection; kiểm tra role ACTIVE,
membership/current assignee của FS hoặc facility FM; BOM theo R1, customer owner.
Không áp dụng nguyên predicate FM exists(membership) cho BOM. Inbox phải ẩn thông
báo chứa nội dung ticket khi recipient đã mất quyền, giữ loại thông báo thu hồi
chỉ có nội dung tối thiểu. Không rò rỉ note vào email/public notification snapshot.

Customer email gửi tới tài khoản sở hữu đã được server xác định; không lấy email
tùy ý từ payload ticket để chuyển dữ liệu sang người khác. Khi triển khai phải
kiểm tra chính sách verified email hiện có. Phản hồi provider lỗi không rollback
ticket; worker retry sau commit, không hứa exactly-once ở nhà cung cấp khi kết
quả provider chưa rõ. Logical notification không trùng theo DB dedupe.

Inbox riêng từng role nghĩa là người nhận/DTO/navigation được phân quyền, không
tạo một bảng notification riêng cho mỗi role. Không thêm realtime hay một SLA
engine chỉ vì C13/C14.

## 8. Chỉ số 12 giờ và ưu tiên

Theo C14, cần phân biệt:

1. created_at → action_due_at = created_at + 12 giờ liên tục (R4).
2. first_assigned_at: FM đã giao ai.
3. first_onsite_started_at: FS ghi nhận tới/bắt đầu xử lý.
4. first_bom_response_at: PAYMENT do BOM phản hồi/bắt đầu xử lý theo R4.

Dữ liệu thời điểm tới do FS ghi nhận dưới auth/assignment guard, là bản ghi tác
nghiệp chứ không bằng chứng GPS; không thêm geolocation/IoT vào scope.
Queue chỉ ra deadline còn lại/quá hạn và sắp HIGH trước NORMAL; không thay đổi
thời điểm đã xảy ra để “đạt SLA”. Khách rút yêu cầu thì lưu CUSTOMER_WITHDREW,
dừng công việc/nhắc việc, không ghi thành RESOLVED để làm đẹp số liệu.

Mốc 12 giờ đo lần bố trí xử lý đầu tiên từ created_at. Reopen có thời
điểm riêng trong audit, không xóa kết quả quá hạn cũ hoặc sửa created_at; chưa
đề xuất một SLA cycle tự động mới cho mỗi lần mở lại. R3 quy định giao lại người
xử lý, còn R4 giữ phép đo ban đầu nhất quán, không tự hứa deadline mới trong email.

## 9. Thứ tự transaction và tác động tối thiểu

Thiết kế #165/#166 phải dùng một thứ tự khóa thống nhất, phù hợp assignment revoke
hiện có: identity/membership theo thứ tự ổn định, booking/context, ticket rồi child
rows. Trước code phải chạy GitNexus impact và kiểm source transaction hiện tại;
thứ tự trên là phương án, không tuyên bố đã phân tích deadlock đầy đủ.

Authorization, expectedVersion, current assignment, latest report, count ảnh,
mutation/audit/outbox phải được kiểm tra trong cùng transaction cần thiết.
Recheck membership sau khóa; không chỉ dùng scope cache từ lúc request bắt đầu.
Không thay booking.assignedStaffId, inspection assignee, physical occupancy,
payment status, rental status hoặc access code khi thao tác ticket.

## 10. Bàn giao implementation

| Phần | #165 | #166 |
| --- | --- | --- |
| DB | Nền ticket/message/ảnh/audit/idempotency sau duyệt | Reports, assignment/version transitions, outbox/channel và indexes còn lại |
| Contract/client | Customer create/list/detail/public reply/private images | Operational queue/assign/report/accept/close/reopen/priority/inbox |
| State | OPEN và ownership/context guards | C05 IN_PROGRESS lúc assign, report giữ trạng thái, FM duyệt/đóng, withdrawal và reopen |
| Test sau duyệt | Auth owner/other/guest, sau bàn giao, PAYMENT failed/cancelled, idempotency, ảnh thứ 11/private access | Reassign revocation, latest report, simultaneous close/report, stale version, priority/deadline, email retry/inbox role privacy |
| Docs | Customer API docs, feature messages/types và fixtures | Operations API docs, notification matrix, exact shared exports |

Không tạo unit tests cho CRUD đơn giản. Integration dùng DB test cô lập theo
AGENTS.md khi triển khai; không chạy runtime suites cho tài liệu #164.

## 11. Checklist bàn giao model

- [x] Có entities, fields, FK, indexes và constraints thiết kế.
- [x] Có ownership/context và public/internal/report separation.
- [x] Có assignment history, report approval và customer withdrawal.
- [x] Phân biệt ticket Support với facility_task/booking assignment.
- [x] Có phương án 10 ảnh, concurrency, replay và private access.
- [x] Có notification channel/role/dedupe và source compatibility trên dev mới.
- [x] Phân biệt 12 giờ bố trí xử lý với thời hạn giải quyết xong.
- [x] Policy R1–R5 đã được duyệt; model được thống nhất và cập nhật docs/db-diagram.md.
- [x] Kiểm tra cuối đồng bộ model/diagram và liên kết tài liệu.

Kiểm chứng ngày 24/10/2026: whitespace, liên kết/anchor, code fences và review
đối chiếu policy/canonical diagram đã pass. Không chạy runtime/DB suites cho
issue decision-only; implementation và integration coverage thuộc #165/#166.
