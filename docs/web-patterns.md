# Web Frontend Patterns

## Overview

Web frontend xây dựng với **Next.js (App Router)** và **React**, định hướng cấu trúc theo **Feature-based Architecture**.

---

## Core Patterns & Guidelines

### 1. Component Composition
- **Feature Components**: Đặt trong từng feature folder, đảm nhận việc kết nối hooks, API client và hiển thị dữ liệu của feature đó.
- **Reusable UI Components**: Các component thuần hiển thị (buttons, dialogs, inputs, tables), không chứa business logic hoặc gọi API trực tiếp.

### 2. State Separation
Phải phân định rạch ròi giữa 3 loại state:
- **Server State**: Sử dụng **TanStack Query** để fetch, cache, mutate và invalidate dữ liệu từ API.
- **Client/Global State**: Sử dụng **Zustand** khi thực sự cần chia sẻ state giữa nhiều component độc lập (auth session, global modal, theme). Không lạm dụng khi có thể quản lý cục bộ.
- **Form State**: Sử dụng **React Hook Form** kết hợp với **Zod** để validate schema dựa trên contract chung.

### 3. API Client Pattern & Shared Contracts
- Luôn sử dụng centralized API client (`packages/api-client`), không gọi `fetch` hay `axios` rải rác trong component.
- Tái sử dụng schema/types từ `packages/contracts` hoặc `@metastorage/shared`.
- Database models không được expose trực tiếp cho frontend.

### 4. Logic Placement
- Nghiêm cấm đặt business logic hoặc direct API fetch trong UI components.
- Tách logic thành custom hooks theo từng feature (`useBooking`, `useRentalFlow`, ...).

### 5. Actor Modules & Import Boundaries

Web sử dụng mô hình hybrid để nhiều thành viên phát triển song song:

- `app/`: chỉ chứa Next.js route/layout adapter; page của actor phải import trực tiếp một screen
  từ `modules/` và không chứa business logic.
- `modules/<actor>/`: screen và orchestration riêng của Customer, Facility Staff, Facility
  Manager, Business Operations hoặc System Administrator.
- `features/<domain>/`: nghiệp vụ tái sử dụng giữa các actor như auth, facilities,
  reservations và dashboard primitives.
- `components/`: UI/layout thuần hiển thị, không phụ thuộc actor hoặc business flow.

Chiều dependency bắt buộc:

```text
app → modules → features → api-client/contracts
              ↘ components/config/lib
```

`features` không được import từ `modules`. Không tạo barrel `modules/<actor>/index.ts` cho
route imports vì dễ tạo conflict và kéo các screen không dùng vào cùng client bundle.

Navigation, route constants, permission mapping, mock handlers và mock seeds phải tách file
theo actor/domain; file registry trung tâm chỉ làm nhiệm vụ ghép các cấu hình đã tách.

Web sử dụng Tailwind CSS v4. Actor module và feature dùng utility classes trực tiếp trong JSX.
`app/globals.css` chỉ chứa Tailwind import, theme tokens, base reset và accessibility defaults;
không thêm component selector hoặc business-specific selector vào global CSS.

---

## Ví dụ đường đi hiện tại

```text
apps/web/src/app/customer/reservations/page.tsx
  → apps/web/src/features/rentals/customer-storage-hub.tsx
  → apps/web/src/features/rentals/hooks.ts
  → packages/api-client/src/index.ts

apps/web/src/app/facility-manager/dashboard/page.tsx
  → apps/web/src/modules/facility-manager/dashboard/facility-manager-dashboard-screen.tsx
```

`app/` chỉ là route adapter. `modules/` giữ screen theo vai trò; `features/` giữ các luồng nghiệp vụ có thể tái sử dụng. UI dùng chung ở `components/`, còn `apps/web/src/lib/api.ts` cấu hình API client. Schema và kiểu dữ liệu HTTP nằm trong `packages/contracts`.

Các endpoint Booking cũ không còn trong API production. Chỉ giữ mock/legacy client khi một demo offline hoặc test hiện tại vẫn cần; xem [booking retirement](booking-retirement.md).
