# Mobile Patterns (React Native + Expo + NativeWind)

## Overview

Ứng dụng mobile được xây dựng trên nền tảng **React Native**, **Expo (SDK 57)**, và hệ thống styling **NativeWind (v5)** kết hợp với **Tailwind CSS (v4)**. Kiến trúc được thiết kế đồng bộ với Web Frontend để giảm cognitive overhead và tối đa hóa việc tái sử dụng kiến thức, schema, và API client trong monorepo.

---

## 1. Kiến trúc phân lớp: Screen → Feature Hook → API Client

Tuân thủ luồng dữ liệu một chiều và phân tách trách nhiệm rõ ràng:

- **Screen (`src/screens/`)**:
  - Chịu trách nhiệm về layout tổng thể của màn hình và routing (navigation).
  - Kết nối giữa Feature Hook và các UI Component.
  - Không chứa logic nghiệp vụ hay fetch API trực tiếp.

- **Feature Hook (`src/features/<feature>/hooks/`)**:
  - Đóng gói toàn bộ logic nghiệp vụ, điều phối server state (TanStack Query) và local state.
  - Xử lý các validation, transformation dữ liệu trước khi render hoặc gửi lên server.

- **Centralized API Client (`packages/api-client` hoặc `@metastorage/shared`)**:
  - Thực hiện các HTTP call đến backend Fastify.
  - Sử dụng chung kiểu dữ liệu và schema với backend.

---

## 2. Quy chuẩn Styling với NativeWind & Tailwind CSS

1. **Utility-First qua `className`**:
   - Sử dụng thuộc tính `className="..."` của NativeWind thay cho `StyleSheet.create` hoặc inline style đối với toàn bộ static styles.
   - Inline `style={{ ... }}` chỉ sử dụng cho các giá trị động được tính toán lúc runtime (ví dụ: animated values từ Reanimated, dynamic height/width đo được từ layout).

2. **Cấu hình Global Styles (`global.css`)**:
   - Sử dụng cấu trúc layer chuẩn của Tailwind v4:
     ```css
     @import "tailwindcss/theme.css" layer(theme);
     @import "tailwindcss/preflight.css" layer(base);
     @import "tailwindcss/utilities.css";
     @import "nativewind/theme";
     ```

3. **Safe Area Handling**:
   - Sử dụng `react-native-safe-area-context` (`useSafeAreaInsets` hoặc `SafeAreaView`) để xử lý các vùng notch, dynamic island và home indicator trên iOS / Android.

4. **Dark Mode & Theme Consistency**:
   - Khai báo color palette đồng bộ với Web Frontend qua Tailwind config / CSS variables.
   - Hỗ trợ dark mode thông qua system appearance hoặc app theme state.

---

## 3. Quản lý State (Strict State Separation)

Tương tự như Web, Mobile phân định nghiêm ngặt giữa 3 loại state:

- **Server State**: Sử dụng **TanStack Query** để quản lý cache, background refetch, pagination, và optimistic update.
- **Client / Local State**: Sử dụng **Zustand** cho các state cần chia sẻ liên màn hình (auth token, user session, onboarding status, offline cache flags). Tránh đưa state cục bộ của màn hình lên store toàn cục.
- **Form State**: Sử dụng **React Hook Form** kết hợp **Zod** schema (tái sử dụng từ `@metastorage/shared` / `packages/contracts`).

---

## 4. Tích hợp Monorepo & Metro Bundler

Để Expo Metro có thể đọc và resolve các package nội bộ trong monorepo (`@metastorage/*`), [`apps/mobile/metro.config.js`](file:///home/owen/Projects/storeX/apps/mobile/metro.config.js) được cấu hình:

```javascript
const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");
const path = require("node:path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// 1. Watch tất cả thư mục trong monorepo
config.watchFolders = [monorepoRoot];

// 2. Định tuyến node_modules để giải quyết đúng package hoisted
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

module.exports = withNativewind(config);
```

---

## 5. Ví dụ Cấu trúc Thư mục theo Domain / Feature trong Mobile

```text
apps/mobile/src/
├── screens/                               # Màn hình điều hướng (Layout, Navigation, Safe Area)
│   ├── booking/
│   │   ├── booking-list-screen.tsx        # Screen danh sách, kết nối useBookings()
│   │   └── booking-detail-screen.tsx      # Screen chi tiết, lấy route.params.id
│   ├── payment/
│   │   └── checkout-screen.tsx            # Screen checkout, hiển thị cổng thanh toán
│   └── auth/
│       └── login-screen.tsx
│
├── features/                              # Vertical Feature Slices (Domain)
│   ├── booking/                           # Domain Booking
│   │   ├── components/                    # Mobile UI components với NativeWind
│   │   │   ├── booking-card.tsx           # Thẻ hiển thị với className="bg-slate-800 rounded-xl..."
│   │   │   ├── booking-status-chip.tsx    # Chip status với màu tương ứng
│   │   │   ├── booking-bottom-sheet.tsx   # Action sheet xác nhận thao tác đặt chỗ
│   │   │   └── booking-filter-bar.tsx
│   │   ├── hooks/                         # Feature logic & state
│   │   │   ├── use-booking-detail.ts      # TanStack Query hook lấy chi tiết theo id
│   │   │   ├── use-booking-actions.ts     # Action mutations: Confirm, Cancel
│   │   │   └── use-booking-filter.ts      # Quản lý filter & pagination
│   │   └── types.ts                       # Mobile-specific UI types
│   │
│   ├── payment/                           # Domain Payment
│   │   ├── components/
│   │   │   ├── payment-card-selector.tsx
│   │   │   └── payment-qr-modal.tsx       # Modal QR cho Momo / VNPay
│   │   └── hooks/
│   │       └── use-mobile-payment.ts      # Deeplink mở ứng dụng Momo / ngân hàng
│   │
│   └── auth/                              # Domain Auth
│       ├── hooks/
│       │   └── use-auth.ts
│       └── store/
│           └── auth-storage.ts            # Zustand + Expo SecureStore lưu session
│
├── components/ui/                         # Reusable Mobile UI (NativeWind)
│   ├── app-button.tsx                     # Nút bấm chuẩn thiết kế
│   ├── app-input.tsx                      # Input text với label, helper text
│   ├── card.tsx                           # Container card chuẩn styling
│   └── skeleton.tsx                       # Shimmer loading skeleton
│
├── navigation/                            # Navigation Stacks / Tabs
│   ├── root-navigator.tsx
│   ├── tab-navigator.tsx
│   └── types.ts                           # React Navigation ParamList typings
│
├── hooks/                                 # Global utility hooks (useSafeArea, useNetworkStatus)
├── global.css                             # NativeWind & Tailwind CSS imports
├── App.tsx                                # Root component
├── metro.config.js                        # Metro configuration
├── postcss.config.js                      # PostCSS cho Tailwind v4
└── babel.config.js                        # Babel config
```

### Minh họa luồng thực thi trong Mobile (Ví dụ: Chi tiết Booking)

```text
[User mở BookingDetailScreen]
       │
       ▼
booking-detail-screen.tsx      ──> Lấy bookingId từ route.params
       │
       ▼
use-booking-detail.ts          ──> TanStack Query: gọi centralized api-client
       │
       ▼
booking-card.tsx               ──> Render giao diện với NativeWind (className="...")
booking-action-sheet.tsx       ──> Khi người dùng bấm Confirm: gọi useBookingActions().confirm()
```
