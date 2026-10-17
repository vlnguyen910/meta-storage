# Dữ liệu seed để test Swagger

ID được khai báo tại `packages/database/src/seed-fixtures.ts`, dùng chung cho seed
database, seed đăng nhập và các ví dụ Booking trên Swagger. Thêm fixture mới không
được thay đổi ID của fixture đã có.

Nếu database đang chứa seed cũ với ID ngẫu nhiên, reset **database development** một
lần. Lệnh `db:clear` xóa toàn bộ dữ liệu ứng dụng, gồm user và session:

```bash
bun run db:migrate
bun run db:clear
bun run db:seed
bun run --filter api seed:auth
```

Sau đó có thể chạy lại hai lệnh seed mà ID không đổi và không tạo bản ghi trùng.
Seed booking khôi phục các tình huống mẫu, xóa kết quả check-in và gán kho của các
booking mẫu trước khi tạo lại. Ngày check-in mẫu vẫn tính theo ngày chạy seed.

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

Giờ ca nhận kho theo `Asia/Ho_Chi_Minh`. Khi tạo draft, chọn ngày trong tương lai;
ví dụ Swagger đã dùng ID seed cho facility, unit type và ca nhận kho. ID draft
vừa tạo do API sinh, cần lấy từ response để dùng ở bước tiếp theo.

## Tài khoản đăng nhập

Mật khẩu development: `StoreXDev123!`. Đăng nhập qua
`POST /api/auth/sign-in/email`, dùng cookie session trên cùng origin Swagger.

| Role | Email | User ID |
| --- | --- | --- |
| CUSTOMER | customer@metastorage.vn | `40000000-0000-4000-8000-000000000001` |
| FACILITY_STAFF | staff@metastorage.vn | `40000000-0000-4000-8000-000000000002` |
| FACILITY_MANAGER | manager@metastorage.vn | `40000000-0000-4000-8000-000000000003` |
| BUSINESS_OPERATION_MANAGER | bom@metastorage.vn | `40000000-0000-4000-8000-000000000004` |

Staff và manager được gán vào HCM-01. Sau khi reset database phải đăng nhập lại.

## Test Flow 2 trên Swagger

Chạy `bun run seed:local` với `DATABASE_URL` trỏ tới PostgreSQL Docker ở cổng host
`5433`, rồi mở `/docs`. Booking `DEMO-FLOW2-READY` đã `CONFIRMED`, có payment
`SUCCEEDED`, dùng loại kho `UT-2M` tại HCM-01 nhưng chưa gán kho hay Staff.
Đăng nhập FM, gọi `GET /api/bookings/{id}/eligible-units`, sau đó `assign-unit`
với một kho `isAvailableForPeriod: true` và `assign-staff` với Staff ID ở trên.
Đăng nhập Staff để dùng `assigned-to-me`, lookup bằng `BOOKING_CODE`, confirm,
inspection và handover. Ca nhận kho là 09:00; check-in/handover chỉ hợp lệ từ
09:00 đến trước 20:00 theo giờ Việt Nam của ngày seed. Nếu đã bàn giao hoặc qua
ngày, dùng database test mới để seed lại kịch bản sạch; chạy seed trên cùng DB
không đặt lại booking đã xử lý.
