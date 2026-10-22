# Prompt Stitch: Web Flow 3 — trả kho

Nguồn: [issue #139](https://github.com/vlnguyen910/metastorage/issues/139).
Đây là prompt thiết kế WEB DESKTOP; không yêu cầu tạo app mobile.
Chạy prompt chung trước, rồi gửi từng prompt màn bên dưới để dễ duyệt.
Các đoạn ghi “chưa có dữ liệu” là yêu cầu trạng thái UI, không phải giả lập thành công.

## Prompt chung — gửi trước

```text
Tiếp tục project StoreX hiện tại. Thiết kế WEB DESKTOP cho Flow 3: quản lý kho đang
thuê và quy trình trả kho. Device metadata phải DESKTOP, viewport thiết kế 1440 CSS px.
Không tạo màn MOBILE/390px. Responsive web là yêu cầu co giãn của cùng màn web,
không phải React Native app mới.

Dùng lại design system, logo, font và sidebar/header StoreX hiện có:
- Nền trang #FAF8FF; chữ chính #131B2E; CTA xanh #125345 / #003B2F.
- Card trắng, border rõ 1px #BFCAC4, radius 4px, shadow nhẹ.
- Space Grotesk cho heading; Be Vietnam Pro cho body.
- Nội dung tiếng Việt tự nhiên: “ô kho”, “người thuê”, “yêu cầu trả kho”,
  “thời điểm thực nhận”, “quyết toán”. Tránh jargon kỹ thuật trên UI.
- Layout gọn, thông tin phục vụ quyết định; một CTA chính theo bước,
  các phần sâu dùng tab/accordion/sheet. Không làm dashboard nhiều KPI.
- Label rõ, keyboard focus, vùng bấm tối thiểu 44px, tương phản đọc được,
  lỗi cạnh field, giữ draft khi lỗi, loading/empty/error/success và giải thích nút khóa.
- Áp dụng 10 usability heuristics của Jakob Nielsen, đặc biệt visibility,
  consistency, error prevention/recovery và minimalist design.

Trước khi tạo hãy tìm và tái sử dụng các bản DESKTOP đúng trên canvas:
FM07 “Yêu cầu trả kho”, FM08 “Kiểm tra & hoàn tất trả kho”,
FS02 “Yêu cầu kiểm tra trả kho”, FS03 “Biên bản kiểm tra trả kho”, C07 “Chi tiết kho đang thuê”.
Nếu sửa màn cũ, giữ nguyên screen ID khi công cụ hỗ trợ; tránh sinh nhiều bản cùng tên.
Không sửa các màn Flow 1/2 hoặc BOM/Admin ngoài danh sách được yêu cầu.

Quy tắc nguồn sự thật:
1. Customer chỉ rental của mình; chỉ sửa/hủy yêu cầu PENDING.
2. PENDING chưa giữ lịch. FS được phân công xác nhận mới thành CONFIRMED.
3. Lịch trả lấy từ server: ca 90 phút, buffer 15 phút; Customer báo trước >=24h;
   ngày nghỉ/giờ hoạt động/timezone theo facility. Không hardcode danh sách ca.
4. FS chỉ công việc được giao; không phân công FS, không quyết toán, không chọn
   trạng thái ô kho, không nhập số tiền khấu trừ/hoàn cọc.
5. Inspection dùng checklist version từ server, bốn nhóm: tài sản còn lại,
   hiện trạng ô kho, vệ sinh/an toàn, bằng chứng. Severity không cho FS sửa.
6. Issue cần ghi chú và ảnh, tối đa 5 ảnh/inspection. Serious issue làm FAIL,
   minor issue có thể PASS kèm ghi nhận. Còn tài sản không tự làm FAIL nhưng phải
   có cách xử lý/lưu giữ/bàn giao và bằng chứng trước hoàn tất trả kho.
7. FS ghi giờ thực nhận riêng, có thể từ khi lịch CONFIRMED; không ép đợi PASS.
   Sửa giờ đã ghi phải là đề xuất có lý do/bằng chứng để FM duyệt.
8. PASS chỉ là kết quả kiểm tra; không tự đóng rental. FAIL chuyển yêu cầu FAILED,
   unit MAINTENANCE; kiểm tra lại là attempt mới, giữ lịch sử cũ.
9. FM đúng facility phân công FS, duyệt correction, damage/exception và quyết toán.
   Closure chỉ khi đã thực nhận, latest inspection PASS, tài sản xử lý xong và
   nghĩa vụ tài chính được xác định. Backend mới quyết định rental CLOSED/unit AVAILABLE.
10. Hoàn tiền độc lập với closure. FM chỉ “Xác nhận đã chuyển khoản hoàn tiền”
    sau chuyển khoản thủ công hoàn tất, có reference và evidence. Không có API refund
    tự động, không có nút “Hoàn tiền ngay”/“Hoàn cọc 100%”. Nợ chỉ ghi sổ.
11. Số tiền/phí/cọc/rate/đến hạn hoàn/revision là dữ liệu server; không tự tính công
    thức, không gắn tỷ lệ giảm giá. Nếu thiếu dữ liệu review, ghi “Chưa xác định” và
    giải thích nút duyệt chưa khả dụng. Dữ liệu minh họa phải liên kết nhất quán.
12. Guest magic-link portal chỉ đọc rental/payments/issued contracts đúng booking;
    không có nút tạo/sửa/hủy yêu cầu trả kho trong phiên guest.

Phải bỏ nội dung sai của các bản thiết kế cũ:
- Không thêm vai trò Kế toán/Kế toán trưởng hoặc chuyển FM settlement sang Kế toán.
- Không để FM làm checklist thay FS; không cho FS nhập “khấu trừ đề xuất”.
- Không CCCD/hộ chiếu, RFID/NFC/PIN, khóa tự động/QR mở cửa, IoT/độ ẩm/camera AI.
- Không hợp đồng 18 tháng; thời hạn thuê hệ thống hiện tại 1–12 tháng.
- Không e-sign, xuất VAT, so sánh baseline tự động, thanh lý tài sản, renewal/upgrade.
- Không sidebar quyền quản lý unit/nhân viên/báo cáo cho FS.
- Không hiện UUID kỹ thuật dài, công thức/backend status enum hoặc cảnh báo TBD
  từ tài liệu phát triển trên giao diện người dùng.

Luồng cần liên kết: Customer gửi yêu cầu → FM phân công → FS xác nhận lịch →
FS ghi thực nhận và kiểm tra → FM quyết toán/đóng rental → theo dõi hoàn tiền riêng.
Mỗi workspace có biến thể loading/error/empty/stale conflict và phiên bản có dữ liệu.
Chỉ tạo màn được yêu cầu trong prompt tiếp theo, không tự sinh thêm module.
```

## 1. Customer — sheet tạo/sửa lịch + chi tiết theo dõi

```text
Thiết kế hoặc cập nhật C07 Rental Detail web để có mục “Trả kho”, và tạo workspace
F3-C-RET-DETAIL — Chi tiết yêu cầu trả kho — Customer.

Trong Rental Detail chỉ cần summary kho/facility/mã booking/hạn thuê/status,
tabs “Thông tin”, “Thanh toán”, “Hợp đồng”, “Trả kho”. Nút “Yêu cầu trả kho”
mở sheet: thông tin kho read-only, ngày bằng calendar, khung giờ server dạng radio
cards, lý do bắt buộc. Ghi ngắn “Vui lòng đặt lịch trước ít nhất 24 giờ” và
“Yêu cầu đang chờ xác nhận, lịch chưa được giữ”. Gửi thành công chỉ báo đã nhận
yêu cầu, chưa báo nhận kho/đóng thuê/hoàn cọc.

Chi tiết yêu cầu: status rõ, lịch hẹn và timezone, lịch sử mốc thực tế. Tách các mốc
xác nhận lịch, thực nhận kho, kết quả kiểm tra, hoàn tất trả kho và hoàn tiền.
Sửa lịch/hủy chỉ khi PENDING; hủy có confirmation. Sau xác nhận, bỏ các thao tác
không được phép và giải thích nếu cần. Có kết quả inspection/settlement đã công bố
ở dạng read-only; tiền được hoàn, đã hoàn, còn phải hoàn và nợ là các giá trị khác nhau.
Nếu rental CLOSED nhưng còn chờ refund, phải hiển thị đúng hai trạng thái này.

Tạo biến thể PENDING, CONFIRMED, FAILED/chờ kiểm tra lại và COMPLETED chờ hoàn tiền.
Không làm trang CRUD, không thêm yêu cầu đổi kho/renewal/upgrade.
```

## 2. FS — danh sách được giao và chi tiết xử lý

```text
Cập nhật FS02 web thành F3-FS-RET-LIST và thiết kế F3-FS-RET-DETAIL.
Giữ shell FS hiện có, chỉ có navigation hợp vai trò. Đây là FACILITY STAFF,
không dùng tên “Field Specialist”. Facility là context được phân quyền.

Danh sách chỉ request được phân công: lịch hẹn, mã yêu cầu/mã booking/ô kho khi
response cung cấp, status, cờ “Cần rà soát lịch” và nút “Xem công việc”.
Lọc trạng thái; không giả định có tổng số hoặc search toàn hệ thống.

Chi tiết: summary tối thiểu, lịch hẹn, thông tin FS được giao, timeline.
PENDING có CTA “Xác nhận lịch”; gặp slot conflict phải giữ thông tin và tải lịch mới.
CONFIRMED có “Bắt đầu kiểm tra”; FAILED có “Kiểm tra lại” tạo attempt mới.
Ghi nhận ngày giờ thực nhận là dialog riêng: timezone, giờ thực tế, lý do, xác nhận;
không tự ghi giờ bằng việc bấm bắt đầu inspection. Nếu đã ghi giờ, chỉ có
“Đề xuất điều chỉnh thời gian”: giờ hiện tại/đề xuất, lý do và bằng chứng.

Hiển thị attempt cũ read-only. Sau PASS ghi “Đã kiểm tra — chờ quyết toán”, không
“Hoàn tất trả kho”. Không hiện nút duyệt phí/hoàn tiền/phân công nhân viên.
```


## Khi cần phần My Storage/config/mobile của toàn issue

- My Storage list/detail/payment/contract dùng lại màn hiện có, không nhân bản.
- Admin checklist/calendar/settings và BOM overdue-rate thiết kế thành đợt riêng.
- Mobile native sẽ có prompt riêng cho Customer/FS sau khi duyệt Web;
  không yêu cầu Stitch tạo phiên bản mobile trong đợt Web này.
