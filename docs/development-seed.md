# Dữ liệu seed để test Swagger

Chạy `bun run db:seed` (hoặc bí danh `bun run seed:local`) để tạo catalog/demo,
pricing policy, overdue policy, tài khoản đăng nhập, dữ liệu Flow 2 và Flow 3.
Toàn bộ logic tạo dữ liệu nằm trong `packages/database/src/seed.ts`; `demo-fixtures.ts`
chỉ giữ ID và danh tính dùng chung với API/Swagger, không chạy seed riêng.
ID được khai báo tại `packages/database/src/demo-fixtures.ts`, dùng chung cho seed
database, seed đăng nhập và các ví dụ Booking trên Swagger. Thêm fixture mới không
được thay đổi ID của fixture đã có.

Nếu database đang chứa seed cũ với ID ngẫu nhiên, reset **database development** một
lần. Lệnh `db:clear` xóa toàn bộ dữ liệu ứng dụng, gồm user và session:

```bash
bun run db:migrate
bun run db:clear
bun run seed:local
```

Lệnh tổng hợp truyền cùng một thời điểm `SEED_NOW` qua mọi nhóm seed trong một lượt.
Ngày check-in, hạn thuê, thanh toán mẫu và hạn hold được tính từ thời điểm đó, nên
fixture “hôm nay” vẫn theo ngày chạy nhưng không bị lệch giữa các seed. Có thể
truyền `SEED_NOW=2026-10-20T02:00:00.000Z` để tái tạo một ngày cụ thể.
Chạy lại không tạo bản ghi trùng; các policy đã được người dùng cấu hình sẽ được giữ.
Seed booking khôi phục các tình huống mẫu, xóa kết quả check-in và gán kho của các
booking mẫu trước khi tạo lại. Ngày check-in mẫu tính theo `SEED_NOW` của lượt chạy.
Seed Flow 2 bổ sung `HCM-01-009`–`HCM-01-018` và tài khoản
`staff@metastorage.test` / `Demo@123`. Flow 3 tạo rental ACTIVE, RETURN_PENDING,
OVERDUE và CLOSED cùng payment, request trả kho và inspection mẫu. Checklist mẫu
chỉ được tạo khi database chưa có checklist Admin cấu hình. Không tạo hợp đồng hay
ảnh giả vì các tệp này cần object storage thật.

## ID thường dùng

| Bản ghi | ID |
| --- | --- |
| Facility HCM-01 | `30000000-0000-4000-8000-000000000001` |
| Unit type UT-2M, 900.000 VND/tháng | `60000000-0000-4000-8000-000000000001` |
| Unit type UT-1M, 500.000 VND/tháng | `60000000-0000-4000-8000-000000000005` |
| Ca 1, 09:00–10:30 | `20000000-0000-4000-8000-000000000001` |
| Ca 2, 10:30–12:00 | `20000000-0000-4000-8000-000000000002` |
| Ca 3, 14:00–15:30 | `20000000-0000-4000-8000-000000000003` |
| Ca 4, 15:30–17:00 | `20000000-0000-4000-8000-000000000004` |
| Kho HCM-01-002, UT-2M, chưa gán booking mẫu | `70000000-0000-4000-8000-000000000002` |
| Booking BK-2026-0001, CONFIRMED hôm nay | `80000000-0000-4000-8000-000000000001` |
| Booking BK-2026-0002, CONFIRMED ngày mai | `80000000-0000-4000-8000-000000000002` |
| Booking BK-2026-0003, NO_SHOW | `80000000-0000-4000-8000-000000000003` |
| Booking DEMO-FLOW2-READY, đã thanh toán, chưa gán kho/Staff, check-in hôm nay | `83000000-0000-4000-8000-000000000001` |
| Rental demo Flow 3 (ACTIVE / RETURN_PENDING / OVERDUE / CLOSED) | `85000000-0000-4000-8000-000000000001`–`...0004` |
| Return requests demo Flow 3 (PENDING / CONFIRMED / COMPLETED) | `86000000-0000-4000-8000-000000000002`–`...0004` |

Giờ ca nhận kho theo `Asia/Ho_Chi_Minh`. Khi tạo draft, chọn ngày trong tương lai;
ví dụ Swagger đã dùng ID seed cho facility, unit type và ca nhận kho. ID draft
vừa tạo do API sinh, cần lấy từ response để dùng ở bước tiếp theo.

## Tài khoản đăng nhập

Mật khẩu development: `12345678`. Đăng nhập qua
`POST /api/auth/sign-in/email`, dùng cookie session trên cùng origin Swagger.

| Role | Email | User ID |
| --- | --- | --- |
| CUSTOMER | customer@metastorage.vn | `40000000-0000-4000-8000-000000000001` |
| FACILITY_STAFF | staff@metastorage.vn | `40000000-0000-4000-8000-000000000002` |
| FACILITY_MANAGER | manager@metastorage.vn | `40000000-0000-4000-8000-000000000003` |
| BUSINESS_OPERATION_MANAGER | bom@metastorage.vn | `40000000-0000-4000-8000-000000000004` |

Staff và manager được gán vào HCM-01. Sau khi reset database phải đăng nhập lại.

## Test Flow 2 trên Swagger

Chạy `bun run db:seed` với `DATABASE_URL` trỏ tới PostgreSQL Docker ở cổng host
`5433`, rồi mở `/docs`. Booking `DEMO-FLOW2-READY` đã `CONFIRMED`, có payment
`SUCCEEDED`, dùng loại kho `UT-2M` tại HCM-01 nhưng chưa gán kho hay Staff.
Đăng nhập FM, gọi `GET /api/bookings/{id}/eligible-units`, sau đó `assign-unit`
với một kho `isAvailableForPeriod: true` và `assign-staff` với Staff ID ở trên.
Đăng nhập Staff để dùng `assigned-to-me`, lookup bằng `BOOKING_CODE`, confirm,
inspection và handover. Ca nhận kho là 09:00; check-in/handover chỉ hợp lệ từ
09:00 đến trước 20:00 theo giờ Việt Nam của ngày seed. Nếu đã bàn giao hoặc qua
ngày, dùng database test mới để seed lại kịch bản sạch; chạy seed trên cùng DB
không đặt lại booking đã xử lý.
