# Rental tối giản — trạng thái triển khai 2026-10-28

## Schema và sơ đồ DB

`packages/database/src/schema/rentals.ts` theo cách tổ chức của inspections.ts:
TS enum, enumToPgEnum, thuộc tính camelCase, FK RESTRICT, index/check và type
suy ra từ Drizzle. Chỉ giữ chín field:
`id`, `bookingId`, `userId`, `storageUnitId`, `status`, `startAt`, `endAt`,
`createdAt`, `updatedAt`. Status ACTIVE/CLOSED, mỗi booking có tối đa một rental,
endAt phải sau startAt. Sơ đồ tương ứng ở `docs/db-diagram.md`.

Đã gỡ sáu bảng phụ: rental_charges, rental_charge_adjustments,
rental_charge_events, rental_charge_refunds, rental_renewals, rental_price_ranges.
Không chuyển chúng thành JSON hoặc thêm bảng nghiệp vụ thay thế.
Thanh toán booking và hoàn tiền hủy booking giữ nguyên. Loại kho giữ monthlyPrice
ở cơ sở. Các chức năng gia hạn, trả kho/quyết toán, phụ phí/công nợ và nhắc hạn
cũ đã gỡ; worker bỏ qua thông báo lifecycle rental cũ còn trong hàng đợi.

## Migration

Đã sinh `packages/database/drizzle/0008_nostalgic_blacklash.sql`, snapshot và
journal bằng `bun run db:generate`, không chỉnh tay SQL sinh ra. Snapshot có đúng
chín cột rental, ACTIVE/CLOSED, không còn sáu bảng phụ. Drizzle Kit check đạt.

Chạy qua **runner của dự án** bằng `bun run db:migrate`. Không chạy trực tiếp
Drizzle migrate vì bước chuyển dữ liệu ở `src/rental-reset-migration.ts` được
runner gọi riêng cho migration 0008, trong cùng transaction và advisory lock:

1. Kiểm tra dữ liệu thanh toán/audit của chức năng cũ. Nếu có payment rental,
   return refund hoặc audit RENTAL_PRICE_RANGE, dừng trước khi xóa dữ liệu.
   Cần lưu trữ/đối soát riêng các bản ghi này; runner không tự xóa hay gán chúng
   thành thanh toán booking hoặc lịch sử chỉnh giá loại kho.
2. Lấy rentals.user_id từ booking, kiểm tra NOT NULL. Chuyển trạng thái mở cũ
   RETURN_PENDING/OVERDUE thành ACTIVE; CLOSED vẫn CLOSED. Không coi bước này
   là đã thực hiện hay quyết toán trả kho.
3. Gỡ FK trước DROP TABLE CASCADE để khắc phục thứ tự SQL Drizzle sinh ra;
   physical_unit_id → storage_unit_id và expected_end_at → end_at là đổi tên.
4. Chuyển kiểu cột pricing_changes.operation qua text trong lúc thay enum, rồi
   đưa về enum mới. Lịch sử của hai operation còn hỗ trợ được giữ nguyên.
5. Chỉ ghi migration journal khi toàn bộ thao tác thành công; có lỗi thì rollback.

Đã kiểm tra DB mới và nâng cấp DB tạm có rental cũ, đủ bốn trạng thái, payment
booking. Kiểm tra giữ ID/booking/chủ thuê/ô kho/ngày/tiền; gọi lại không chạy lần hai;
DB còn dữ liệu tài chính hoặc audit không tương thích dừng và rollback.
**Chưa chạy migration trên DB local ứng dụng hoặc môi trường deploy.**

## Giới hạn phạm vi: không triển khai lại inspection/bàn giao

Đã gỡ các thay đổi mở rộng phạm vi: endpoint/service bàn giao mới trong
inspection, repository bàn giao, DTO RentalHandoverResult, API client
inspectionRecords và màn hình Staff mới. Route inspection, quy tắc cập nhật
inspection và giao diện Staff được trả về trạng thái trước phần mở rộng này.
Không thay đổi schema inspections hoặc bổ sung version vào bảng rental.

Chỉ giữ một dòng tương thích trong inspections.service.ts: đọc
rental.storageUnitId thay cho rental.physicalUnitId đã bỏ. Đây là tham chiếu tới
schema rental mới, không thêm bước xử lý hoặc đổi trạng thái inspection.

Code nền hiện tại không đăng ký endpoint bàn giao mà client inspection cũ gọi;
chưa thể xác nhận bàn giao tạo rental. Phần này còn thiếu, cần xử lý riêng ở
module sở hữu luồng bàn giao; không coi các test đọc hồ sơ là bằng chứng tạo
rental thành công. Test đọc tạo rental trực tiếp làm fixture.

## Hồ sơ thuê Customer/FM

- Customer: GET /api/rentals/mine, /api/rentals/:rentalId,
  /api/rentals/:rentalId/payments. Theo rentals.userId; giữ phân trang current/history.
- FM: GET /api/facilities/:facilityId/rentals,
  /api/facilities/:facilityId/rentals/:rentalId,
  /api/facilities/:facilityId/rentals/:rentalId/payments.
  Kiểm tra cơ sở được phân công đang hoạt động.

Dữ liệu khách/cơ sở/loại kho được join; lịch sử giao dịch chỉ từ payment booking.
Bộ API rental trùng trong facility-workspace đã gỡ. Giao diện web/mobile đọc theo
cấu trúc tối giản; không gọi API gia hạn/khoản thu/trả kho cũ.

## Kiểm tra và cách chạy lại

- `bun run test:rental:local`: DB tạm mới, chạy toàn bộ migration rồi test API đọc
  hồ sơ. Mặc định dùng migration, không dùng Drizzle push.
- `bun run test:rental:local --upgrade`: kiểm tra nâng cấp schema cũ có dữ liệu,
  rollback, tính lặp lại; sau đó test API trên DB đã nâng cấp.
- `bun run test:rental:local --schema-only`: chỉ dùng khi cần chẩn đoán schema
  độc lập bằng push; không phải bằng chứng migration thành công.
- `bun run --filter web test:e2e --config rental-core.playwright.config.ts`:
  giao diện Customer/FM trên desktop/mobile, dùng API fixtures.
- `bun run check`, `bun run check-types`, `bun run --filter web test`.
- Từ apps/api: `bun test tests/units`.
- `METASTORAGE_NEXT_DIST_DIR=.next-rental-reset bun run build`.

Runner chỉ cho PostgreSQL loopback, tạo database tên
metastorage_inspection_test_rental_reset_*, xóa trong finally. Không reset/seed
DB ứng dụng. Test migration/đọc hồ sơ dùng PostgreSQL thật; Playwright dùng
API fixtures và không được coi là kiểm thử browser tới backend thật.

Đã chạy lại sau khi thu hẹp phạm vi: 1 bài migration nâng cấp,
10 bài đọc hồ sơ và 4 bài giao diện Customer/FM đều đạt; lint và typecheck đạt.
Không còn suite kiểm chứng
bàn giao mới vì phần triển khai đó đã được gỡ. Kết quả pass của suite bàn giao
trước đây không áp dụng cho trạng thái code hiện tại.

## Thứ tự xây tiếp

Schema/migration và API đọc hồ sơ được giữ trong phạm vi rental. Bước tạo rental
khi bàn giao còn thiếu như mô tả phía trên. Các chức năng sau chưa
được khôi phục và cần thiết kế riêng theo nghiệp vụ đã chốt trước khi thêm bảng:

1. Trả kho/kết thúc kỳ thuê: xác nhận cách Customer yêu cầu, FS kiểm tra, FM duyệt
   và lúc chuyển ACTIVE → CLOSED/giải phóng kho.
2. Gia hạn: cập nhật kỳ thuê và thanh toán theo một quy tắc rõ ràng, giữ được
   lịch sử giao dịch; không dựng lại toàn bộ sáu bảng cũ.
3. Khoản thu bổ sung/hoàn tiền/quá hạn: chốt trường hợp cần hỗ trợ và dữ liệu
   tối thiểu phục vụ đối soát trước khi triển khai.

Chưa tự thêm các API ghi cho ba nhóm này hoặc đưa bảo trì/hợp đồng vào rental.
