# Kế hoạch UI gia hạn kỳ thuê — Web responsive

Ngày lập: 2026-10-30.

Trạng thái: **Kế hoạch, chưa triển khai mã nguồn.**

Phạm vi đã xác nhận: Web Customer responsive, gồm desktop và trình duyệt điện thoại. React Native không thuộc đợt này.

## 1. Căn cứ và nguyên tắc

- Tuân thủ [AGENTS.md](./AGENTS.md), [DESIGN.md](./docs/DESIGN.md) và [web-patterns.md](./docs/web-patterns.md).
- Nghiệp vụ theo [đặc tả gia hạn hiện tại](./docs/rental-renewal-implementation.md). Không khôi phục endpoint hoặc chính sách lịch sử trong phần đã hết hiệu lực của `rental-renewal-api.md`.
- Tái sử dụng component, API client và shared contracts; không bổ sung dependency hoặc tầng trừu tượng khi chưa cần.
- Backend quyết định giá, số tiền, thời hạn và điều kiện gia hạn; frontend hiển thị kết quả và điều phối tương tác.
- Chỉ báo gia hạn thành công khi renewal có trạng thái `APPLIED`.

## 2. Điểm vào tại chi tiết kỳ thuê

Bổ sung khối “Gia hạn kỳ thuê” cạnh thông tin hạn thuê trong [RentalDetail](./apps/web/src/features/rentals/rental-detail.tsx):

- Ngày hết hạn hiện tại và hạn chót yêu cầu gia hạn.
- Nút **Gia hạn kỳ thuê**.
- Nếu có yêu cầu đang thanh toán: hiển thị trạng thái và đường dẫn xem yêu cầu đang xử lý.
- Nếu không được gia hạn: giải thích lý do, chẳng hạn đã qua hạn chót hoặc đang có lịch trả kho.

Frontend không tự lấy ngày hết hạn trừ cố định 7 ngày vì BOM có thể thay đổi cấu hình. Điều kiện hiển thị phải dựa trên thông tin backend cung cấp; kiểm tra capacity vẫn diễn ra theo thời lượng yêu cầu tại bước báo giá và thanh toán.

## 3. Trang gia hạn và luồng người dùng

Đề xuất đường dẫn `/customer/storage/[rentalId]/renew`, có `renewalId` khi đã tạo báo giá để tải lại trang vẫn đọc đúng yêu cầu.

Luồng chính:

**Chi tiết kỳ thuê → Chọn số tháng → Xem báo giá → Thanh toán SePay → Xác nhận kết quả.**

| Bước | Nội dung giao diện | Hành động chính |
| --- | --- | --- |
| Chọn thời lượng | Kho đang thuê, hạn hiện tại, số tháng 1–12; giải thích một tháng bằng 30 ngày | Xem báo giá |
| Kiểm tra báo giá | Đơn giá, số tháng, tổng tiền, hạn cũ → hạn mới, thời hạn thanh toán; giữ nguyên kho và cọc | Thanh toán |
| Chờ xác nhận | Mã thanh toán, số tiền, thời hạn, trạng thái xử lý | Kiểm tra trạng thái hoặc tiếp tục phiên còn hiệu lực |
| Hoàn tất | Hạn thuê mới, số tiền đã thanh toán, mã giao dịch | Về chi tiết kỳ thuê |

Chỉ tạo báo giá khi khách bấm nút. Đổi số tháng sau khi có báo giá phải yêu cầu báo giá mới; không tự sửa số tiền của báo giá cũ. Báo giá chưa giữ capacity; bước tạo phiên thanh toán mới thực hiện giữ theo backend.

## 4. Thiết kế responsive và accessibility

- Desktop: hai cột, nội dung thao tác bên trái và tóm tắt kỳ thuê/số tiền bên phải.
- Mobile: một cột; nút chính cố định cuối màn hình, chừa khoảng trống cho nội dung và safe area.
- Tái sử dụng màu primary, surface, trạng thái và component hiện có thông qua token; không thêm mã màu trực tiếp vào component.
- Space Grotesk cho tiêu đề/số tiền; Be Vietnam Pro cho nội dung.
- Nút và input cao tối thiểu 44px; khoảng cách theo hệ 8/16/24/32.
- Một hành động chính ở mỗi bước; trạng thái có chữ/icon, không chỉ phân biệt bằng màu.
- Có loading, lỗi mạng, dữ liệu trống, focus bàn phím và thông báo cho trình đọc màn hình.
- Hiển thị thời điểm nghiệp vụ theo `Asia/Ho_Chi_Minh`, không để múi giờ trình duyệt thay đổi cách diễn giải hạn chót.

## 5. Trạng thái và xử lý lỗi

| Trạng thái hệ thống | Nội dung khách nhìn thấy |
| --- | --- |
| `QUOTED` | Báo giá sẵn sàng; hiển thị thời hạn và nút thanh toán |
| `PENDING_PAYMENT` | Đang chờ thanh toán/xác nhận; không tạo thêm giao dịch |
| `APPLIED` | Gia hạn thành công; hiển thị hạn thuê mới |
| `EXPIRED` | Báo giá hết hiệu lực; có thể lấy báo giá mới nếu còn đủ điều kiện |
| `REFUND_REQUIRED` | Đã nhận tiền nhưng chưa gia hạn được; hạn thuê giữ nguyên, khoản tiền cần được hoàn |
| Payment `REFUNDED` | Đã hoàn tiền; hiển thị thông tin hoàn tiền backend cung cấp |

Không hiển thị trực tiếp tên enum cho khách. Tham số `status=success` khi quay về từ SePay hoặc riêng payment `SUCCEEDED` chưa đủ để kết luận gia hạn thành công.

Đồng hồ hết giờ chỉ ngăn tiếp tục thanh toán theo báo giá cũ; UI phải đọc lại backend trước khi kết luận kết quả. Không coi redirect hủy hoặc lỗi mạng là bằng chứng chưa thu tiền.

Xử lý rõ các trường hợp: phiên đăng nhập hết hạn, không có quyền/không tìm thấy rental, lịch trả kho đang mở, thiếu capacity, báo giá hết hạn, kỳ thuê thay đổi, idempotency conflict và provider tạm thời không khả dụng.

## 6. API sử dụng

Tất cả request đi qua API client tập trung.

| API | Mục đích |
| --- | --- |
| `POST /api/rentals/:rentalId/renewals` | Tạo báo giá |
| `GET /api/rentals/:rentalId/renewals` | Lịch sử gia hạn |
| `GET /api/rentals/:rentalId/renewals/:renewalId` | Chi tiết và kết quả gia hạn |
| `POST /api/rentals/:rentalId/renewals/:renewalId/payments` | Tạo/khôi phục phiên thanh toán |
| `GET /api/payments/:paymentId/status` | Đọc trạng thái thanh toán |

### Các điểm tích hợp cần hoàn thiện

1. **Thông tin hạn chót:** `RentalDetail` hiện chưa trả cutoff. Đề xuất bổ sung thông tin cửa sổ gia hạn vào API chi tiết hiện có, tránh tạo endpoint riêng. Capacity vẫn phải kiểm tra theo số tháng tại bước báo giá/thanh toán.
2. **Quay về từ SePay:** [gateway hiện tại](./apps/api/src/modules/payments/sepay.gateway.ts) đưa renewal về đường dẫn kết quả booking; [màn hình kết quả](./apps/web/src/features/reservations/payment-result-screen.tsx) hiện xử lý theo reservation. Bổ sung nhánh renewal và đủ định danh để đọc lại yêu cầu, đồng thời giữ luồng booking hiện tại hoạt động.
3. **Khôi phục phiên:** giữ idempotency key khi retry/tải lại trang, gắn theo tài khoản và yêu cầu. Backend hiện chỉ khôi phục phiên với cùng key. Khi triển khai phải xử lý rõ trường hợp mất key hoặc mở thiết bị khác; không tự tạo giao dịch mới để né phiên đang chờ. Dữ liệu lưu ở trình duyệt không thay thế trạng thái, giá hoặc thời hạn từ server.

## 7. Module và dữ liệu dự kiến thay đổi

| Phần | Thay đổi dự kiến |
| --- | --- |
| `apps/web/src/features/rentals` | Form gia hạn, báo giá, trạng thái, lịch sử và hooks |
| Customer routes/screens | Trang gia hạn và điều hướng kết quả, theo cấu trúc route/screen của dự án |
| `rentals.messages.ts` hoặc file messages cạnh tính năng | Nhãn, hướng dẫn, lỗi và thông báo mới |
| `packages/api-client` | Bổ sung phương thức gọi API renewal |
| `packages/contracts` | Tái sử dụng schema renewal; bổ sung thông tin cutoff nếu triển khai |
| Rentals service / payment gateway | Cấp thông tin cần cho UI và sửa đường quay về thanh toán |

Phân tách state:

- TanStack Query quản lý dữ liệu server và mutation.
- React Hook Form + Zod quản lý form.
- Chỉ dùng Zustand nếu thực sự có client state cần chia sẻ; không thêm store riêng mặc định.
- Workflow nằm trong hooks/service phù hợp; component tập trung trình bày và tương tác.

Khi `APPLIED`, cập nhật lại chi tiết/danh sách kỳ thuê, lịch sử gia hạn và thanh toán. Các query và dữ liệu khôi phục phiên phải phân biệt tài khoản, tránh hiển thị dữ liệu phiên đăng nhập trước.

**Không dự kiến thêm bảng hoặc entity mới cho phần UI.** Rental, renewal, payment và allocation tiếp tục do workflow backend hiện có quản lý. UI không tự cập nhật hạn thuê hoặc trạng thái thanh toán.

## 8. Thứ tự triển khai

1. Hoàn thiện contract/client, thông tin cutoff và đường quay về thanh toán; xác định cách khôi phục phiên khi mất key.
2. Thêm điểm vào tại chi tiết kỳ thuê, form chọn thời lượng và báo giá.
3. Tích hợp checkout, khôi phục phiên và kết quả thanh toán/gia hạn.
4. Bổ sung lịch sử gia hạn tại chi tiết kỳ thuê, có phân trang theo API.
5. Hoàn thiện responsive, accessibility và các trạng thái lỗi.
6. Kiểm thử xuyên suốt và hồi quy luồng booking checkout hiện tại.

## 9. Kế hoạch kiểm thử và tiêu chí nghiệm thu

| Nhóm | Tình huống và kết quả mong đợi |
| --- | --- |
| Luồng thành công | Báo giá → thanh toán → renewal `APPLIED`; hiển thị hạn mới và cập nhật các màn liên quan |
| Snapshot báo giá | Số tiền và thời hạn khớp backend; đổi số tháng phải lấy báo giá mới |
| Retry và bấm lặp | Bấm hai lần, mất mạng, reload không tạo thêm payment hoặc kéo dài deadline |
| Tiếp tục phiên | Có thể đọc lại yêu cầu sau reload; trường hợp mất key/đổi thiết bị có hành vi rõ ràng, không tạo payment trùng |
| Hết hạn | Dừng thanh toán báo giá cũ; đọc lại trạng thái server và chỉ cho lấy báo giá mới khi hợp lệ |
| Điều kiện gia hạn | Hiển thị đúng lý do bị chặn bởi cutoff, lịch trả kho, thay đổi rental hoặc capacity |
| Callback chậm | Không báo thành công từ redirect; chờ kết quả backend |
| Tiền đến muộn | Hiển thị chưa gia hạn và cần hoàn tiền; hạn thuê không đổi |
| Hoàn tiền | Hiển thị kết quả hoàn tiền theo payment, không nhầm với gia hạn thành công |
| Quyền truy cập | Không đọc được rental/renewal/payment của tài khoản khác; đăng nhập lại không lẫn cache |
| Responsive | Kiểm tra viewport 360/390/768/1280px; không tràn ngang hoặc bị nút cố định che nội dung |
| Accessibility | Thao tác được bằng bàn phím, focus rõ, nhãn đầy đủ, tương phản và thông báo trạng thái phù hợp |
| Hồi quy | Booking checkout và màn hình kết quả reservation hiện có vẫn hoạt động |

Kiểm chứng lại capacity khi gia hạn chính kho đang thuê trước khi phát hành, đặc biệt trường hợp không còn kho trống dự phòng. Không coi lỗi từng ghi nhận trước đây là đã được giải quyết khi chưa chạy lại kiểm thử trên mã hiện tại.

## 10. Giới hạn và rủi ro cần theo dõi

- Đây là kế hoạch; chưa triển khai UI, chạy ứng dụng hoặc kiểm thử cho thay đổi đề xuất.
- Không mở rộng sang React Native, giao diện quản trị hoàn tiền, đổi kho hoặc quy trình ngoại lệ FM.
- Các mặc định nghiệp vụ được tài liệu triển khai đánh dấu là đề xuất không tự trở thành chính sách đã được xác nhận chỉ vì được hiển thị trên UI.
- Trước khi phát hành cần kiểm chứng capacity của chính kho đang thuê, đường quay về SePay và cách khôi phục thanh toán khi mất idempotency key.

## 11. Ghi nhận triển khai ngày 2026-10-30

Đã bổ sung trang gia hạn responsive, điểm vào và lịch sử tại chi tiết kỳ thuê, API client renewal, hooks/form/messages, thông tin cửa sổ gia hạn từ backend và đường quay về renewal từ SePay. Tiếp tục phiên còn hiệu lực dùng checkout session từ API trạng thái payment hiện có, hỗ trợ trường hợp mất idempotency key của trình duyệt.

Ảnh kiểm tra và hướng dẫn E2E thủ công: [artifacts/rental-renewal-ui/README.md](./artifacts/rental-renewal-ui/README.md). Ảnh dùng fixture, không xác nhận tích hợp thanh toán thật. Không dùng Playwright. Chưa xác minh lại capacity của chính kho đang thuê; cần kiểm tra theo danh sách nghiệm thu trước phát hành.
