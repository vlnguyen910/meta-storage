# Gia hạn rental — issue #163

Policy: [customer-financial-policy.md](./customer-financial-policy.md).
Phạm vi: backend, database, shared contracts và API client. Web/Mobile tích hợp
qua `client.renewals`; giao diện gia hạn chưa thuộc issue này.

## Endpoint và quyền

Tất cả endpoint mới yêu cầu tài khoản `CUSTOMER` đang ACTIVE và ownership hiện tại
qua `rentals.booking_id → bookings.user_id`. Không suy ra ownership từ email.
Không đăng nhập: 401; sai role: 403; không có quyền sở hữu/không tồn tại: 404.

| Method/path | Input | Kết quả |
| --- | --- | --- |
| `POST /api/rentals/:rentalId/renewals` | `{months: 1..12, idempotencyKey: string(16..128)}` | 201, quote có snapshot; chưa tạo charge/hold |
| `GET /api/rentals/:rentalId/renewals` | `limit=20` (1..100), `offset=0` | 200, mảng lịch sử theo `createdAt DESC, id DESC` |
| `GET /api/rental-renewals/:renewalId` | UUID | 200, chi tiết quote và kết quả xử lý |
| `POST /api/rental-renewals/:renewalId/accept` | `{acceptedTerms: true, termsVersion: quote.termsVersion}` | 200, lưu acceptance và tạo một charge OPEN |
| `POST /api/rental-charges/:chargeId/payments` | `{idempotencyKey: string(16..128)}` | API #162: 201, phiên SePay thanh toán toàn bộ tiền thuê |

Envelope giữ convention `{success: true, data, timestamp}`. Contract output:
`RentalRenewalDto` trong `@metastorage/contracts/renewals`. Body mới strict;
khách không được gửi giá, số tiền, cọc, unit, thời hạn hết hiệu lực hoặc trạng thái.

## Trình tự sử dụng

1. Tạo quote, hiển thị `oldEndAt`, `newEndAt`, `monthlyRate`, `amount`, `currency`,
   `timezone`, `cutoffAt`, `expiresAt`, `termsVersion`, `terms`.
2. Khách xác nhận đúng phiên bản điều khoản; nhận `chargeId`. Không cần FM duyệt
   gia hạn đúng chính sách. Retry request/accept trả cùng bản ghi đã lưu.
3. Gọi API charge payment hiện có. Số tiền lấy từ snapshot server, chỉ VND và
   thanh toán toàn phần. Deadline payment giữ nguyên deadline quote.
4. Theo dõi payment qua API #162 và đọc renewal để phân biệt `APPLIED` với
   `REFUND_REQUIRED`; provider xác nhận đã thu tiền chưa đồng nghĩa đã gia hạn.

Quote có `QUOTED → AWAITING_PAYMENT → APPLIED` hoặc `REFUND_REQUIRED`.
Quote/acceptance chưa hoàn tất thanh toán có thể được đọc thành `EXPIRED` sau
deadline; đó là trạng thái suy ra từ snapshot, không phải một lần gia hạn mới.
Charge và payment giữ lifecycle riêng. Khi cần thử lại sau deadline, tạo quote
mới bằng idempotency key mới. Không có job tự cộng kỳ hay thu thêm tiền.

## Quy tắc nghiệp vụ đã duyệt

- Chỉ cùng unit, rental ACTIVE, chưa nhận trả/đóng, không có bất kỳ return request
  nào và không có capacity conflict. RETURN_PENDING, OVERDUE, CLOSED bị từ chối.
- Unpaid RETURN_DEBT ở bất kỳ rental nào của customer chặn gia hạn; EXTRA là
  khoản phải trả riêng. Công nợ có xét adjustment và collection/refund đã xác nhận.
- Giá là `unit_types.monthly_price` tại lúc tạo quote. Quote tối đa 15 phút và
  không vượt cuối phút 23:59 của ngày địa phương sáu ngày trước expiry. Tạo quote
  cần còn một khoảng thời gian dương; payment hợp lệ tới millisecond cutoff cuối.
- Múi giờ: return calendar của facility, hoặc timezone thống nhất từ operating
  hours. Thiếu cấu hình thì từ chối; không dùng timezone của máy chạy API.
- Một tháng bằng 720 giờ. Ví dụ 31/01/2032 10:00 + một tháng = 01/03/2032 10:00
  tại Việt Nam. Booking mới cũng dùng 30 ngày/tháng; dữ liệu kỳ đầu đã lưu không
  được tính lại. Renewal cộng từ current expiry, không cộng từ ngày thanh toán.
- Không thu thêm cọc. Không hoàn phí thuê khi trả sớm, kể cả kỳ đầu/gia hạn.
  `unusedRentRefundAmount` của quyết toán mới phải bằng `"0"`; các entitlement và
  transfers đã duyệt trong lịch sử vẫn được bảo toàn khi đọc/replay/correction.
- OVERDUE bắt đầu ngay tại expiry nếu chưa trả đúng hạn. Phí quá hạn vẫn chỉ phát
  sinh nếu ngày trả địa phương sau ngày expiry. Mốc abandoned review tiếp tục là
  bảy ngày địa phương đầy đủ sau nửa đêm đầu tiên của ngày quá hạn.
- Không sửa booking/PDF gốc. Lưu nguyên văn/version điều khoản và customer
  acceptance trong renewal; signed addendum chưa bắt buộc trong MVP.
- Các ngoại lệ FM/override giá, kỳ hoặc cutoff được tách sang [#174](https://github.com/vlnguyen910/metastorage/issues/174).
  Không có API bypass chính sách trong #163. Charge RENEWAL không được điều chỉnh
  thủ công hoặc dùng dispute flow của EXTRA.

## Transaction, callback và thông báo

Facility → booking → rental locks dùng chung với Return/cron. Offering lock dùng
chung với checkout; quote không giữ capacity. Callback kiểm tra lại version,
current end, trạng thái, return/debt và capacity. Chỉ provider success xác minh,
đúng amount/currency và `paidAt <= expiresAt` mới có thể apply.

Callback đến sau quote expiry vẫn có thể apply nếu provider đã nhận tiền đúng hạn
và rental còn hợp lệ. Nếu rental đã quá hạn, return/booking khác đã thắng, hoặc
provider nhận tiền muộn: không cộng kỳ; payment thành REFUND_PENDING, charge
REFUND_DUE, renewal REFUND_REQUIRED và tạo refund liên kết nguồn. SA/BOM dùng
controlled charge-refund của #162; không tự gọi hoàn tiền provider.

Một lần apply cập nhật `rentals.expected_end_at`, tăng `version`, kéo dài chính
allocation hiện tại và giữ nguyên physical unit/deposit. Unique applied-term,
charge/payment/source linkage và event idempotency chặn retry/concurrency cộng kỳ.
`failureReason` lưu lý do không áp dụng; không tính lại snapshot booking.

Expiry/overdue/review dedupe theo rental term version. Kỳ đầu giữ key cũ; kỳ sau
dùng `rental:<id>:term:<version>:<event>`. Apply suppress thông báo kỳ cũ chưa gửi;
worker kiểm tra version ngay trước gửi, kể cả legacy row không có version. Không
thể thu hồi email đã gửi hoặc bảo đảm exactly-once delivery qua provider.

Current rental/list/guest reads và return assessment đọc `rentals.expected_end_at`.
Booking, issued contract và initial-payment history tiếp tục là dữ liệu kỳ đầu.
Reports dùng source RENEWAL để tách tiền thuê gia hạn khỏi cọc/EXTRA/RETURN_DEBT.

## Lỗi và kiểm chứng

400: input không hợp lệ hoặc cố hoàn unused rent trong quyết toán mới. 409:
quá cutoff/quote expiry, stale term, return/debt/capacity conflict, key dùng cho
số tháng khác hoặc sai version điều khoản. Thiếu timezone/rate: từ chối quote.
Lỗi DB không bị chuyển thành thành công/hoàn tiền giả; transaction rollback.

Migration sinh bằng `bun run db:generate`: `0051_hot_nightcrawler.sql`.
Không reset/reseed DB đang dùng; migration additive.

Test: `apps/api/tests/integration/rental-renewal.test.ts`, guard bằng
`RENTAL_RENEWAL_TEST_DATABASE_URL` hoặc `BOOKING_TEST_DATABASE_URL`. Thiết lập
DB test theo [local-database-tests.md](./local-database-tests.md). CI tự phát hiện
suite này trong `bun run --filter api test:db`; không chấp nhận test bị skip.

Các test kiểm tra HTTP với session/auth thật, Zod, PostgreSQL constraints/locks,
payment replay/concurrency, return/expiry race, late capture, immutable snapshots,
reports, worker stale-term guard, cutoff/timezone và tháng 30 ngày. Các kết nối
payment/photo/mail bên ngoài dùng cấu hình/adapter test, không gọi provider thật.
