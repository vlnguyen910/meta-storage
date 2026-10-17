# Flow 4 — báo cáo phục vụ điều hành

Backend chỉ đọc, dùng dữ liệu PostgreSQL thật. Không sửa dashboard mock/web,
không xây kế toán, không thêm phí hoặc workflow duyệt/chuyển tiền.
Không cần migration mới ngoài migration giá/cọc của phần trước.

## Người quản lý cần trả lời câu hỏi gì?

| Câu hỏi | Dữ liệu/API và việc có thể làm tiếp |
|---|---|
| Kỳ này đã thu bao nhiêu, đã hoàn bao nhiêu? | Revenue: tiền thực thu, tiền thuê, cọc, hoàn và dòng tiền ròng; lọc kỳ/cơ sở/loại kho |
| Cơ sở nào đang ít khai thác? | Overview/utilization: cơ sở có tỷ lệ sử dụng thấp trước, ô AVAILABLE và bảo trì; có cả cơ sở chưa có thu |
| Việc tài chính nào cần xử lý? | Overview chỉ số pending refund và liên kết API `/api/payments/refunds` hiện có cho BOM/SA |
| Số dư cọc có đáng tin không? | Cọc chưa hoàn/mất, cọc mất và các cờ dữ liệu thiếu; số không xác định trả null, không trả 0 giả |
| Giao dịch nào cần đối chiếu? | Reconciliation liệt kê ID, trạng thái, tiền, currency và lý do chưa phân loại; không tự sửa số tiền |
| Hợp đồng nào cần xem trước? | Rental list theo thời điểm hết hạn dự kiến tăng dần, status breakdown và scope cơ sở; không tự gắn trạng thái overdue |

Không có ngưỡng tự đặt như “utilization dưới 30% là kém”, health score, doanh thu
ước đoán hoặc lợi nhuận khi chưa có dữ liệu chi phí.

## Swagger / phân quyền

Mở `/docs`, đăng nhập qua Authentication. Nhóm **Reports** gồm:

| GET endpoint | Query |
|---|---|
| `/api/reports/overview` | from, to, facilityId, unitTypeId, limit, offset |
| `/api/reports/revenue` | như overview |
| `/api/reports/utilization` | facilityId, unitTypeId, limit, offset |
| `/api/reports/rentals` | facilityId, unitTypeId, status, limit, offset |
| `/api/reports/reconciliation` | facilityId, unitTypeId, limit, offset |
| `/api/reports/export` | type=revenue/utilization/rentals; cùng filter hợp lệ cho loại báo cáo |

BOM và SYSTEM_ADMIN đọc toàn hệ thống; FM chỉ cơ sở có membership active đúng
role và chưa hết hạn. FM không có quyền xử lý queue refund toàn hệ thống. Guest
401; Customer/FS 403. Lọc chéo cơ sở FM, kể cả CSV, bị 403. Quyền xem report không
cấp thêm quyền sửa giá/cọc (API cấu hình vẫn chỉ BOM). Mọi response private/no-store.

`from` và `to`: YYYY-MM-DD, đi cùng nhau, bao gồm cả hai ngày theo
Asia/Ho_Chi_Minh. Không truyền thì từ đầu tháng Việt Nam đến hôm nay. Thời gian
SQL là [đầu ngày from, đầu ngày sau to). Utilization/rental/reconciliation là
hiện trạng: không nhận filter lịch sử để tránh tạo cảm giác có dữ liệu hồi dựng.

Ví dụ: `/api/reports/overview?from=2026-10-01&to=2026-10-31`.

## Định nghĩa số liệu

Các khoản tiền trả decimal string, currency VND; không trộn ngoại tệ hoặc dùng
JavaScript float để cộng tiền. SQL aggregate trước pagination. Mỗi payment là
một khoản thu, không nhân lên theo số booking assignment/rental/ảnh/checklist.
Không đọc giá hiện hành để tính lại doanh số quá khứ.

**Trong kỳ**:

- `cashReceived`: totalAmount khi paidAt trong kỳ và không nằm sau asOf, kể cả
  payment hiện đã REFUND_PENDING/REFUNDED.
- `rentalCollected`, `depositCollected`: phần tiền thuê/cọc trong snapshot booking
  của các khoản thu trên. Chỉ phân loại khi snapshot khớp tổng payment.
- `cashRefunded`: số tiền xác nhận hoàn, theo refundedAt trong kỳ; pending chưa
  tính là đã hoàn. Tháng nhận tiền và tháng hoàn có thể khác nhau.
- `netCash`: cashReceived − cashRefunded; có thể âm, không phải lợi nhuận hoặc
  doanh thu kế toán theo thời gian thuê.

**Tại asOf, không bị giới hạn bởi kỳ thu đang chọn**:

- `depositHeld`: cọc đã nhận trừ cọc mất và phần đã hoàn xác định được. Cọc đang
  chờ hoàn vẫn còn giữ cho đến khi xác nhận hoàn thực tế. Vì vậy số này có thể
  giao với pending refund; không cộng chúng để suy ra tổng tiền.
- `depositForfeited`: tổng cọc đã ghi nhận mất, không cộng vào tiền thuê đã thu.
- `pendingRefundAmount`/`pendingRefundCount`: nghĩa vụ hiện đang chờ hoàn theo
  ledger; BOM/SA theo API hoàn thủ công hiện có, không có thao tác chuyển tiền mới.
- Utilization = tổng OCCUPIED / tổng ô chưa INACTIVE; MAINTENANCE vẫn trong mẫu
  số, các trạng thái khác được trả riêng. Mẫu số 0 → null. Tổng hệ thống tính từ
  tổng số ô, không lấy trung bình các tỷ lệ cơ sở.
- `activeCheckoutHolds`: HOLD ACTIVE chưa hết expiresAt; không phải ô đang dùng.
  `confirmedAwaitingHandover`: booking CONFIRMED, có thể nhận kho trong tương lai.
  Không cộng hai chỉ số này với RESERVED vật lý để suy ra số ô bị chiếm.
- AVAILABLE là status vật lý hiện tại; sức chứa cho một kỳ thuê vẫn phải dùng
  kiểm tra capacity hiện hành của Flow 1.

**Dữ liệu chưa xác định**: payment không có booking snapshot, snapshot không khớp,
refund không thuộc các cách phân bổ đã có hoặc currency khác VND đều có chỉ báo.
Không tự giả định partial refund trả tiền thuê trước rồi mới trả cọc. Nếu không
phân loại được số cọc, depositHeld trả null; nếu khoản thu không phân loại được,
rentalCollected/depositCollected trả null. cashReceived vẫn giữ khoản thu VND
thực tế. BOM/SA có nhóm `unattributed` cho khoản chưa xác định cơ sở; FM không thấy
những khoản không chứng minh được thuộc cơ sở mình. Reconciliation là hiện trạng,
không chỉ các khoản đã nhận trong kỳ thu đang chọn. Các cờ có thể cùng chỉ một
giao dịch; không cộng chúng để gọi là số giao dịch lỗi duy nhất.

## CSV và nghiệm thu

CSV dùng cùng query, permission và công thức với JSON; chứa toàn bộ hàng lọc,
không chỉ trang đầu. Có kỳ/thời điểm số dư trong file, UTF-8 BOM, quote/escape
và chống spreadsheet formula injection. Xuất đồng bộ giới hạn kỹ thuật 10.000
hàng, quá giới hạn trả 422 để thu hẹp filter; không cắt âm thầm.

Test DB riêng: REPORTS_TEST_DATABASE_URL phải trùng DATABASE_URL và database
phải trống ở đầu suite. Không trỏ suite vào DB ứng dụng.

```sh
bun test --preload ./apps/api/tests/setup.ts ./apps/api/tests/integration/reports-calculation.test.ts
bun test --preload ./apps/api/tests/setup.ts ./apps/api/tests/integration/reports-postgres.test.ts
```

Các ca gồm biên ngày VN, thu/hoàn khác tháng, payment pending/failed, giá hiện
hành khác snapshot, số dư cọc, pagination và tổng, weighted utilization, expired
assignment/cross-facility JSON/CSV, ngoại tệ, số liệu không đủ và CSV injection.
