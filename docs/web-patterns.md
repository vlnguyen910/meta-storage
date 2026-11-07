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

## Ví dụ Cấu trúc Thư mục theo Domain / Feature trong Web

Next.js App Router giữ vai trò **Thin Routing Layer** (chỉ xử lý layout, route params, metadata), toàn bộ logic hiển thị và nghiệp vụ thuộc về **Feature Slices**:

```text
apps/web/src/
├── app/                                   # Thin Routing Layer (Next.js App Router)
│   ├── (auth)/                            # Route Group: Authentication
│   │   ├── login/page.tsx                 # Render <LoginForm /> từ features/auth
│   │   └── register/page.tsx
│   ├── (dashboard)/                       # Route Group: Dashboard chính
│   │   ├── layout.tsx                     # Dashboard shell (Sidebar, Header, Breadcrumbs)
│   │   ├── bookings/
│   │   │   ├── page.tsx                   # Render <BookingListPage /> từ features/booking
│   │   │   └── [id]/
│   │   │       └── page.tsx               # Render <BookingDetailView id={params.id} />
│   │   └── rentals/
│   │       └── page.tsx
│   ├── layout.tsx                         # Root layout (Providers: QueryClientProvider, Theme)
│   └── globals.css
│
├── features/                              # Vertical Feature Slices (Domain)
│   ├── booking/                           # Domain Booking
│   │   ├── components/                    # Feature-specific UI components
│   │   │   ├── booking-card.tsx           # Thẻ tóm tắt thông tin booking
│   │   │   ├── booking-status-badge.tsx   # Badge hiển thị status với màu tương ứng
│   │   │   ├── booking-timeline.tsx       # Timeline tiến trình booking
│   │   │   ├── booking-list-view.tsx      # Danh sách booking (gọi useBookings)
│   │   │   └── booking-form.tsx           # Form đặt chỗ (React Hook Form + Zod)
│   │   ├── hooks/                         # Logic & State của riêng booking
│   │   │   ├── use-booking-detail.ts      # TanStack Query: fetch chi tiết theo id
│   │   │   ├── use-create-booking.ts      # TanStack Mutation: tạo booking mới
│   │   │   └── use-cancel-booking.ts      # TanStack Mutation: hủy booking & invalidate queries
│   │   ├── api/                           # Gọi API thông qua centralized client
│   │   │   └── booking.api.ts             # apiClient.get('/bookings'), apiClient.post(...)
│   │   └── types.ts                       # UI-specific types / View models
│   │
│   ├── payment/                           # Domain Payment
│   │   ├── components/
│   │   │   ├── payment-method-selector.tsx
│   │   │   └── payment-summary.tsx
│   │   └── hooks/
│   │       └── use-checkout.ts            # Xử lý redirect VNPay / Momo
│   │
│   └── auth/                              # Domain Auth
│       ├── components/
│       │   └── login-form.tsx
│       ├── hooks/
│       │   └── use-auth-session.ts
│       └── store/
│           └── auth.store.ts              # Zustand store lưu thông tin session client
│
├── components/ui/                         # Reusable UI Components (Dumb / Presentational)
│   ├── button.tsx
│   ├── input.tsx
│   ├── dialog.tsx
│   ├── dropdown-menu.tsx
│   └── table.tsx
│
└── lib/                                   # Shared Client Infrastructure
    ├── query-client.ts                    # Cấu hình TanStack QueryClient
    └── utils.ts                           # cn (clsx + twMerge), formatters (currency, date)
```

### Quy tắc tương tác trong Web Frontend

1. `app/(routes)/[id]/page.tsx` chỉ đóng vai trò lấy `params.id` và truyền vào `<BookingDetailView id={params.id} />`.
2. `<BookingDetailView />` sử dụng hook `useBookingDetail(id)`.
3. `useBookingDetail` gọi API thông qua `booking.api.ts` và trả về `{ data, isLoading, error }`.
4. Render UI phân tách rõ các trạng thái: `Skeleton Loading` → `Error State` → `Data Presentation`.
