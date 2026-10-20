# Tài khoản cơ sở local

Dùng tại `http://localhost:3000/login`. Mật khẩu fixture local: `StoreXDev123!`.

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

Từ thư mục gốc repository, bổ sung tài khoản/phân công còn thiếu bằng:

```bash
bun run --filter api seed:facility-accounts
```

Lệnh dùng kết nối DB từ `apps/api/.env`, bị chặn trong production. Yêu cầu các cơ sở đã tồn tại và đang hoạt động. Giữ UUID, mật khẩu, thông tin tài khoản và phân công hiện có; dừng và rollback nếu tài khoản/phân công xung đột. Không seed lại booking, thanh toán hoặc ô kho.

Manager xem booking của cơ sở được phân công. Staff thấy các công việc được manager chỉ định; chỉ tạo tài khoản staff chưa tự phân công booking cho họ.
