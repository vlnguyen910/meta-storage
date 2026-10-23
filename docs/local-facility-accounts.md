# Tài khoản cơ sở local

Dùng tại `http://localhost:3000/login`. Mật khẩu fixture local: `12345678`.

| Cơ sở | Manager | Staff |
| --- | --- | --- |
| HCM-01 | manager@metastorage.vn | staff@metastorage.vn |
| HCM-02 | manager.hcm02@metastorage.test | staff.hcm02@metastorage.test |
| HCM-03 | manager.hcm03@metastorage.test | staff.hcm03@metastorage.test |
| HCM-04 | manager.hcm04@metastorage.test | staff.hcm04@metastorage.test |
| HCM-05 | manager.hcm05@metastorage.test | staff.hcm05@metastorage.test |
| HCM-06 | manager.hcm06@metastorage.test | staff.hcm06@metastorage.test |
| HCM-07 | manager.hcm07@metastorage.test | staff.hcm07@metastorage.test |
| HCM-08 | manager.hcm08@metastorage.test | staff.hcm08@metastorage.test |
| HCM-09 | manager.hcm09@metastorage.test | staff.hcm09@metastorage.test |
| HCM-10 | manager.hcm10@metastorage.test | staff.hcm10@metastorage.test |

Từ thư mục gốc repository, tạo dữ liệu demo và tài khoản bằng một lệnh:

```bash
bun run db:seed
```

Toàn bộ seed nằm trong `packages/database/src/seed.ts`, dùng kết nối DB từ
`apps/api/.env` và bị chặn trong production. Lệnh tạo cả catalog, booking,
thanh toán giả lập và ô kho; chạy lại sẽ khôi phục các kịch bản mẫu và mật khẩu
development `12345678`. Không có lệnh seed tài khoản riêng.

Manager xem booking của cơ sở được phân công. Staff thấy các công việc được manager chỉ định; chỉ tạo tài khoản staff chưa tự phân công booking cho họ.
