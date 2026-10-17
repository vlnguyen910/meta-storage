# Actor module ownership

`modules` chứa screen và orchestration riêng của từng actor. Mỗi nhóm có thể sở hữu một
module mà không phải sửa module của nhóm khác.

## Import boundaries

- `app` chỉ import screen từ `modules` và giữ route adapter thật mỏng.
- Route import trực tiếp screen file; không tạo barrel `modules/<actor>/index.ts` để tránh bundle
  các screen không dùng và giảm conflict ở file export tập trung.
- `modules` được import từ `features`, `components`, `config` và `lib`.
- `features` không được import ngược từ `modules`.
- Nghiệp vụ dùng bởi từ hai actor trở lên phải đặt trong `features`, không copy giữa modules.
- Component thuần hiển thị dùng chung đặt trong `components/ui` hoặc `components/layout`.
- Style của module phải dùng Tailwind utility classes trực tiếp trong JSX. Chỉ thêm token hoặc
  base reset thật sự toàn cục vào `app/globals.css`.

## Ownership mặc định

- `customer`: customer dashboard và cách phối hợp facility/reservation feature.
- `facility-staff`: check-in, handover, return và task screens.
- `facility-manager`: storage unit, staff assignment và facility report screens.
- `business-operations`: facility, policy và system-wide report screens.
- `system-administrator`: user, permission và activity log screens.
