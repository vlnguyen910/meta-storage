# Booking cancellation, refund, reschedule, and no-show policy

**Status:** Chốt cho customer-initiated cancellation và no-show tại [issue #13](https://github.com/vlnguyen910/storeX/issues/13#issuecomment-5828665066).

**Traceability:** R5/R6, UC-SC-05, UC-SC-06.

**Phạm vi:** Booking đã thanh toán nhưng chưa check-in; rental sau handover thuộc Rental return/termination flow.

## Quy tắc đã chốt

### Đặt trước và giữ chỗ

- Ngày nhận kho sớm nhất là **ngày mai theo giờ Việt Nam**, không cho tạo booking/payment mới trong ngày nhận kho. Customer có thể đặt check-in trước tối đa **30 ngày** (giới hạn tối đa chưa thuộc thay đổi này).
- Booking giữ capacity của **Unit Type trên toàn bộ rental date range**. Payment không giữ một Physical Unit cụ thể; không đánh dấu Physical Unit là `RESERVED` chỉ vì future Booking đã paid.
- Reschedule phải kiểm tra lại capacity cho **toàn bộ rental period mới**. Nếu không đủ capacity, yêu cầu thất bại và Booking cũ giữ nguyên.

### Customer cancellation sau payment

- Chỉ hủy Booking khi chưa `CHECKED_IN` và Rental chưa active. Sau check-in/handover, việc kết thúc thuê thuộc Rental return/termination flow.
- Khi customer hủy Booking `CONFIRMED`, chuyển sang `CANCELLED`, hoàn **rental fee đã thanh toán** và mất **toàn bộ deposit**. Khi cancellation hoàn tất, release capacity Unit Type đã reserve.
- `REFUNDED` và `DEPOSIT_FORFEITED` là trạng thái/kết quả của payment/refund, không phải Booking status.

### Reschedule

- Chỉ Booking `CONFIRMED` được reschedule. Customer self-service phải gửi yêu cầu **ít nhất 24 giờ trước check-in slot**.
- Tối đa **2 lần reschedule cho mỗi Booking**.
- Chỉ thay đổi check-in date/time; Facility, Unit Type và duration giữ nguyên.
- Nếu reschedule thành công, Booking vẫn `CONFIRMED`, tăng `rescheduleCount`, lưu audit/history và giữ nguyên giá đã thanh toán vì Unit Type và duration không đổi.
- Nếu không đủ capacity cho rental period mới, Booking cũ giữ nguyên.

### No-show

- Hạn check-in kết thúc tại **giờ kết thúc slot cuối cùng của ngày nhận kho** (Asia/Ho_Chi_Minh); thay thế grace period 2 giờ trước đây. Khách bỏ lỡ slot đã chọn vẫn có thể check-in muộn hơn trong cùng ngày sau khi payment thành công và manager đã gán kho.
- Khi hết grace period mà Booking vẫn `CONFIRMED` và chưa check-in, chuyển `CONFIRMED → NO_SHOW`.
- No-show hoàn rental fee đã thanh toán, mất toàn bộ deposit và release reserved Unit Type capacity.
- `NO_SHOW` là terminal Booking state.

## Booking state transitions trong phạm vi policy này

| Trạng thái hiện tại | Sự kiện / điều kiện | Trạng thái tiếp theo | Kết quả |
| --- | --- | --- | --- |
| `CONFIRMED` | Customer hủy trước check-in, Rental chưa active | `CANCELLED` | Hoàn rental fee, mất deposit, release capacity |
| `CONFIRMED` | Đã tới giờ kết thúc slot cuối ngày và chưa check-in | `NO_SHOW` | Hoàn rental fee, mất deposit, release capacity |
| `CONFIRMED` | Check-in/handover thành công | `CHECKED_IN` | Các bước tiếp theo thuộc Rental lifecycle |
| `CONFIRMED` | Reschedule hợp lệ và đủ capacity | `CONFIRMED` | Dời check-in slot, ghi history, giữ giá |

Booking lifecycle cần tối thiểu `CONFIRMED`, `CANCELLED`, `NO_SHOW`, `CHECKED_IN`. `NO_SHOW` không có transition tiếp theo. Không thêm Booking status cho refund, deposit forfeiture hoặc reschedule. Tên Paid/Confirmed cuối cùng thuộc quyết định domain [#12](https://github.com/vlnguyen910/storeX/issues/12).

## Test matrix cho lúc triển khai Booking/Payment backend

Các kịch bản dưới đây là acceptance cases; hiện chưa có Booking/Payment backend để chạy automated tests.

| Trường hợp | Đầu vào / tiền điều kiện | Kết quả cần kiểm thử |
| --- | --- | --- |
| Đặt trước đúng giới hạn | Check-in cách thời điểm đặt đúng 30 ngày | Được phép nếu các điều kiện đặt chỗ khác hợp lệ; capacity được giữ cho Unit Type trên toàn kỳ thuê |
| Đặt trước quá giới hạn | Check-in cách thời điểm đặt hơn 30 ngày | Từ chối |
| Hủy sau payment | Booking `CONFIRMED`, chưa check-in, Rental chưa active | `CANCELLED`; hoàn rental fee; mất toàn bộ deposit; release capacity |
| Hủy sau handover | Booking `CHECKED_IN` hoặc Rental đã active | Không thực hiện Booking cancellation; chuyển sang Rental return/termination flow |
| No-show trước hạn | Chưa check-in, chưa tới giờ kết thúc slot cuối ngày | Không chuyển `NO_SHOW` |
| No-show đúng/sau hạn | Booking còn `CONFIRMED`, chưa check-in, đã tới giờ kết thúc slot cuối ngày | `NO_SHOW`; hoàn rental fee; mất toàn bộ deposit; release capacity |
| Đã check-in | Booking đã `CHECKED_IN` khi đến hạn no-show | Không chuyển `NO_SHOW` |
| Reschedule hợp lệ | `CONFIRMED`, còn ít nhất 24 giờ, chưa vượt 2 lần, đủ capacity toàn kỳ mới | Đổi check-in date/time; giữ Facility, Unit Type, duration, giá và trạng thái `CONFIRMED`; ghi count/history |
| Reschedule quá muộn hoặc quá số lần | Dưới 24 giờ trước slot hoặc đã reschedule 2 lần | Từ chối; Booking cũ giữ nguyên |
| Reschedule sai trạng thái/thuộc tính | Không `CONFIRMED`, hoặc yêu cầu đổi Facility, Unit Type, duration | Từ chối; Booking cũ giữ nguyên |
| Reschedule thiếu capacity | Kỳ thuê mới không đủ Unit Type capacity | Từ chối; Booking cũ giữ nguyên |
| No-show terminal | Booking đã `NO_SHOW` | Không cho hủy, reschedule hoặc check-in Booking này |

## Ngoài phạm vi quyết định này

- Cancellation do METASTORAGE không thể cung cấp unit phù hợp hoặc customer từ chối unit tại check-in vẫn **TBD** tại [issue #26](https://github.com/vlnguyen910/storeX/issues/26). Không tự động áp dụng forfeiture deposit của customer-initiated cancellation cho các trường hợp đó.
- Tài liệu này chốt outcome nghiệp vụ, chưa chốt thời điểm/chi tiết kỹ thuật thực hiện refund qua payment provider.
- Chưa thay đổi database schema hoặc API contract. Booking/Payment implementation sẽ bổ sung state machine, `rescheduleCount`, history và payment/refund state theo policy này. `ReservationStatus` hiện tại trong shared contract phục vụ reservation flow mẫu, không phải Booking state machine cuối cùng.
