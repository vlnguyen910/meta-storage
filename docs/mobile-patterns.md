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

- **Feature Hook (`src/features/<feature>/`)**:
  - Đóng gói toàn bộ logic nghiệp vụ, điều phối server state (TanStack Query) và local state.
  - Xử lý các validation, transformation dữ liệu trước khi render hoặc gửi lên server.

- **Centralized API Client (`packages/api-client`)**:
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
- **Client / Local State**: Giữ state cục bộ trong screen/hook; dùng session và SecureStore hiện có cho trạng thái đăng nhập. Tránh đưa state cục bộ của màn hình lên store toàn cục.
- **Form State**: Sử dụng **React Hook Form** kết hợp **Zod** schema (tái sử dụng từ `@metastorage/shared` / `packages/contracts`).

---

## 4. Tích hợp Monorepo & Metro Bundler

Để Expo Metro có thể đọc và resolve các package nội bộ trong monorepo (`@metastorage/*`), [`apps/mobile/metro.config.js`](../apps/mobile/metro.config.js) được cấu hình:

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

## 5. Đường đi hiện tại

```text
apps/mobile/App.tsx
  → src/navigation/app-navigator.tsx
  → src/navigation/customer-navigator.tsx / src/screens/staff/staff-workspace.tsx
  → src/features/booking/use-booking.ts / src/features/staff-api/use-staff-workspace.ts
  → src/lib/api.ts
  → packages/api-client
```

Screen hiển thị và điều hướng, feature hook điều phối TanStack Query và mutation, còn `src/lib/api.ts` cấu hình API client dùng schema từ `packages/contracts`. `src/screens/old/` đã được gỡ sau khi chuyển sang navigator hiện tại.
