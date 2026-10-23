# Guest Booking Tracking API Implementation Plan

**Goal:** Kiểm chứng và hoàn thiện frontend của issue #112 bằng API guest access hiện có.

**Architecture:** Giữ trang `/booking/tracking`, shared API client và cơ chế magic link đã dùng trong repo. TanStack Query quản lý phiên đọc dữ liệu; React Hook Form + Zod quản lý mã đặt kho/email. Không sửa backend, không cho mã booking đơn thuần đọc dữ liệu riêng tư.

**Tech Stack:** Next.js, React, TanStack Query, React Hook Form, Zod, Playwright/axe và Vitest hiện có.

---

## Hiện trạng và quyết định

- Issue #112 đã đóng; phần gửi liên kết, exchange, tracking và guest rental/payments/contracts đã có API client và consumer.
- #77/#92 còn mô tả OTP cũ; session này đã xác nhận magic link ở các đợt trước. Không tạo API OTP hoặc tracking song song.
- Theo yêu cầu bàn giao, chuyển thay đổi sang nhánh `feat/issue-112-guest-tracking` từ `origin/dev`, commit, rebase và push để merge vào dev.
- Không gửi email thật khi kiểm tra. Request link trả kết quả chung để tránh tiết lộ booking/email có tồn tại.
- Tái sử dụng các màn có sẵn; không thêm dependency hoặc chức năng ghi cho guest rental.

## Task 1 — Đối chiếu contract và phạm vi

Files: `packages/api-client/src/index.ts`, `apps/api/src/modules/guest-rental-access/`, `apps/api/src/modules/bookings/bookings.routes.ts`, `apps/web/src/features/booking-tracking/`.

1. Đọc issue #112, #77, #92 và API hiện hành; kiểm tra clean worktree.
2. GitNexus context/impact trước sửa; xác minh source khi FTS không khả dụng và báo HIGH/CRITICAL.
3. Giữ POST access-link, POST magic-link/exchange, GET tracking và guest rental/payments/contracts/PDF, POST revoke hiện có.

## Task 2 — Kiểm tra flow và sửa khoảng trống frontend

Files: `apps/web/e2e/guest-booking-api.spec.ts`, `apps/web/booking-tracking.playwright.config.ts`, `use-booking-tracking.ts`, `booking-tracking-screen.tsx`, `booking-lookup-form.tsx` và messages/types/hooks liền kề nếu cần.

1. Viết ca lỗi: sau link hết hạn/revoke, Tra cứu lại phải về form ngay cả khi URL không đổi. Chạy để xác nhận lỗi trước sửa.
2. Reset state, query cache và URL khi tra cứu lại; không tự exchange lại token cũ và không lưu token vào browser storage.
3. Giữ draft khi gửi yêu cầu lỗi; giữ idempotency key cho cùng payload khi thử lại, tạo key mới cho yêu cầu khác.
4. Hiển thị lỗi rate-limit/service rõ ràng, không suy ra email đã gửi chỉ từ response 202.
5. Kiểm tra link hợp lệ → private booking/rental/payments/contracts → reload → revoke/expiry; guest chỉ đọc, không có thao tác trả/đổi kho.

## Task 3 — Kiểm chứng và bàn giao

1. Chạy Vitest booking lookup, type-check Web/API client/contracts và Biome các file sửa.
2. Chạy Playwright riêng flow guest bằng fixture, không gọi dịch vụ gửi mail thật; axe và screenshot desktop/375/390/430.
3. Sau test xem ảnh/UI; kiểm tra navigation, validation, lỗi, loading và không tràn ngang.
4. Kiểm tra API local đọc không có phiên phải bị từ chối; không tạo outbox/email hoặc guest session thật bằng seed cưỡng bức.
5. Ghi endpoint, lệnh Web/API/worker và giới hạn kiểm chứng; không tuyên bố đã gửi email hoặc kiểm tra thiết bị thật.
