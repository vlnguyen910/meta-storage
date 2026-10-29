# Đặc tả triển khai gia hạn kỳ thuê

Ngày tổng hợp: 2026-10-30. Trạng thái: **backend API đã triển khai** cho báo giá,
lịch sử, chi tiết, tạo phiên thanh toán, xác minh payment và áp dụng kỳ thuê. Web,
Mobile, API client và kiểm thử tích hợp chưa thuộc phần triển khai này. Các lựa chọn
nghiệp vụ được đánh dấu đề xuất đã được dùng làm mặc định runtime cho phiên bản này.

## 1. Kết quả cần đạt và quyết định đã chốt

Customer đang thuê kho có thể yêu cầu gia hạn, nhận báo giá theo giá hiện hành,
thanh toán và được cập nhật hạn thuê sau khi hệ thống xác minh đã nhận tiền.

| Nội dung | Quy tắc đã chốt qua trao đổi |
| --- | --- |
| Thời gian yêu cầu | Trong kỳ thuê, **trước khi bước vào 7 ngày cuối**, không phải chỉ mở gia hạn trong 7 ngày cuối |
| Cấu hình số ngày | Đưa vào system settings cho BOM quản lý, mặc định 7 ngày |
| Giá gia hạn | Dùng giá hiện hành tại lúc tạo báo giá |
| Giữ khả năng gia hạn | Giữ trong thời gian chờ thanh toán, tương tự checkout |
| Điều kiện kho | Từ chối nếu tiếp tục giữ kho làm xung đột với đặt chỗ đã cam kết hoặc thiếu capacity cho khoảng gia hạn |
| Kết quả | Cập nhật hạn thuê của rental sau khi thanh toán hợp lệ |

Diễn giải thời gian đã được tổng kết trong trao đổi:

```text
cutoffAt = rental.endAt - noticeDays × 24 giờ
Điều kiện gửi yêu cầu: rental.startAt <= now < cutoffAt

Hết hạn: 30/11/2026 10:00 +07:00
noticeDays = 7
Hạn chót: 23/11/2026 10:00 +07:00
23/11/2026 09:59:59: được gửi yêu cầu nếu các điều kiện khác đạt
23/11/2026 10:00:00: từ chối yêu cầu mới
```

Lưu/so sánh thời điểm chính xác; hiển thị theo `Asia/Ho_Chi_Minh`. Không làm tròn
về cuối ngày, không lấy múi giờ trình duyệt hoặc máy API làm quy tắc nghiệp vụ.

## 2. Các mặc định đề xuất, chưa được xác nhận riêng

Các nội dung này giúp xác định một phiên bản đầu đủ gọn. Không mô tả chúng là
chính sách đã được Customer/BOM phê duyệt chỉ vì xuất hiện trong tài liệu.

| Nội dung | Đề xuất cho phiên bản đầu |
| --- | --- |
| Phạm vi gia hạn | Giữ chính kho vật lý đang thuê; không tự chuyển/đổi loại kho |
| Thời lượng | Số tháng nguyên 1..12; một tháng bằng 30 × 24 giờ, thống nhất với reservation hiện tại |
| Hạn mới | Cộng từ `oldEndAt`, không cộng từ lúc thanh toán |
| Tiền cọc | Chỉ thu tiền thuê thêm; giữ nguyên cọc đã thu |
| FM phê duyệt | Không cần duyệt riêng nếu đạt mọi điều kiện; chưa có override |
| Lịch trả kho | Chặn nếu có lịch CHECK_OUT đang mở hoặc inspection trả kho chưa kết thúc; khách hủy lịch trả trước nếu muốn gia hạn |
| Thời hạn báo giá | Dùng TTL checkout hiện tại, đang là 10 phút; giá cố định trong thời hạn đó |
| Hạn thanh toán | Không vượt hạn chót gia hạn; xem công thức ở mục 4 |
| Thay đổi setting | Chỉ áp dụng cho báo giá mới; báo giá còn hạn giữ snapshot đã cấp |
| Quá hạn thực tế | Rental dù còn status ACTIVE vẫn không được gia hạn nếu `now >= endAt` |
| Giới hạn song song | Tối đa một phiên thanh toán gia hạn đang chờ cho mỗi rental |

Chưa tự bổ sung chính sách chặn theo công nợ, hoàn tiền thuê khi trả sớm, phụ lục
hợp đồng hoặc quy trình ngoại lệ FM. Các quy tắc trong tài liệu gia hạn cũ không
tự động trở thành yêu cầu cho phiên bản mới.

## 3. Backend hiện có gì và còn thiếu gì

Đã đối chiếu source hiện tại, không chỉ dựa vào tài liệu cũ:

| Phần | Hiện trạng và công việc cần làm |
| --- | --- |
| Rental | Có ACTIVE/CLOSED, startAt/endAt, bookingId hoặc reservationId, kho và chủ thuê; chưa có nghiệp vụ gia hạn |
| API rental | Có API đọc Customer/FM và lịch sử thanh toán; chưa có endpoint gia hạn |
| System settings | Có catalog, phân quyền, version và lịch sử; chưa có setting hạn chót gia hạn |
| Pricing | Có giá tháng hiện hành của unit type theo facility; quote đặt thuê đang tính cả cọc, không dùng nguyên total cho gia hạn |
| Capacity | Có allocation, hold, kiểm tra overlap và khóa offering; chưa có điều phối gia hạn cho rental hiện tại |
| Payment | Có SePay, webhook, reconciliation, idempotency và hoàn tiền có kiểm soát; CHARGE hiện chỉ gắn booking/reservation |
| Lịch sử gia hạn | Bảng và API gia hạn cũ đã bị gỡ; cần mô hình mới tối thiểu |

Các nguồn cần đọc khi triển khai:

- [Rentals routes](../apps/api/src/modules/rentals/rentals.routes.ts),
  [service](../apps/api/src/modules/rentals/rentals.service.ts),
  [repository](../apps/api/src/modules/rentals/rentals.repository.ts).
- [Rental schema](../packages/database/src/schema/rentals.ts),
  [payment schema](../packages/database/src/schema/payments.ts).
- [System setting catalog](../packages/contracts/src/system-settings.ts),
  [system settings API](./system-settings.md).
- [Pricing service](../apps/api/src/modules/pricing/pricing.service.ts).
- [Storage units service](../apps/api/src/modules/storage-units/storage-units.service.ts),
  [repository](../apps/api/src/modules/storage-units/storage-units.repository.ts).
- [Reservation checkout](../apps/api/src/modules/payments/reservation-payments.service.ts),
  [payment handler](../apps/api/src/modules/payments/payments.service.ts),
  [hold expiry](../apps/api/src/common/cron/expire-capacity-holds.ts).
- [Appointments service](../apps/api/src/modules/appointments/appointments.service.ts),
  [inspections service](../apps/api/src/modules/inspections/inspections.service.ts).

[Tài liệu gia hạn cũ](./rental-renewal-api.md) đã đánh dấu hết hiệu lực sau đợt
tinh gọn. [Rental reset](./rental-reset.md) là lịch sử thay đổi, có các mô tả về
handover/return đã được phát triển tiếp trong source hiện tại. Không phục hồi
nguyên bộ bảng, endpoint hoặc chính sách cũ dựa trên hai tài liệu đó.

Quy tắc 7 ngày ở mục 1 thay cho mốc cuối ngày sáu ngày trước expiry của phần gia
hạn trong [policy lịch sử](./customer-financial-policy.md). Các quyết định công nợ,
charge và ngoại lệ trong policy đó không tự được khôi phục theo tính năng mới.

## 4. Luồng thực hiện đề xuất

### 4.1. Xem rental và tạo báo giá

1. Backend lấy actor từ session, xác minh quyền sở hữu rental.
2. Kiểm tra ACTIVE, đã bắt đầu thuê, chưa hết hạn và còn trước cutoff.
3. Kiểm tra không có luồng trả kho đang mở, facility/unit type còn cung cấp dịch vụ,
   kho hiện tại vẫn là kho của rental và đủ điều kiện tiếp tục thuê.
4. Customer chỉ gửi số tháng và idempotency key. Facility, unit type, kho, đơn giá,
   số tiền, hạn mới và chủ thuê đều do backend suy ra.
5. Kiểm tra khoảng gia hạn `[oldEndAt, newEndAt)` với các cam kết capacity và kho.
6. Đọc giá hiện hành, tính tiền nguyên VND trên server và lưu snapshot báo giá.

```text
newEndAt = oldEndAt + months × 30 × 24 giờ          # thời lượng đề xuất
amount = monthlyRateSnapshot × months
quoteExpiresAt = min(quoteCreatedAt + checkoutTTL, cutoffAt)
```

Báo giá phải còn thời hạn dương. Tạo báo giá **chưa giữ kho**, chưa sửa rental và
chưa tạo nghĩa vụ thanh toán ngoài yêu cầu gia hạn này. Dùng cùng idempotency key
và cùng payload thì trả kết quả đã lưu; khác payload thì 409, không lấy giá lại.

### 4.2. Customer tiếp tục thanh toán

1. Customer chọn thanh toán đúng báo giá đang hiển thị.
2. Trong transaction, khóa và kiểm tra lại rental, báo giá, offering và kho liên quan.
3. Nếu hạn hiện tại/kho thay đổi so với snapshot hoặc đã hết hạn báo giá thì 409;
   không tự sửa giá/kỳ của báo giá cũ.
4. Kiểm tra lại capacity, tạo hold bảo vệ khoảng gia hạn và một payment liên kết.
5. Commit dữ liệu rồi tạo/khôi phục phiên checkout qua adapter hiện có.

```text
holdExpiresAt = payment.expiresAt
              = min(checkoutStartedAt + checkoutTTL, quoteExpiresAt, cutoffAt)
```

Retry phải giữ nguyên payment, giá và deadline. Refresh trang không kéo dài hold.
Lỗi tạo phiên provider sau khi DB commit phải cho retry bằng cùng key/payment,
không để giao dịch DB mở trong lúc gọi mạng.

Các khóa phải chặn cả booking mới tiêu thụ capacity lẫn thao tác phân công chính
kho vật lý đó cho khách khác. Hold loại kho đơn thuần chưa bảo đảm được điều này.

### 4.3. Xác minh thanh toán và áp dụng

Chỉ webhook/reconciliation được xác minh mới quyết định đã thu tiền; redirect
thành công ở frontend không có quyền cập nhật kỳ thuê.

Trong một transaction:

1. Xác minh event, nguồn payment, số tiền, tiền tệ và chống xử lý lặp.
2. Khóa các bản ghi theo cùng thứ tự với checkout/capacity/return có liên quan.
3. Kiểm tra rental còn ACTIVE, chưa hết hạn thực tế, vẫn có `endAt = oldEndAt`,
   cùng kho và chưa bị luồng trả kho hoặc booking khác chiếm trước.
4. Kiểm tra thời điểm nhận tiền hợp lệ theo mục 5.
5. Chuyển payment sang SUCCEEDED, cập nhật `rental.endAt = newEndAt`, ghi nhận
   yêu cầu APPLIED và thời điểm áp dụng.
6. Đồng bộ nguồn dữ liệu chiếm dụng kho; kết thúc hold mà không đếm hai lần cùng
   một kỳ gia hạn. Commit toàn bộ hoặc rollback toàn bộ.

Giữ nguyên rental ID, startAt, kho đang thuê, booking/reservation ban đầu và các
snapshot giá/kỳ đầu. Không ghi đè hợp đồng hoặc payment gốc.

### 4.4. Hết hold và thanh toán không áp dụng được

- Hết hold chưa trả tiền: không gia hạn; capacity được giải phóng. Truy vấn phải
  bỏ qua hold hết hạn ngay cả khi cron chưa chạy.
- Báo giá hết hạn: tạo báo giá mới, lấy giá hiện hành mới và key mới.
- Đã thu tiền nhưng không áp dụng được: không cộng kỳ; chuyển sang kết quả
  REFUND_REQUIRED và payment REFUND_PENDING, lưu lý do và số tiền phải hoàn.
- Dùng quy trình hoàn tiền có kiểm soát hiện tại sau khi bổ sung nguồn gia hạn;
  không coi hoàn tiền cọc và hoàn một khoản thu gia hạn là cùng giao dịch.

## 5. Quy tắc deadline và webhook đến muộn — đề xuất cần thống nhất

Tạo báo giá/checkout dùng thời điểm server hiện tại và cutoff đã snapshot. Callback
không chỉ dùng `now < cutoffAt`, vì webhook có thể đến sau khi khách đã trả đúng hạn.

| Tình huống | Xử lý đề xuất |
| --- | --- |
| Provider xác nhận nhận tiền trước `payment.expiresAt`, callback đến trong hạn | Áp dụng nếu các điều kiện rental/capacity còn đạt |
| Nhận tiền đúng hạn nhưng callback đến muộn | Kiểm tra lại; chỉ áp dụng nếu rental còn hiệu lực, chưa trả và không có cam kết cạnh tranh |
| Nhận tiền tại hoặc sau deadline | Không áp dụng; xử lý hoàn tiền |
| Hold đã hết, capacity/kho đã được giao dịch khác chiếm | Không áp dụng dù khách trả đúng hạn; xử lý hoàn tiền |
| Rental đã đóng hoặc đã hết hạn thực tế trước lúc xử lý | Không tự khôi phục kỳ thuê; xử lý hoàn tiền |
| Event xác thực nhưng không có paidAt đáng tin cậy và đến sau deadline | Reconcile/xử lý có kiểm soát; không tự suy ra khách đã trả đúng hạn |

Quy ước so sánh đề xuất là `paidAt < expiresAt`; đúng tại deadline được xem là hết
hạn. Dữ liệu paidAt phải đến từ provider đã xác minh, không nhận từ request Customer.
DTO event hiện có paidAt tùy chọn nên phải xử lý nhánh thiếu dữ liệu rõ ràng.

Webhook lặp cùng một giao dịch phải trả kết quả đã lưu, không cộng kỳ thêm. Nếu
thực tế có khoản chuyển tiền thứ hai khác giao dịch đầu, không được chỉ bỏ qua
như replay: cần ghi nhận để đối soát/hoàn khoản thu dư theo khả năng provider.

## 6. Thiết kế dữ liệu tối thiểu đề xuất

### 6.1. System settings

Thêm key `RENEWAL_NOTICE_DAYS`, default 7, unit DAYS, quyền quản lý BOM.
Tách khỏi `EXPIRY_REMINDER_DAYS`: nhắc hạn và hạn chót gia hạn là hai nghiệp vụ.
Đề xuất validation số nguyên không âm theo pattern day settings hiện có; nếu cho
phép 0 thì nghĩa là chỉ cần trước endAt. BOM chưa xác nhận riêng trường hợp 0.

Tái sử dụng GET/PUT/history hiện tại, expectedVersion, audit và seed không ghi đè
cấu hình đã có. Snapshot giá trị/version vào báo giá; thiếu setting phải báo lỗi
cấu hình, không lặng lẽ dùng default ở runtime.

### 6.2. Một bảng yêu cầu/lịch sử gia hạn

Đề xuất `rental_renewals` giữ cả báo giá, kỳ thuê đã chốt và kết quả xử lý:

| Nhóm | Dữ liệu tối thiểu |
| --- | --- |
| Định danh | id, rentalId, storageUnitId snapshot, idempotencyKey |
| Kỳ thuê | oldEndAt, newEndAt, months |
| Giá | monthlyRateSnapshot, amount, currency VND |
| Deadline | noticeDaysSnapshot, settingVersionSnapshot, cutoffAt, expiresAt |
| Kết quả | status, appliedAt, failureReason |
| Thời gian | createdAt, updatedAt |

Trạng thái lưu đề xuất: QUOTED, PENDING_PAYMENT, APPLIED, REFUND_REQUIRED.
EXPIRED là trạng thái trả ra API khi QUOTED/PENDING_PAYMENT đã quá expiresAt mà
chưa ghi nhận tiền; không cần job mới chỉ để đổi trạng thái báo giá.

Ràng buộc phải bảo vệ được: số tháng hợp lệ; amount khớp rate × months; newEndAt
khớp kỳ gia hạn; expiresAt không vượt cutoffAt; APPLIED có appliedAt; cùng rental
và key không tạo hai yêu cầu; cùng rental/oldEndAt không APPLIED hai lần.

Không cần thêm rental version chỉ cho tính năng này: khóa rental và so sánh
oldEndAt đủ phát hiện kỳ đã thay đổi trong phạm vi gia hạn cùng kho. Khi cập nhật
phải kiểm tra cả status và kho, không chỉ so sánh endAt.

### 6.3. Liên kết payment và hold

- Đề xuất thêm `payments.renewalId` FK đến yêu cầu gia hạn. Một CHARGE có đúng một
  nguồn booking, reservation hoặc renewal; không gán payment gia hạn vào booking
  gốc để lách ràng buộc hiện tại.
- Giữ `payments.rentalId` theo ngữ nghĩa hiện tại cho hoàn cọc; rental của khoản
  thu gia hạn suy ra qua renewalId, không lưu thêm một liên kết nguồn trùng lặp.
- Phiên bản đầu đề xuất một CHARGE cho mỗi renewal. Retry cùng phiên dùng lại
  payment; hết phiên thì tạo yêu cầu mới, không cần bảng payment-attempt riêng.
- Mở rộng refund reason và truy vấn quyền sở hữu/refund/status cho nguồn gia hạn.
- Tái sử dụng `capacity_allocations` loại HOLD, `referenceId = renewal.id`, deadline
  trùng payment. Quyền giữ **kho cụ thể** được xác định qua renewal.storageUnitId.
- Không chỉ thêm HOLD rồi giữ nguyên các truy vấn: phải cập nhật mọi writer/reader
  có thể phân công kho hoặc tiêu thụ capacity để nhận biết nguồn renewal.

Schema backend dùng TypeScript enum, enumToPgEnum, camelCase, casing snake_case.
Cập nhật [DB diagram](./db-diagram.md) cùng schema; sinh migration bằng
`bun run db:generate`, không chỉnh SQL sinh ra. Không phục hồi sáu bảng rental cũ.

## 7. Capacity và transaction: điều kiện bắt buộc

1. Kiểm tra đúng khoảng gia hạn `[oldEndAt, newEndAt)`, không dùng số kho trống
   hiện tại làm kết luận cho cả kỳ tương lai.
2. Xét cả cam kết của loại kho và assignment của đúng kho; giữ nguyên ưu tiên cho
   các cam kết hợp lệ đã có. Booking và gia hạn cạnh tranh phải được tuần tự hóa.
3. Không đếm rental hiện tại như một khách khác; không đếm hai lần assignment và
   allocation của cùng một booking/reservation, hoặc hold và kỳ gia hạn đã áp dụng.
4. Occupancy sau gia hạn phải đọc endAt hiện tại của rental. Các truy vấn còn lấy
   rentalEndAt của booking/reservation ban đầu phải được điều chỉnh đúng nguồn;
   không sửa snapshot kỳ đầu để làm availability chạy được.
5. Hold checkout phải bảo vệ cả việc đặt capacity mới và việc FM phân công kho cụ thể.
6. Gia hạn và bắt đầu trả kho phải khóa cùng rental. Đề xuất khi đang có payment
   gia hạn chờ xử lý thì chặn mở luồng CHECK_OUT mới, trả lý do rõ ràng; hết phiên
   hoặc xử lý xong mới tiếp tục. Chiều ngược lại cũng chặn gia hạn.
7. Không làm race giữa cron hết hold và callback. Callback không được coi một hold
   vừa hết hạn là cam kết còn hiệu lực; có thể áp dụng muộn chỉ sau kiểm tra ở mục 5.

Hiện checkout reservation có thứ tự reservation → payment → offering → hold;
assignment/return có khóa rental/kho riêng. Khi triển khai phải thống nhất thứ tự
khóa cho các đường giao nhau, không tùy tiện đảo thứ tự hoặc tạo một mutex chỉ
được dùng bởi renewal. Kiểm thử cạnh tranh là tiêu chí nghiệm thu, không chỉ đọc code.

## 8. API đề xuất cho Customer

Đây là **contract dự kiến**, chưa phải endpoint đang có. Shared Zod schemas/types
là nguồn cho route và api-client; Swagger sinh theo pattern hiện tại.

| Method/path | Input | Kết quả và tác dụng |
| --- | --- | --- |
| POST `/api/rentals/:rentalId/renewals` | `{ months, idempotencyKey }` | 201 báo giá đã lưu; chưa giữ capacity |
| GET `/api/rentals/:rentalId/renewals` | limit/offset theo DTO phân trang chung | 200 lịch sử của rental, mới nhất trước |
| GET `/api/rentals/:rentalId/renewals/:renewalId` | UUID params | 200 chi tiết snapshot, effective status và paymentId nếu có |
| POST `/api/rentals/:rentalId/renewals/:renewalId/payments` | `{ idempotencyKey }` | 201 phiên checkout; tạo payment và hold hoặc dùng lại phiên còn hiệu lực |

Tiếp tục dùng GET `/api/payments/:paymentId/status` để theo dõi tiền. Sau thành
công, đọc lại renewal và rental: chỉ `renewal.status = APPLIED` xác nhận hạn mới.
Không thêm endpoint Customer tự cập nhật endAt, tự xác nhận thanh toán hoặc FM
duyệt một yêu cầu đã hợp lệ. Chưa cần endpoint accept điều khoản riêng trong MVP.

Báo giá/chi tiết trả tối thiểu: id, rentalId, status, months, oldEndAt, newEndAt,
monthlyRateSnapshot, amount, currency, cutoffAt, expiresAt, createdAt, appliedAt,
failureReason và paymentId nếu có. Tiền dùng cùng quy ước string VND của contracts;
frontend không tính lại số tiền làm nguồn thanh toán.

Có thể bổ sung vào rental detail thông tin điều kiện sơ bộ: eligible, reason,
noticeDays, cutoffAt. Điều kiện này không cam kết capacity cho số tháng chưa chọn;
quyết định cuối thuộc bước báo giá và checkout.

Quyền: Customer ACTIVE, đúng owner theo rentals.userId. Backend suy ra facility,
không yêu cầu Customer gửi facilityId/userId. Không tồn tại/sai owner trả 404;
không có session 401; sai role 403; params/body không hợp lệ 400. Private/no-store.

Các lỗi 409 phải có message cụ thể theo nguyên nhân:

| Nguyên nhân | Message gợi ý |
| --- | --- |
| Sau cutoff | Đã qua hạn yêu cầu gia hạn của kỳ thuê này. |
| Rental hết hạn/đóng | Kỳ thuê đã hết hạn hoặc đã kết thúc, không thể gia hạn. |
| Có lịch trả/inspection | Bạn đang có yêu cầu trả kho. Hãy xử lý yêu cầu đó trước khi gia hạn. |
| Kho đã có cam kết tiếp theo | Kho đang thuê đã được cam kết cho lịch khác trong khoảng gia hạn. |
| Thiếu capacity | Không còn đủ kho cho khoảng thời gian gia hạn đã chọn. |
| Báo giá hết hạn | Báo giá đã hết hạn. Vui lòng lấy báo giá mới. |
| Kỳ/kho thay đổi | Thông tin kỳ thuê đã thay đổi. Vui lòng tải lại trước khi gia hạn. |
| Đang có payment | Đã có phiên thanh toán gia hạn đang chờ xử lý. |
| Key dùng cho dữ liệu khác | Mã yêu cầu đã được sử dụng cho nội dung khác. |

Giữ envelope lỗi hiện tại; không thay error.code HTTP bằng một enum nghiệp vụ mới
mà chưa cập nhật shared contract. Lỗi provider/cấu hình phải tách khỏi xung đột
nghiệp vụ, không trả một message 409 chung cho mọi trường hợp.

## 9. Nơi cần sửa khi triển khai

| Workspace/module | Trách nhiệm |
| --- | --- |
| packages/database | Bảng gia hạn, liên kết payment, ràng buộc/index/enum, exports, seed setting, migration và diagram |
| packages/contracts | Schema/type gia hạn, DTO/history, message, setting catalog/role, payment source/refund liên quan, exports |
| apps/api/modules/rentals | Bổ sung orchestration trong service hiện tại, persistence trong repository và các route gia hạn |
| apps/api/modules/payments | Tạo checkout cho renewal, dispatch webhook/reconcile theo nguồn, status/ownership, hoàn tiền và hold |
| apps/api/modules/storage-units | Capacity/assignment cho khoảng gia hạn; bảo vệ kho cụ thể; đọc kỳ hiện tại của rental |
| apps/api/modules/appointments và inspections | Chặn xung đột với gia hạn đang chờ và dùng cùng khóa rental |
| apps/api/modules/system-settings | Tái sử dụng service/route/history cho key mới |
| packages/api-client | Methods typed cho báo giá, checkout, đọc kết quả và lịch sử |
| apps/web | Customer rental detail/checkout/lịch sử; BOM chỉnh số ngày trên UI settings phù hợp hiện có |
| apps/mobile | Customer chọn tháng, báo giá, checkout, khôi phục trạng thái và lịch sử qua client chung |
| API/worker notifications | Kiểm tra reader đang dùng hạn cũ; nếu nhắc hạn hoạt động thì loại thông báo cũ sau gia hạn |

Không tách thêm service chỉ vì file dài. Route chỉ validate/gọi service, repository
chỉ truy vấn/ghi DB; điều phối payment/capacity/return thuộc service. Không thêm
dependency, generic repository hoặc hệ thống ledger/charge tổng quát cho scope này.

## 10. Trải nghiệm Customer và BOM

- Customer thấy hạn hiện tại và hạn chót yêu cầu; nếu không đủ điều kiện thì có lý do.
- Sau chọn số tháng, hiển thị hạn mới, giá tháng hiện hành, tổng tiền, deadline,
  điều kiện giữ nguyên cọc nếu chọn mặc định đó và nút thanh toán.
- Checkout có đếm ngược theo expiresAt server; refresh lấy lại phiên hiện có.
- Hiển thị rõ đang chờ xác nhận, đã gia hạn, đã hết phiên hoặc đã nhận tiền nhưng
  đang chờ hoàn. Không báo gia hạn thành công chỉ từ redirect/payment screen.
- Thành công thì tải lại rental, lịch sử gia hạn và lịch sử giao dịch; khách có
  thể mở lại yêu cầu trước đó để xem kết quả.
- BOM sửa RENEWAL_NOTICE_DAYS qua settings có version/audit; UI giải thích ảnh
  hưởng lên báo giá mới. Không dùng chung giá trị này với ngày gửi nhắc hạn.

## 11. Thứ tự triển khai và tiêu chí nghiệm thu

Thực hiện theo thứ tự: chốt các mặc định ở mục 2/5 → shared contracts/schema và
migration → capacity/return guards → báo giá/checkout → webhook/reconcile/apply
và hoàn tiền → api-client/Web/Mobile/BOM → kiểm thử và tài liệu API thực tế.

Các trường hợp phải có bằng chứng kiểm thử khi implement:

1. Trước cutoff một thời điểm nhỏ: thành công; tại/sau cutoff: từ chối.
2. Setting BOM đổi đúng quyền/version; không làm đổi báo giá còn hiệu lực.
3. Giá hiện hành thay đổi: quote mới lấy giá mới, phiên cũ còn hạn giữ giá cũ.
4. Tính số tháng/tiền/hạn mới đúng, overflow bị từ chối, không thu lại cọc nếu
   đã chọn mặc định giữ cọc.
5. Không có capacity hoặc kho cụ thể xung đột: từ chối đúng lý do.
6. Trong hold, booking/assignment cạnh tranh không chiếm được cùng cam kết;
   hết hold thì sử dụng lại được capacity đúng thời điểm.
7. Tạo quote/payment lặp cùng key không tạo trùng; khác payload cùng key bị chặn.
8. Hai checkout gia hạn đồng thời trên một rental: chỉ một phiên được giữ.
9. Webhook/reconciliation lặp hoặc chạy đồng thời: chỉ cộng kỳ/ghi thu một lần.
10. Sai amount/currency/payment nguồn, event giả hoặc Customer sửa giá không thể áp dụng.
11. Webhook muộn, thiếu paidAt, trả sau deadline, hold hết và capacity bị chiếm:
    kết quả đúng mục 5; không mất dấu tiền đã nhận.
12. Gia hạn cạnh tranh với trả kho, đóng rental và cron hết hold: không có hai
    trạng thái mâu thuẫn, rollback giữ tiền/kỳ/hold nhất quán.
13. Lịch sử và quyền sở hữu đúng cho cả rental gốc bookingId và reservationId;
    Customer khác không xem/thanh toán được; FM không vượt scope cơ sở.
14. Sau gia hạn, mọi nguồn availability/lịch sử/UI đọc đúng hạn mới; booking,
    hợp đồng, kỳ đầu và cọc cũ vẫn giữ đúng snapshot.
15. Web/Mobile khôi phục phiên khi refresh/quay lại, nhận diện APPLIED và
    REFUND_REQUIRED; BOM không sửa được setting ngoài quyền của mình.
16. Migration không làm mất payment/hoàn cọc/rental hiện có; checkout reservation
    và luồng trả kho hiện tại không bị thay đổi hợp đồng ngoài phần cần tích hợp.

Tiêu chí hoàn tất: Customer gia hạn được xuyên suốt từ báo giá đến payment xác
minh và endAt mới, capacity không bán trùng, retry không cộng kỳ hai lần, mọi khoản
thu không áp dụng đều có trạng thái đối soát/hoàn tiền; API/DB/UI và lịch sử khớp nhau.

## 12. Ranh giới và trạng thái của tài liệu

Backend triển khai theo route và schema trong source; migration 0017/0018 là
additive và cần được chạy theo quy trình database thông thường. Tài liệu này không
chứng minh giao dịch provider thực tế; endpoint/client/UI ngoài backend chưa được
triển khai.

Không mặc định kế thừa bypass thời gian của check-in/check-out sang gia hạn:
gia hạn liên quan tiền và cutoff riêng; nếu cần chế độ demo phải xác định riêng.

Không mở rộng sang tự chuyển kho, tự gia hạn/thu tiền định kỳ, trả góp, công nợ,
override giá, phê duyệt ngoại lệ, ví tiền hoặc ký phụ lục trong phiên bản này.
Các quyết định về cọc, thời lượng/giới hạn tháng, lịch trả, deadline thanh toán và
webhook muộn ở mục 2/5 cần được xác nhận trước khi đưa thành chính sách runtime.
