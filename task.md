# Công việc: Config vòng đời rental và magic link cho guest

Ngày ghi nhận: 2026-10-20.
Trạng thái: triển khai backend hoàn tất; frontend/API-client integration chưa thuộc phạm vi.
Phạm vi: backend, database, worker, shared API contracts, tài liệu và kiểm thử liên quan.
Frontend, mobile và API client thuộc task tích hợp riêng.

## 1. Thêm bảng config và API quản trị

Mục tiêu: Admin chỉnh được các mốc thời gian vận hành đã được cho phép mà không cần sửa code.

- [x] Rà schema, API cấu hình và audit hiện có; xác định phần có thể tái sử dụng.
- [x] Chốt danh sách key được hỗ trợ và validation cho từng key. Admin sửa giá trị,
  không tự tạo key hoặc định nghĩa nghiệp vụ mới qua API.
- [x] Thêm bảng config gồm `key` duy nhất (tên tham số), `value`, `description`,
  `version`, `updatedBy`, `updatedAt`; lựa chọn kiểu `value` phù hợp với convention hiện có.
- [x] Cập nhật `docs/db-diagram.md` và Drizzle schema cùng nhau; generate migration
  bằng `bun run db:generate`, không sửa migration sinh tự động.
- [x] Khởi tạo số ngày nhắc trước hạn = 7 ngày và số ngày overdue trước FM review = 7;
  thao tác khởi tạo không ghi đè cấu hình đã có.
- [x] Thêm API đọc/cập nhật config cho System Admin với shared contracts,
  validation phía backend và kiểm tra `expectedVersion` khi cập nhật.
- [x] Lưu audit giá trị cũ/mới, người và thời điểm thay đổi trong cùng transaction.
- [x] Xác định lỗi khi thiếu/sai cấu hình; không âm thầm fallback sang số hard-code.

Kết quả cần đạt:

- Admin đọc và sửa được hai tham số ngày qua API; dữ liệu lưu bền vững trong DB.
- Key không hỗ trợ, sai kiểu/ngoài giới hạn, sai quyền và cập nhật bằng version cũ bị từ chối.
- Có lịch sử thay đổi; không tạo hai nguồn cấu hình cho cùng một tham số.

## 2. Chuyển các mốc ngày hard-code sang config

| Thông số/quy tắc | Công việc |
| --- | --- |
| Nhắc trước hạn 7 ngày | Đọc số ngày từ bảng config mới |
| Rental tạo trong cửa sổ nhắc thì gửi ngay | Dùng cùng số ngày cấu hình, giữ quy tắc gửi ngay |
| Sau 7 ngày overdue đầy đủ chuyển FM review | Đọc số ngày từ bảng config mới |
| Giờ nhắc mặc định 09:00, timezone, ngày nghỉ | Tái sử dụng cấu hình lịch theo cơ sở hiện có; không nhân đôi vào bảng mới |
| Tỷ lệ phí overdue | Giữ bảng/API hiện có, BOM chỉnh 0–100% và có audit |
| Overdue từ 00:00 ngày sau ngày hết hạn | Giữ chính sách đã chốt, không biến thành config trong task này |

- [x] Rà cả query chọn rental cần xử lý và service đánh giá điều kiện; thay đồng bộ
  các mốc 30/7, bao gồm nhánh tạo rental và nhánh catch-up khi job chạy trễ.
- [x] Giữ cách đếm theo ngày/timezone cơ sở; mốc FM review tính từ lúc bắt đầu overdue,
  không nhầm với bảy ngày tính từ ngày hết hạn.
- [x] Dùng bộ giá trị config nhất quán cho một lượt xử lý; không để query chọn candidate
  và service dùng hai ngưỡng khác nhau khi Admin vừa cập nhật cấu hình.
- [x] Chốt và áp dụng chính sách hiệu lực của thay đổi config (xem mục 6).
- [x] Giữ dedupe thông báo, trạng thái yêu cầu trả kho, cờ manual review và audit lịch sử.
- [x] Cập nhật tài liệu API/config/job để mô tả giá trị lấy từ DB thay vì mốc cố định.

Kết quả cần đạt:

- Đổi hai tham số ngày làm thay đổi đúng thời điểm tạo thông báo/FM review, không cần deploy lại.
- Không gửi lại thông báo logic đã gửi, không thu hồi cờ review đã ghi và không tự xử lý tài sản.
- Không thay đổi snapshot phí, settlement hoặc các khoản refund đã xác nhận.

## 3. Mở rộng magic link để guest xem rental

Mục tiêu: guest truy cập rental của booking đã được xác thực mà không phải tạo tài khoản.

- [x] Rà magic grant, session Redis, exchange/revoke và authorization hiện có;
  giữ phiên gắn với đúng `bookingId`, không cấp quyền chỉ dựa vào booking code/email.
- [x] Tái sử dụng booking code làm mã tham chiếu cho MVP; không thêm rental code riêng.
- [x] Thêm API đọc rental liên kết với booking của phiên guest: thông tin kho,
  cơ sở, kỳ thuê, trạng thái và ngày hết hạn qua DTO được phép công khai cho khách.
- [x] Thêm API đọc lịch sử thanh toán/refund của đúng rental; không lộ thông tin provider,
  dữ liệu nội bộ hoặc audit chỉ dành cho nhân viên.
- [x] Thêm API liệt kê hợp đồng đã issue và xem/tải PDF qua backend có xác thực guest.
  Tái sử dụng `booking_contracts` và private storage hiện có, không tạo bảng contract mới.
- [x] Kiểm tra cookie path hiện tại (`/api/booking`) để thiết kế endpoint guest phù hợp;
  không vô tình mở rộng cookie hoặc quyền truy cập các API tài khoản/nhân viên.
- [x] Xử lý rõ booking chưa bàn giao/chưa có rental, rental CLOSED, hợp đồng draft/mất file,
  link/session hết hạn và Redis không khả dụng.
- [x] Giữ cookie HttpOnly, thời hạn phiên, revoke, no-store, chống dò mã và giới hạn quyền
  theo booking. Không tự liên kết tài khoản hoặc tìm mọi booking có cùng email.

Kết quả cần đạt:

- Guest mở link hợp lệ và xem được rental, thanh toán và hợp đồng đã issue của đúng booking.
- Phiên của booking A không đọc được rental/payment/document của booking B.
- Không cấp quyền tạo/sửa/hủy return request, settlement hoặc thao tác nhân viên qua phiên đọc.
- Không bắt guest có account và không thêm bảng guest/session khi cơ chế hiện tại đáp ứng được.

## 4. Cấp lại magic link để truy cập xuyên suốt kỳ thuê

Link magic hiện tại được giới hạn 24 giờ; phiên cookie có hạn 30 phút.
Chỉ mở quyền đọc rental chưa giải quyết việc link hết hạn trong kỳ thuê nhiều tháng.

- [x] Áp dụng TTL 24 giờ từ lúc tạo link; link mới thu hồi grant cũ. Session hiện tại
  tiếp tục theo TTL cookie 30 phút.
- [x] Thêm API xin link bằng booking code và email; chỉ gửi tới contact email đang lưu
  trên booking đã được backend kiểm tra, không dùng địa chỉ nhận tùy ý từ client.
- [x] Trả phản hồi chung khi booking/email không khớp; giới hạn 3 yêu cầu/booking/giờ
  và 10 yêu cầu/IP/giờ.
- [x] Tái sử dụng outbox, worker và mail adapter; tạo định danh lần cấp mới và delivery key
  riêng, không dùng lại job ID xác nhận booking khiến lần cấp mới bị dedupe nhầm.
- [x] Retry cùng một yêu cầu cấp link không tạo nhiều link/email logic; token không xuất hiện
  trong log, URL query hoặc dữ liệu công khai. Giữ cơ chế hash/mã hóa hiện có khi phù hợp.
- [x] Giữ email nhắc hết hạn theo contact email trong booking; việc thêm link trực tiếp
  tới portal hoặc trang xin link cần quyết định giao diện/URL trước khi nối.
- [ ] Chốt và tài liệu hóa quy trình mất quyền truy cập email/thay đổi contact email;
  không cho phép đổi email chỉ bằng booking code. Revoke link/session hiện hành đã có.
  không cho phép thay email chỉ bằng booking code.

Kết quả cần đạt:

- Khách vẫn có cách truy cập rental sau khi link ban đầu hết hạn, qua xác minh quyền giữ email.
- Yêu cầu gửi link có kiểm soát, retry an toàn; gửi mail lỗi không đổi trạng thái booking/rental.
- Link/session hết hạn hoặc bị thu hồi không truy cập được tài liệu/rental.

## 5. Kiểm thử và bàn giao

- [x] Trước sửa code: đọc instructions/skill liên quan, kiểm tra code và test mới nhất;
  chạy GitNexus impact cho symbol bị ảnh hưởng và báo rủi ro theo quy định repository.
- [x] Kiểm thử config: quyền Admin/BOM đúng phạm vi, validation, concurrency/version,
  audit atomic và rollback khi cập nhật thất bại.
- [x] Kiểm thử job: trước/đúng/sau ngưỡng, timezone, đổi config, tạo rental trong cửa sổ nhắc,
  job chạy trễ và retry/concurrency không tạo thông báo trùng.
- [x] Kiểm thử guest: link/session hết hạn, revoke, truy cập chéo booking, hợp đồng draft,
  PDF private, Redis lỗi, rate limit và không có quyền ghi nghiệp vụ.
- [x] Kiểm thử cấp lại link/outbox: email không khớp, retry, gửi thất bại, dedupe từng lần cấp,
  chính sách hiệu lực token cũ/mới và không lộ token.
- [x] Chạy regression booking tracking, rental reads, contract access và notification bị ảnh hưởng;
  typecheck/lint các workspace liên quan, tự rà diff và cập nhật tài liệu endpoint.
- [x] Dùng DB và Redis container local hiện có; fixture có scope riêng, chỉ cleanup dữ liệu
  do lượt test tạo. Không tạo DB riêng, truncate/reset seed hoặc flush Redis.

Kết quả cần đạt: báo cáo endpoint/cấu hình mới, migration, test thực sự đã chạy và kết quả,
các giới hạn vận hành, cùng hướng dẫn tích hợp frontend. Không coi test skip/mock provider
là bằng chứng gửi email/storage thật hoặc UI đã hoạt động.

## 6. Quyết định đã chốt và thông tin còn thiếu

- Không đặt giới hạn nghiệp vụ min/max cho cấu hình ngày; chỉ kiểm tra số nguyên
  không âm và giới hạn kiểu integer của PostgreSQL.
- Thay đổi config áp dụng ở lượt job kế tiếp; không gửi lại logical event đã có và
  không xóa cờ FM review đã ghi.
- Còn cần chốt thời gian được xin link sau CLOSED, xử lý khi khách mất quyền truy cập
  email hoặc email contact thay đổi, và URL được gắn email nhắc hết hạn.
- Rate limit đã chốt: 3 yêu cầu/booking/giờ và 10 yêu cầu/IP/giờ. Link 24 giờ;
  cấp link mới thu hồi magic grant cũ; cookie session hiện hành giữ TTL 30 phút.

Không tự chọn giá trị cho các TBD còn lại. Nhánh không phụ thuộc tiếp tục được triển khai.

## 7. Phụ thuộc và phạm vi cuối cùng

- Công việc 1 → công việc 2.
- Công việc 3 tái sử dụng magic link hiện có; công việc 4 phụ thuộc authorization guest
  của công việc 3 và các quyết định TTL/cấp lại đã chốt.
- Công việc 5 thực hiện theo từng nhánh, không dồn kiểm thử tới cuối.
- Người dùng đã yêu cầu implementation; thực hiện schema/API/job/test trong phạm vi backend,
  không commit hoặc push.
- Không có renewal/upgrade, e-signature, tự thanh lý tài sản, cấp quyền trả kho cho guest,
  giao diện Admin config hoặc frontend guest portal trong phạm vi backend này.
